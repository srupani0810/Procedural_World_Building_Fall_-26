import {
  Color,
  DoubleSide,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector3,
} from 'three'

/**
 * EP-only material — kept out of shaderStudies so the Playground does not share
 * Shader tab study materials or uniforms.
 * Fog chunks + UniformsLib.fog so voxels fade into scene Fog (linear near/far).
 */
const EP_VERT = /* glsl */ `
attribute vec3 color;
uniform float uTime;
varying vec3 vNormal;
varying vec3 vViewNormal;
varying vec3 vWorldPos;
varying vec3 vColor;

#include <fog_pars_vertex>

vec3 safeNormal(vec3 n) {
  float len = length(n);
  return len > 1e-5 ? n / len : vec3(0.0, 1.0, 0.0);
}

void main() {
  vColor = color;
  vec3 n = safeNormal(normal);
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPos = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * n);
  vViewNormal = normalize(normalMatrix * n);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`

const EP_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uLightDir;
uniform vec3 uColorLow;
uniform vec3 uColorHigh;
uniform float uGrain;
varying vec3 vNormal;
varying vec3 vViewNormal;
varying vec3 vWorldPos;
varying vec3 vColor;

#include <fog_pars_fragment>

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec3 safeNormal(vec3 n) {
  float len = length(n);
  return len > 1e-5 ? n / len : vec3(0.0, 1.0, 0.0);
}

void main() {
  float h = clamp(vWorldPos.y * 0.35 + 0.5, 0.0, 1.0);
  vec3 plaster = mix(uColorLow, uColorHigh, h);
  if (length(vColor) > 0.01) plaster = mix(plaster, vColor, 0.82);

  vec3 n = safeNormal(vNormal);
  float ndl = max(dot(n, normalize(uLightDir)), 0.0);
  float stepped = ndl > 0.72 ? 1.0 : ndl > 0.4 ? 0.68 : ndl > 0.18 ? 0.42 : 0.22;
  vec3 lit = plaster * (0.28 + 0.72 * stepped);

  lit += vec3(0.06, 0.07, 0.09) * max(n.y, 0.0) * 0.4;

  float gAmt = clamp(uGrain, 0.0, 2.0);
  float pore = hash(floor(vWorldPos * 6.5).xz + floor(vWorldPos.y * 4.0));
  float fibrous = smoothstep(0.35, 0.85, pore) * (1.0 - ndl);
  lit *= 1.0 - fibrous * 0.35 * gAmt;

  float haze = smoothstep(-0.4, 2.8, vWorldPos.y);
  lit = mix(vec3(0.08, 0.09, 0.11), lit, 0.45 + 0.55 * haze);

  gl_FragColor = vec4(clamp(lit, 0.0, 1.0), 1.0);
  #include <fog_fragment>
}
`

export function createEpMaterial(options?: { grain?: number }): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: UniformsUtils.merge([
      UniformsLib.fog,
      {
        uTime: { value: 0 },
        uLightDir: { value: new Vector3(0.45, 0.9, 0.3).normalize() },
        uColorLow: { value: new Color('#1a1c20') },
        uColorHigh: { value: new Color('#9aa1ab') },
        uGrain: { value: options?.grain ?? 0.65 },
      },
    ]),
    vertexShader: EP_VERT,
    fragmentShader: EP_FRAG,
    side: DoubleSide,
    toneMapped: false,
    fog: true,
  })
}
