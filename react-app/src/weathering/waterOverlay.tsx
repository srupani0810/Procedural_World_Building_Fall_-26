import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferGeometry, DoubleSide, Float32BufferAttribute, ShaderMaterial, UniformsLib, UniformsUtils } from 'three'
import type { WaterMask } from './waterMask.ts'

const VERT = /* glsl */ `
uniform float uLevel;
attribute float aWet;
varying float vWet;
void main() {
  vec3 p = position;
  p.y += uLevel + 0.15;
  vWet = aWet;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`
const FRAG = /* glsl */ `
varying float vWet;
void main() {
  float shore = smoothstep(0.0, 0.72, vWet);
  gl_FragColor = vec4(0.12, 0.78, 0.95, 0.78 * shore);
}
`

type ShorePoint = { x: number; z: number; w: number }

const SHORE_ISO = 0.08

/** Marching-squares fill. Edge crossings sit on the wetness contour, so the bank curves. */
function lakeGeometry(mask: WaterMask, heightAt: (x: number, z: number) => number) {
  const positions: number[] = []
  const wet: number[] = []
  const { originX, originZ, cellSize, resolution, field, surfaceCeiling } = mask
  const yAt = (x: number, z: number) => Math.min(heightAt(x, z), surfaceCeiling)
  const push = (a: ShorePoint, b: ShorePoint, c: ShorePoint) => {
    positions.push(a.x, yAt(a.x, a.z), a.z, b.x, yAt(b.x, b.z), b.z, c.x, yAt(c.x, c.z), c.z)
    wet.push(a.w, b.w, c.w)
  }
  for (let iz = 0; iz < resolution - 1; iz++) {
    for (let ix = 0; ix < resolution - 1; ix++) {
      const w00 = field[iz * resolution + ix]
      const w10 = field[iz * resolution + ix + 1]
      const w11 = field[(iz + 1) * resolution + ix + 1]
      const w01 = field[(iz + 1) * resolution + ix]
      if (w00 < SHORE_ISO && w10 < SHORE_ISO && w11 < SHORE_ISO && w01 < SHORE_ISO) continue
      const x0 = originX + (ix + 0.5) * cellSize
      const z0 = originZ + (iz + 0.5) * cellSize
      const x1 = x0 + cellSize
      const z1 = z0 + cellSize
      const corners: ShorePoint[] = [
        { x: x0, z: z0, w: w00 },
        { x: x1, z: z0, w: w10 },
        { x: x1, z: z1, w: w11 },
        { x: x0, z: z1, w: w01 },
      ]
      const poly: ShorePoint[] = []
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4
        const a = corners[i]
        const b = corners[j]
        const insideA = a.w >= SHORE_ISO
        const insideB = b.w >= SHORE_ISO
        if (insideA) poly.push(a)
        if (insideA !== insideB) {
          const t = (SHORE_ISO - a.w) / (b.w - a.w || 1)
          poly.push({
            x: a.x + (b.x - a.x) * t,
            z: a.z + (b.z - a.z) * t,
            w: SHORE_ISO,
          })
        }
      }
      for (let i = 1; i < poly.length - 1; i++) push(poly[0], poly[i], poly[i + 1])
    }
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geo.setAttribute('aWet', new Float32BufferAttribute(wet, 1))
  geo.computeBoundingSphere()
  return geo
}

/** Colored mask on the heightfield. Hidden unless the Layers toggle is on. */
export function WaterMaskOverlay({
  mask,
  heightAt,
  level,
  visible,
}: {
  mask: WaterMask
  heightAt: (x: number, z: number) => number
  level: number
  visible: boolean
}) {
  const geometry = useMemo(() => lakeGeometry(mask, heightAt), [mask, heightAt])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        toneMapped: false,
        uniforms: { uLevel: { value: level } },
        vertexShader: VERT,
        fragmentShader: FRAG,
      }),
    [],
  )
  const levelRef = useRef(level)
  levelRef.current = level
  useFrame(() => {
    material.uniforms.uLevel.value = levelRef.current
  })
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
uniform float uLevel;
uniform float uFlow;
attribute float aWet;
varying vec3 vWorld;
varying float vWet;
#include <fog_pars_vertex>
void main() {
  vec3 p = position;
  p.y += uLevel;
  p.y += sin(p.x * 1.6 + p.z * 0.8 + uTime * 1.3 * uFlow) * 0.028 * aWet;
  p.y += sin(p.z * 1.1 - uTime * 0.9 * uFlow) * 0.016 * aWet;
  vWet = aWet;
  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorld = world.xyz;
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`

const STREAM_FRAG = /* glsl */ `
uniform float uTime;
uniform float uFlow;
varying vec3 vWorld;
varying float vWet;
#include <fog_pars_fragment>
void main() {
  float flow = vWorld.x * 0.42 + vWorld.z * 0.18 - uTime * 0.22 * uFlow;
  float n = sin(flow) * sin(vWorld.z * 0.55 + uTime * 0.17 * uFlow);
  vec3 deep = vec3(0.09, 0.094, 0.1);
  vec3 sheen = vec3(0.22, 0.224, 0.23);
  vec3 col = mix(deep, sheen, smoothstep(-0.35, 0.85, n) * 0.55);
  float shore = smoothstep(0.0, 0.72, vWet);
  gl_FragColor = vec4(col, shore);
  #include <fog_fragment>
}
`

/** Dark flowing sheet on mask cells. Separate from the debug overlay. */
export function StreamWater({
  mask,
  heightAt,
  level,
  flow,
}: {
  mask: WaterMask
  heightAt: (x: number, z: number) => number
  level: number
  flow: number
}) {
  const geometry = useMemo(() => lakeGeometry(mask, heightAt), [mask, heightAt])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        fog: true,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
        uniforms: UniformsUtils.merge([
          UniformsLib.fog,
          { uTime: { value: 0 }, uLevel: { value: level }, uFlow: { value: flow } },
        ]),
        vertexShader: STREAM_VERT,
        fragmentShader: STREAM_FRAG,
      }),
    [],
  )
  const levelRef = useRef(level)
  const flowRef = useRef(flow)
  levelRef.current = level
  flowRef.current = flow
  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime
    material.uniforms.uLevel.value = levelRef.current
    material.uniforms.uFlow.value = flowRef.current
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
