import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BackSide,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  type Mesh,
} from 'three'
import { EP_FOG_COLOR } from './epParams.ts'

const WATER_VERT = /* glsl */ `
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

const WATER_FRAG = /* glsl */ `
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
  vec3 deep = vColor;
  vec3 col = mix(deep, uSheen, fresnel * 0.9);
  vec3 lightDir = normalize(vec3(0.45, 1.0, 0.2));
  vec3 halfVec = normalize(lightDir + viewDir);
  float spec = pow(max(dot(n, halfVec), 0.0), 64.0);
  col += vec3(0.09, 0.10, 0.11) * spec;
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}
`

/** Dark water: near-black facing the camera, a faint gray sheen at a grazing angle. */
export function createStillWaterMaterial() {
  return new ShaderMaterial({
    fog: true,
    side: DoubleSide,
    uniforms: UniformsUtils.merge([
      UniformsLib.fog,
      { uSheen: { value: new Color('#3a4046') } },
    ]),
    vertexShader: WATER_VERT,
    fragmentShader: WATER_FRAG,
  })
}

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vDir = world.xyz - cameraPosition;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

const SKY_FRAG = /* glsl */ `
uniform vec3 uHorizon;
uniform vec3 uZenith;
varying vec3 vDir;
void main() {
  float h = normalize(vDir).y;
  float up = smoothstep(0.0, 0.42, h);
  vec3 col = mix(uHorizon, uZenith, up);
  gl_FragColor = vec4(col, 1.0);
}
`

/** Dead gray ceiling, a little lighter overhead than the fog at the horizon. */
export function DeadSky() {
  const meshRef = useRef<Mesh>(null)
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uHorizon: { value: new Color(EP_FOG_COLOR) },
          uZenith: { value: new Color('#525860') },
        },
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
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

function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

function pushBox(
  pos: number[],
  nrm: number[],
  x: number,
  z: number,
  y0: number,
  y1: number,
  hx: number,
  hz: number,
) {
  const faces: Array<[number, number, number, number, number, number]> = [
    [0, 0, 1, hx, 0, 0],
    [0, 0, -1, -hx, 0, 0],
    [1, 0, 0, 0, 0, hz],
    [-1, 0, 0, 0, 0, -hz],
    [0, 1, 0, 0, 0, 0],
    [0, -1, 0, 0, 0, 0],
  ]
  const corners = [
    [-hx, y0, -hz],
    [hx, y0, -hz],
    [hx, y0, hz],
    [-hx, y0, hz],
    [-hx, y1, -hz],
    [hx, y1, -hz],
    [hx, y1, hz],
    [-hx, y1, hz],
  ]
  const quads = [
    [1, 2, 6, 5],
    [3, 0, 4, 7],
    [2, 3, 7, 6],
    [0, 1, 5, 4],
    [4, 5, 6, 7],
    [3, 2, 1, 0],
  ]
  for (let f = 0; f < 6; f++) {
    const [nx, ny, nz] = faces[f]
    const [a, b, c, d] = quads[f]
    for (const k of [a, b, c, a, c, d]) {
      const p = corners[k]
      pos.push(x + p[0], p[1], z + p[2])
      nrm.push(nx, ny, nz)
    }
  }
}

function buildHazeGeometry() {
  const pos: number[] = []
  const nrm: number[] = []
  for (let i = 0; i < 56; i++) {
    const ang = hash(i) * Math.PI * 2
    const radius = 46 + hash(i + 4) * 80
    const x = Math.cos(ang) * radius
    const z = Math.sin(ang) * radius
    const hx = 1.6 + hash(i + 8) * 4.5
    const hz = 1.6 + hash(i + 12) * 3.4
    const h = 4 + hash(i + 16) * 11
    pushBox(pos, nrm, x, z, 0.2, 0.2 + h, hx, hz)
    if (hash(i + 21) > 0.55) {
      const x2 = x + (hash(i + 25) - 0.5) * 16
      const z2 = z + (hash(i + 28) - 0.5) * 16
      pushBox(
        pos,
        nrm,
        x2,
        z2,
        0.2,
        0.2 + 2.2 + hash(i + 33) * 6,
        hx * 0.55,
        hz * 0.5,
      )
    }
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
  geo.setAttribute('normal', new Float32BufferAttribute(nrm, 3))
  geo.computeBoundingSphere()
  return geo
}

/** Faint block masses inside the haze. They dissolve into the fog before they read as detail. */
export function HazeSilhouettes() {
  const geo = useMemo(() => buildHazeGeometry(), [])
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        fog: true,
        depthWrite: true,
        uniforms: UniformsUtils.merge([
          UniformsLib.fog,
          { uColor: { value: new Color('#14171b') } },
        ]),
        vertexShader: /* glsl */ `
          #include <fog_pars_vertex>
          void main() {
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            #include <fog_vertex>
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          #include <fog_pars_fragment>
          void main() {
            gl_FragColor = vec4(uColor, 1.0);
            #include <fog_fragment>
          }
        `,
      }),
    [],
  )
  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )
  return <mesh geometry={geo} material={mat} frustumCulled={false} raycast={() => null} />
}
