import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import {
  Color,
  Data3DTexture,
  DoubleSide,
  LinearFilter,
  Object3D,
  RedFormat,
  ShaderMaterial,
  UnsignedByteType,
} from 'three'
import type { InstancedMesh, Mesh } from 'three'
import type { TerrainParams } from './terrainParams.ts'
import {
  buildDensityTextureData,
  extractMarchingCubesGeometry,
  extractPointGeometry,
  extractTerrainVoxels,
} from './voxelExtract.ts'
import type { VoxelParams } from './voxelParams.ts'

type Props = {
  terrain: TerrainParams
  voxel: VoxelParams
}

function VoxelCubes({ terrain, voxel }: Props) {
  const meshRef = useRef<InstancedMesh>(null)
  const { cells, cellSize } = useMemo(
    () => extractTerrainVoxels(terrain, voxel),
    [terrain, voxel],
  )
  const scale = cellSize * voxel.overlap
  const count = Math.max(cells.length, 1)

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const dummy = new Object3D()
    cells.forEach((cell, i) => {
      dummy.position.set(cell.x, cell.y, cell.z)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      mesh.setColorAt(i, cell.color)
    })
    mesh.count = cells.length
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [cells])

  return (
    <instancedMesh key={count} ref={meshRef} args={[undefined, undefined, count]}>
      <boxGeometry args={[scale, scale, scale]} />
      <meshStandardMaterial vertexColors roughness={0.88} metalness={0} />
    </instancedMesh>
  )
}

function VoxelMarching({ terrain, voxel }: Props) {
  const geometry = useMemo(
    () => extractMarchingCubesGeometry(terrain, voxel),
    [terrain, voxel],
  )

  useLayoutEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial vertexColors roughness={0.82} metalness={0} side={DoubleSide} />
    </mesh>
  )
}

function VoxelPoints({ terrain, voxel }: Props) {
  const geometry = useMemo(() => extractPointGeometry(terrain, voxel), [terrain, voxel])
  useLayoutEffect(() => () => geometry.dispose(), [geometry])

  return (
    <points geometry={geometry}>
      <pointsMaterial vertexColors size={0.05} sizeAttenuation />
    </points>
  )
}

const raymarchVertex = /* glsl */ `
varying vec3 vOrigin;
varying vec3 vDirection;

void main() {
  vOrigin = vec3(inverse(modelMatrix) * vec4(cameraPosition, 1.0));
  vDirection = position - vOrigin;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const raymarchFragment = /* glsl */ `
precision highp float;
precision highp sampler3D;

uniform sampler3D uVolume;
uniform float uThreshold;
uniform vec3 uColorLow;
uniform vec3 uColorHigh;
uniform float uSteps;

varying vec3 vOrigin;
varying vec3 vDirection;

vec2 hitBox(vec3 orig, vec3 dir) {
  vec3 boxMin = vec3(-0.5);
  vec3 boxMax = vec3(0.5);
  vec3 invDir = 1.0 / dir;
  vec3 tbot = invDir * (boxMin - orig);
  vec3 ttop = invDir * (boxMax - orig);
  vec3 tmin = min(ttop, tbot);
  vec3 tmax = max(ttop, tbot);
  float t0 = max(tmin.x, max(tmin.y, tmin.z));
  float t1 = min(tmax.x, min(tmax.y, tmax.z));
  return vec2(t0, t1);
}

void main() {
  vec3 rayDir = normalize(vDirection);
  vec2 bounds = hitBox(vOrigin, rayDir);
  if (bounds.x > bounds.y) discard;
  bounds.x = max(bounds.x, 0.0);

  vec3 p = vOrigin + bounds.x * rayDir;
  vec3 inc = 1.0 / abs(rayDir);
  float delta = min(inc.x, min(inc.y, inc.z)) / uSteps;

  for (float t = bounds.x; t < bounds.y; t += delta) {
    vec3 uvw = p + 0.5;
    float d = texture(uVolume, uvw).r;
    if (d > uThreshold) {
      float shade = clamp(d, 0.0, 1.0);
      vec3 col = mix(uColorLow, uColorHigh, shade);
      gl_FragColor = vec4(col * (0.55 + 0.45 * shade), 1.0);
      return;
    }
    p += rayDir * delta;
  }
  discard;
}
`

function VoxelRayMarch({ terrain, voxel }: Props) {
  const meshRef = useRef<Mesh>(null)
  const { texture, half } = useMemo(() => {
    const packed = buildDensityTextureData(terrain, voxel)
    const tex = new Data3DTexture(packed.data, packed.size, packed.size, packed.size)
    tex.format = RedFormat
    tex.type = UnsignedByteType
    tex.minFilter = LinearFilter
    tex.magFilter = LinearFilter
    tex.unpackAlignment = 1
    tex.needsUpdate = true
    return { texture: tex, half: packed.half }
  }, [terrain, voxel])

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uVolume: { value: texture },
          uThreshold: { value: 0.5 },
          uColorLow: { value: new Color('#1238c8') },
          uColorHigh: { value: new Color('#ff1a1a') },
          uSteps: { value: 96 },
        },
        vertexShader: raymarchVertex,
        fragmentShader: raymarchFragment,
        transparent: true,
        depthWrite: true,
      }),
    [texture],
  )

  useLayoutEffect(() => {
    material.uniforms.uVolume!.value = texture
    return () => {
      texture.dispose()
      material.dispose()
    }
  }, [texture, material])

  const side = half * 2

  return (
    <mesh ref={meshRef} material={material}>
      <boxGeometry args={[side, side, side]} />
    </mesh>
  )
}

function VoxelContent(props: Props) {
  switch (props.voxel.renderMode) {
    case 'cubes':
      return <VoxelCubes {...props} />
    case 'marching':
      return <VoxelMarching {...props} />
    case 'points':
      return <VoxelPoints {...props} />
    case 'raymarch':
      return <VoxelRayMarch {...props} />
  }
}

export default function VoxelScene({ terrain, voxel }: Props) {
  return (
    <Canvas
      className="scene-canvas"
      camera={{ position: [3.4, 2.8, 3.4], fov: 45 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#0a0a0a']} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 3]} intensity={1.2} />
      <directionalLight position={[-3, 1, -2]} intensity={0.25} />
      <VoxelContent terrain={terrain} voxel={voxel} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan
        minDistance={1.4}
        maxDistance={14}
      />
    </Canvas>
  )
}
