/**
 * Copied from Weathering's still-ground shader (createStillWaterMaterial in epAtmosphere),
 * with fog disabled — Weathering v2 keeps no fog/atmosphere for now.
 */
import {
  Color,
  DoubleSide,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
} from 'three'

const GROUND_VERT = /* glsl */ `
attribute vec3 color;
varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vWorld;
void main() {
  vColor = color;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}
`

const GROUND_FRAG = /* glsl */ `
uniform vec3 uSheen;
varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vWorld;
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
}
`

export function createV2GroundMaterial() {
  return new ShaderMaterial({
    fog: false,
    side: DoubleSide,
    uniforms: UniformsUtils.merge([
      UniformsLib.fog,
      { uSheen: { value: new Color('#3a4046') } },
    ]),
    vertexShader: GROUND_VERT,
    fragmentShader: GROUND_FRAG,
  })
}
