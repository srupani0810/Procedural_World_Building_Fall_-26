/**
 * Noise heightfield ground — same createNoise / streamed-plane approach as Weathering.
 * No buildings, no click-to-claim. Owned by the DECAY tab.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  BackSide,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Fog,
  PlaneGeometry,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  type Mesh,
} from 'three'
import { createNoise, terrainAmplitude, type TerrainParams } from '../terrainParams.ts'
import { DECAY_FOG } from './params.ts'

const OVERVIEW_GROUND_SIZE = 520

const GROUND_VERT = /* glsl */ `
attribute vec3 color;
varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vColor = color;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`

const GROUND_FRAG = /* glsl */ `
uniform vec3 uSheen;
varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vWorld;
#include <fog_pars_fragment>
void main() {
  vec3 n = normalize(vNormal);
  vec3 viewDir = normalize(cameraPosition - vWorld);
  float ndv = clamp(dot(n, viewDir), 0.0, 1.0);
  float fresnel = pow(1.0 - ndv, 2.6);
  vec3 col = mix(vColor, uSheen, fresnel * 0.9);
  vec3 lightDir = normalize(vec3(0.45, 1.0, 0.2));
  vec3 halfVec = normalize(lightDir + viewDir);
  float spec = pow(max(dot(n, halfVec), 0.0), 64.0);
  col += vec3(0.09, 0.10, 0.11) * spec;
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}
`

function createGroundMaterial() {
  return new ShaderMaterial({
    fog: true,
    side: DoubleSide,
    uniforms: UniformsUtils.merge([
      UniformsLib.fog,
      { uSheen: { value: new Color('#3a4046') } },
    ]),
    vertexShader: GROUND_VERT,
    fragmentShader: GROUND_FRAG,
  })
}

function buildFollowGroundGeometry(
  ox: number,
  oz: number,
  size: number,
  sample: (x: number, z: number) => number,
  heightScale: number,
  segments: number,
): BufferGeometry {
  const geo = new PlaneGeometry(size, size, segments, segments)
  const positions = geo.attributes.position
  const colors = new Float32Array(positions.count * 3)

  for (let i = 0; i < positions.count; i++) {
    const lx = positions.getX(i)
    const ly = positions.getY(i)
    const wx = ox + lx
    const wz = oz - ly
    const n = sample(wx, wz)
    positions.setZ(i, n * heightScale + 0.25)
    const t = (n + 1) * 0.5
    const shade = 0.38 + t * 0.52
    colors[i * 3] = shade
    colors[i * 3 + 1] = shade + 0.03
    colors[i * 3 + 2] = shade + 0.06
  }

  positions.needsUpdate = true
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  geo.computeBoundingBox()
  geo.computeBoundingSphere()
  return geo
}

/** Continuous noise sheet anchored at origin while orbiting. */
export function StreamedNoiseGround({
  terrain,
  fogDensity,
}: {
  terrain: TerrainParams
  fogDensity: number
}) {
  const geoRef = useRef<BufferGeometry | null>(null)
  const groundRef = useRef<{ geometry: BufferGeometry; ox: number; oz: number } | null>(null)
  const [ground, setGround] = useState<{
    geometry: BufferGeometry
    ox: number
    oz: number
  } | null>(null)
  const groundMat = useMemo(() => createGroundMaterial(), [])
  useEffect(() => () => groundMat.dispose(), [groundMat])

  const sample = useMemo(() => createNoise(terrain), [terrain])
  const heightScale = terrainAmplitude(terrain)
  const segments = Math.max(48, Math.round(terrain.detail * 1.25))
  const genKey = `${terrain.noiseId}|${terrain.frequency}|${terrain.amplitude}|${terrain.octaves}|${terrain.persistence}|${segments}|${heightScale}|${fogDensity}`

  const remesh = (ox: number, oz: number) => {
    const size = OVERVIEW_GROUND_SIZE
    const segs = Math.max(48, Math.round(size / 2.7))
    const next = buildFollowGroundGeometry(ox, oz, size, sample, heightScale, segs)
    geoRef.current?.dispose()
    geoRef.current = next
    const payload = { geometry: next, ox, oz }
    groundRef.current = payload
    setGround(payload)
  }

  useEffect(() => {
    remesh(0, 0)
    return () => {
      geoRef.current?.dispose()
      geoRef.current = null
      groundRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remesh when terrain/fog change
  }, [genKey, sample, heightScale, segments, fogDensity])

  if (!ground) return null

  return (
    <mesh
      geometry={ground.geometry}
      position={[ground.ox, 0, ground.oz]}
      rotation={[-Math.PI / 2, 0, 0]}
      frustumCulled={false}
      material={groundMat}
    />
  )
}

export function DecaySky() {
  const meshRef = useRef<Mesh>(null)
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uHorizon: { value: new Color(DECAY_FOG) },
          uZenith: { value: new Color('#525860') },
        },
        vertexShader: /* glsl */ `
varying vec3 vDir;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vDir = world.xyz - cameraPosition;
  gl_Position = projectionMatrix * viewMatrix * world;
}`,
        fragmentShader: /* glsl */ `
uniform vec3 uHorizon;
uniform vec3 uZenith;
varying vec3 vDir;
void main() {
  float h = normalize(vDir).y;
  float up = smoothstep(0.0, 0.42, h);
  gl_FragColor = vec4(mix(uHorizon, uZenith, up), 1.0);
}`,
      }),
    [],
  )
  useEffect(() => () => mat.dispose(), [mat])
  useFrame(({ camera }) => {
    const mesh = meshRef.current
    if (!mesh) return
    mesh.position.x = camera.position.x
    mesh.position.z = camera.position.z
  })
  return (
    <mesh ref={meshRef} frustumCulled={false} renderOrder={-20} raycast={() => null}>
      <sphereGeometry args={[2200, 28, 16]} />
      <primitive object={mat} attach="material" />
    </mesh>
  )
}

export function DecayFog({ density }: { density: number }) {
  const { scene, camera } = useThree()
  const fogRef = useRef<Fog | null>(null)
  const densityRef = useRef(density)
  densityRef.current = density

  useEffect(() => {
    const fog = new Fog(new Color(DECAY_FOG), 40, 120)
    fogRef.current = fog
    scene.fog = fog
    return () => {
      if (scene.fog === fog) scene.fog = null
      fogRef.current = null
    }
  }, [scene])

  useFrame(() => {
    const fog = fogRef.current
    if (!fog) return
    if (scene.fog !== fog) scene.fog = fog
    fog.color.set(DECAY_FOG)
    const d = Math.max(0.01, densityRef.current)
    const dist = Math.hypot(camera.position.x, camera.position.y, camera.position.z)
    const thicken = Math.min(1, Math.max(0, (d - 0.02) / 0.12))
    fog.near = Math.max(12, dist * 0.85 * (1 - thicken * 0.4))
    fog.far = Math.max(fog.near + 24, OVERVIEW_GROUND_SIZE * 0.42 * (1 - thicken * 0.35))
  })

  return null
}
