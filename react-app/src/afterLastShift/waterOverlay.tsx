import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferGeometry, DoubleSide, Float32BufferAttribute, ShaderMaterial, UniformsLib, UniformsUtils } from 'three'
import type { WaterMask } from './waterMask.ts'

const VERT = /* glsl */ `
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`
const FRAG = /* glsl */ `
void main() {
  gl_FragColor = vec4(0.12, 0.78, 0.95, 0.78);
}
`

function pushTri(positions: number[], a: number[], b: number[], c: number[]) {
  positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2])
}

/** Rounded ribbon along the smoothed centerline, plus a cap at each end. */
function ribbonPositions(mask: WaterMask, heightAt: (x: number, z: number) => number, lift: number) {
  const positions: number[] = []
  const half = mask.halfWidth ?? 4
  for (const path of mask.paths ?? []) {
    if (path.length < 2) continue
    const left: number[][] = []
    const right: number[][] = []
    let sideX = 0
    let sideZ = 1
    for (let i = 0; i < path.length; i++) {
      const prev = path[Math.max(0, i - 1)]
      const next = path[Math.min(path.length - 1, i + 1)]
      let dx = next[0] - prev[0]
      let dz = next[1] - prev[1]
      const len = Math.hypot(dx, dz) || 1
      dx /= len
      dz /= len
      let px = -dz
      let pz = dx
      if (px * sideX + pz * sideZ < 0) {
        px = -px
        pz = -pz
      }
      sideX = px
      sideZ = pz
      const [x, z] = path[i]
      const y = heightAt(x, z) + lift
      left.push([x + px * half, y, z + pz * half])
      right.push([x - px * half, y, z - pz * half])
    }
    for (let i = 0; i < path.length - 1; i++) {
      pushTri(positions, left[i], right[i], right[i + 1])
      pushTri(positions, left[i], right[i + 1], left[i + 1])
    }
    const cap = (at: number, toward: number) => {
      const [x, z] = path[at]
      const y = heightAt(x, z) + lift
      let dx = path[at][0] - path[toward][0]
      let dz = path[at][1] - path[toward][1]
      const len = Math.hypot(dx, dz) || 1
      dx /= len
      dz /= len
      const steps = 6
      let prev = [x - dz * half, y, z + dx * half]
      for (let s = 1; s <= steps; s++) {
        const angle = Math.PI * (s / steps)
        const px = -dz * Math.cos(angle) + dx * Math.sin(angle)
        const pz = dx * Math.cos(angle) + dz * Math.sin(angle)
        const point = [x + px * half, y, z + pz * half]
        pushTri(positions, [x, y, z], prev, point)
        prev = point
      }
    }
    cap(0, 1)
    cap(path.length - 1, path.length - 2)
  }
  return positions
}

function overlayGeometry(mask: WaterMask, heightAt: (x: number, z: number) => number) {
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(ribbonPositions(mask, heightAt, 0.85), 3))
  geo.computeBoundingSphere()
  return geo
}

/** Colored mask on the heightfield. Hidden unless the Layers toggle is on. */
export function WaterMaskOverlay({
  mask,
  heightAt,
  visible,
}: {
  mask: WaterMask
  heightAt: (x: number, z: number) => number
  visible: boolean
}) {
  const geometry = useMemo(() => overlayGeometry(mask, heightAt), [mask, heightAt])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        toneMapped: false,
        vertexShader: VERT,
        fragmentShader: FRAG,
      }),
    [],
  )
  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  if (!visible) return null
  return (
    <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={3} raycast={() => null} />
  )
}

const STREAM_VERT = /* glsl */ `
uniform float uTime;
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vec3 p = position;
  p.y += sin(p.x * 1.6 + p.z * 0.8 + uTime * 1.3) * 0.028;
  p.y += sin(p.z * 1.1 - uTime * 0.9) * 0.016;
  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorld = world.xyz;
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`

const STREAM_FRAG = /* glsl */ `
uniform float uTime;
varying vec3 vWorld;
#include <fog_pars_fragment>
void main() {
  float flow = vWorld.x * 0.42 + vWorld.z * 0.18 - uTime * 0.22;
  float n = sin(flow) * sin(vWorld.z * 0.55 + uTime * 0.17);
  vec3 deep = vec3(0.09, 0.094, 0.1);
  vec3 sheen = vec3(0.22, 0.224, 0.23);
  vec3 col = mix(deep, sheen, smoothstep(-0.35, 0.85, n) * 0.55);
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}
`

function streamGeometry(mask: WaterMask, heightAt: (x: number, z: number) => number) {
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(ribbonPositions(mask, heightAt, 0.7), 3))
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  return geo
}

/** Dark flowing sheet on mask cells. Separate from the debug overlay. */
export function StreamWater({
  mask,
  heightAt,
}: {
  mask: WaterMask
  heightAt: (x: number, z: number) => number
}) {
  const geometry = useMemo(() => streamGeometry(mask, heightAt), [mask, heightAt])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        fog: true,
        side: DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
        uniforms: UniformsUtils.merge([UniformsLib.fog, { uTime: { value: 0 } }]),
        vertexShader: STREAM_VERT,
        fragmentShader: STREAM_FRAG,
      }),
    [],
  )
  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime
  })
  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  if ((geometry.getAttribute('position')?.count ?? 0) === 0) return null
  return (
    <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={2} raycast={() => null} />
  )
}
