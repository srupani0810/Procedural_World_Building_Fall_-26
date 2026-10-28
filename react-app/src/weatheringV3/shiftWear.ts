import {
  AdditiveBlending,
  Color,
  DoubleSide,
  MeshStandardMaterial,
  ShaderMaterial,
  Vector2,
} from 'three'

/** Terrain mid-gray the reclaimed stage fades toward. Matches the ground gradient, not a new light. */
export const RECLAIM_GROUND = new Color('#2c3038')

const WEAR_VARYING = /* glsl */ `
attribute float aEdge;
attribute float aNoise;
attribute vec3 aDrape;
uniform float uWear;
uniform float uBaseY;
uniform vec2 uTilt;
varying float vEdge;
varying float vNoise;
varying vec3 vLocal;
`

const WEAR_VERTEX = /* glsl */ `
#include <begin_vertex>
float h = max(position.y - uBaseY, 0.0);
float sagAmt = smoothstep(2.05, 3.0, uWear);
transformed += vec3(uTilt.x * h, -h * (0.05 + 0.045 * h), uTilt.y * h) * sagAmt;
float drapeAmt = smoothstep(1.45, 2.45, uWear);
transformed += aDrape * (1.0 - drapeAmt);
vEdge = aEdge;
vNoise = aNoise;
vLocal = position;
`

const WEAR_FRAGMENT = /* glsl */ `
#include <color_fragment>
float streak = smoothstep(0.25, 1.15, uWear) * uWearIntensity;
float rust = smoothstep(1.05, 2.2, uWear) * uWearIntensity;
float chalk = smoothstep(1.25, 2.35, uWear) * uWearIntensity;
float reclaim = smoothstep(2.05, 3.0, uWear);
vec3 concrete = vec3(0.74, 0.73, 0.70);
vec3 painted = mix(concrete, uPaint, 0.2);
vec3 col = mix(painted, diffuseColor.rgb, 0.15);
float bands = smoothstep(0.42, 0.72, fract(vNoise * 6.5 + vLocal.y * 1.6));
col = mix(col, col * vec3(0.78, 0.74, 0.68), streak * 0.55);
col = mix(col, col * vec3(0.62, 0.52, 0.4), streak * bands * 0.42);
vec3 rustCol = vec3(0.48, 0.2, 0.09);
vec3 chalkCol = vec3(0.82, 0.8, 0.74);
float crack = smoothstep(0.78, 0.84, fract(vNoise * 11.0 + vLocal.x * 2.2 + vLocal.z * 1.4));
col = mix(col, rustCol, rust * vEdge * 0.9);
col = mix(col, chalkCol, chalk * (1.0 - vEdge) * (0.18 + 0.5 * vNoise));
col = mix(col, col * vec3(0.35), chalk * crack * (1.0 - vEdge));
float luma = dot(col, vec3(0.299, 0.587, 0.114));
col = mix(col, vec3(luma), reclaim * 0.8);
col = mix(col, uGround, reclaim * 0.78);
col = mix(col, rustCol * 0.45, reclaim * vEdge * 0.55);
diffuseColor.rgb = col;
`

export type WearUniforms = {
  uWear: { value: number }
  uBaseY: { value: number }
  uTilt: { value: Vector2 }
  uPaint: { value: Color }
  uGround: { value: Color }
  uWearIntensity: { value: number }
}

export function createWearUniforms(baseY: number, tiltX: number, tiltZ: number, paint: Color): WearUniforms {
  return {
    uWear: { value: 0 },
    uBaseY: { value: baseY },
    uTilt: { value: new Vector2(tiltX, tiltZ) },
    uPaint: { value: paint.clone() },
    uGround: { value: RECLAIM_GROUND.clone() },
    uWearIntensity: { value: 1 },
  }
}

function bindWear(material: MeshStandardMaterial | ShaderMaterial, wear: WearUniforms, fragment: boolean) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWear = wear.uWear
    shader.uniforms.uBaseY = wear.uBaseY
    shader.uniforms.uTilt = wear.uTilt
    shader.uniforms.uPaint = wear.uPaint
    shader.uniforms.uGround = wear.uGround
    shader.uniforms.uWearIntensity = wear.uWearIntensity
    shader.vertexShader = WEAR_VARYING + shader.vertexShader.replace('#include <begin_vertex>', WEAR_VERTEX)
    if (fragment) {
      shader.fragmentShader =
        /* glsl */ `
          varying float vEdge;
          varying float vNoise;
          varying vec3 vLocal;
          uniform float uWear;
          uniform float uWearIntensity;
          uniform vec3 uPaint;
          uniform vec3 uGround;
        ` + shader.fragmentShader.replace('#include <color_fragment>', WEAR_FRAGMENT)
    }
  }
  material.customProgramCacheKey = () => (fragment ? 'weathering-plaster-wear' : 'weathering-tarp-wear')
  material.needsUpdate = true
}

export function createPlasterMaterial(wear: WearUniforms) {
  const material = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    side: DoubleSide,
  })
  bindWear(material, wear, true)
  return material
}

export function createTarpMaterial(wear: WearUniforms) {
  const material = new MeshStandardMaterial({
    color: '#6d675c',
    roughness: 1,
    metalness: 0,
    side: DoubleSide,
    transparent: true,
    opacity: 1,
    depthWrite: false,
  })
  bindWear(material, wear, false)
  const wearCompile = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    wearCompile(shader, renderer)
    shader.fragmentShader =
      'uniform float uWear;\n' +
      shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        /* glsl */ `
          float show = smoothstep(1.45, 2.35, uWear);
          diffuseColor.a *= show;
          #include <opaque_fragment>
        `,
      )
  }
  material.customProgramCacheKey = () => 'weathering-tarp-wear'
  return material
}
export function createGlowMaterial(wear: WearUniforms) {
  return new ShaderMaterial({
    uniforms: {
      uWear: wear.uWear,
      uBaseY: wear.uBaseY,
      uTilt: wear.uTilt,
      uGround: wear.uGround,
    },
    vertexShader: /* glsl */ `
      attribute vec3 color;
      uniform float uWear;
      uniform float uBaseY;
      uniform vec2 uTilt;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec3 transformed = position;
        float h = max(position.y - uBaseY, 0.0);
        float sagAmt = smoothstep(2.05, 3.0, uWear);
        transformed += vec3(uTilt.x * h, -h * (0.05 + 0.045 * h), uTilt.y * h) * sagAmt;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uWear;
      uniform vec3 uGround;
      varying vec3 vColor;
      void main() {
        float reclaim = smoothstep(2.05, 3.0, uWear);
        float luma = dot(vColor, vec3(0.299, 0.587, 0.114));
        vec3 col = mix(vColor, vec3(luma), reclaim * 0.85);
        col = mix(col, uGround, reclaim * 0.9);
        float keep = mix(1.0, 0.12, reclaim);
        gl_FragColor = vec4(col * keep, 1.0);
      }
    `,
    toneMapped: false,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
  })
}
