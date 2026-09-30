import { Color, DoubleSide, ShaderMaterial, Vector3 } from 'three'

export type ShaderStudyId = 'displace' | 'toon' | 'contact' | 'glitch'

export type ShaderStudyOption = {
  id: ShaderStudyId
  label: string
  description: string
}

export const SHADER_STUDIES: ShaderStudyOption[] = [
  {
    id: 'displace',
    label: 'Vertex Displacement',
    description:
      'Animates terrain vertices with layered sine/noise motion along normals — living ground that ripples without changing the density grid.',
  },
  {
    id: 'toon',
    label: 'Toon',
    description:
      'Flat stepped lighting and a bold fresnel outline — clean geometric shading inspired by Monument Valley.',
  },
  {
    id: 'contact',
    label: 'Contact Shadows',
    description:
      'Soft crevice darkening and warm height-based tint — ambient-occlusion–style contact shadows inspired by Sable’s painterly look.',
  },
  {
    id: 'glitch',
    label: 'Glitch',
    description:
      'RGB channel split, scanlines, and digital noise over the mesh — cyberpunk distortion on the same voxel terrain.',
  },
]

export function getShaderStudy(id: ShaderStudyId): ShaderStudyOption {
  return SHADER_STUDIES.find((item) => item.id === id) ?? SHADER_STUDIES[0]!
}

// Custom ShaderMaterial (no Three chunks). Avoid relying on vertexColors flag —
// declare color attribute explicitly; fall back if length is zero.
const COMMON_VERT_HEAD = /* glsl */ `
attribute vec3 color;
uniform float uTime;
varying vec3 vNormal;
varying vec3 vViewNormal;
varying vec3 vWorldPos;
varying vec3 vColor;

vec3 safeNormal(vec3 n) {
  float len = length(n);
  return len > 1e-5 ? n / len : vec3(0.0, 1.0, 0.0);
}
`

const COMMON_FRAG_HEAD = /* glsl */ `
uniform float uTime;
uniform vec3 uLightDir;
uniform vec3 uColorLow;
uniform vec3 uColorHigh;
varying vec3 vNormal;
varying vec3 vViewNormal;
varying vec3 vWorldPos;
varying vec3 vColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec3 safeNormal(vec3 n) {
  float len = length(n);
  return len > 1e-5 ? n / len : vec3(0.0, 1.0, 0.0);
}

vec3 heightBase() {
  float h = clamp(vWorldPos.y * 0.35 + 0.5, 0.0, 1.0);
  vec3 base = mix(uColorLow, uColorHigh, h);
  if (length(vColor) > 0.01) base = mix(base, vColor, 0.55);
  return base;
}
`

const DISPLACE_VERT = /* glsl */ `
${COMMON_VERT_HEAD}
void main() {
  vColor = color;
  vec3 n = safeNormal(normal);
  float wave =
    sin(position.x * 2.4 + uTime * 1.6) * cos(position.z * 2.1 - uTime * 1.1) * 0.12
    + sin((position.x + position.z) * 4.5 + uTime * 2.4) * 0.05;
  vec3 displaced = position + n * wave;
  vec4 world = modelMatrix * vec4(displaced, 1.0);
  vWorldPos = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * n);
  vViewNormal = normalize(normalMatrix * n);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
`

const DISPLACE_FRAG = /* glsl */ `
${COMMON_FRAG_HEAD}
void main() {
  vec3 base = heightBase();
  vec3 n = safeNormal(vNormal);
  float ndl = max(dot(n, normalize(uLightDir)), 0.0);
  vec3 lit = base * (0.35 + 0.65 * ndl);
  lit += 0.05 * vec3(0.2, 0.5, 1.0) * (0.5 + 0.5 * sin(uTime + vWorldPos.x));
  gl_FragColor = vec4(lit, 1.0);
}
`

const TOON_VERT = /* glsl */ `
${COMMON_VERT_HEAD}
void main() {
  vColor = color;
  vec3 n = safeNormal(normal);
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPos = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * n);
  vViewNormal = normalize(normalMatrix * n);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const TOON_FRAG = /* glsl */ `
${COMMON_FRAG_HEAD}
void main() {
  vec3 base = heightBase();
  vec3 n = safeNormal(vNormal);
  float ndl = max(dot(n, normalize(uLightDir)), 0.0);
  float stepped = ndl > 0.66 ? 1.0 : ndl > 0.33 ? 0.55 : 0.28;
  vec3 lit = base * stepped;
  float fresnel = pow(1.0 - max(dot(safeNormal(vViewNormal), vec3(0.0, 0.0, 1.0)), 0.0), 2.2);
  if (fresnel > 0.55) {
    lit = vec3(0.06, 0.05, 0.08);
  }
  gl_FragColor = vec4(lit, 1.0);
}
`

const CONTACT_VERT = TOON_VERT

const CONTACT_FRAG = /* glsl */ `
${COMMON_FRAG_HEAD}
void main() {
  float h = clamp(vWorldPos.y * 0.35 + 0.5, 0.0, 1.0);
  vec3 sand = vec3(0.86, 0.62, 0.38);
  vec3 rock = vec3(0.45, 0.28, 0.22);
  vec3 dusk = vec3(0.72, 0.48, 0.42);
  vec3 base = mix(rock, sand, smoothstep(0.15, 0.85, h));
  base = mix(base, dusk, 0.25 * (1.0 - h));
  if (length(vColor) > 0.01) base = mix(base, vColor, 0.25);

  vec3 n = safeNormal(vNormal);
  float ndl = max(dot(n, normalize(uLightDir)), 0.0);
  float crevice = pow(1.0 - ndl, 1.6);
  float valley = pow(1.0 - clamp(n.y * 0.5 + 0.5, 0.0, 1.0), 1.8);
  float ao = clamp(0.35 + 0.65 * (1.0 - 0.7 * crevice - 0.45 * valley), 0.25, 1.0);
  vec3 lit = base * ao * (0.45 + 0.55 * smoothstep(0.0, 1.0, ndl));
  lit += vec3(0.12, 0.07, 0.04) * (1.0 - ndl);
  gl_FragColor = vec4(lit, 1.0);
}
`

const GLITCH_VERT = TOON_VERT

const GLITCH_FRAG = /* glsl */ `
${COMMON_FRAG_HEAD}
uniform float uGlitch;
void main() {
  vec3 base = heightBase();
  vec3 n = safeNormal(vNormal);
  float ndl = max(dot(n, normalize(uLightDir)), 0.0);
  vec3 lit = base * (0.35 + 0.65 * ndl);

  float gAmt = clamp(uGlitch, 0.0, 2.0);
  float split = (0.04 + 0.03 * sin(uTime * 8.0 + vWorldPos.y * 3.0)) * gAmt;
  float r = lit.r + split * hash(vWorldPos.xz + uTime);
  float g = lit.g;
  float b = lit.b - split * hash(vWorldPos.zx - uTime * 1.3);

  float scan = sin(gl_FragCoord.y * 1.35 + uTime * 20.0) * 0.08 * gAmt;
  vec3 col = mix(lit, vec3(r, g, b) - scan, clamp(gAmt, 0.0, 1.0));

  float burst = step(0.92, hash(floor(gl_FragCoord.xy / 4.0) + floor(uTime * 6.0)));
  col = mix(col, vec3(hash(gl_FragCoord.xy + uTime), hash(gl_FragCoord.yx), 1.0), burst * 0.55 * gAmt);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`

/** EP playground: same glitch motion, luminance-only so the scene stays gray. */
const GLITCH_GRAY_FRAG = /* glsl */ `
${COMMON_FRAG_HEAD}
uniform float uGlitch;
void main() {
  vec3 base = heightBase();
  float luma = dot(base, vec3(0.299, 0.587, 0.114));
  vec3 lit = vec3(luma) * (0.35 + 0.65 * max(dot(safeNormal(vNormal), normalize(uLightDir)), 0.0));

  float gAmt = clamp(uGlitch, 0.0, 2.0);
  float wobble = (0.04 + 0.03 * sin(uTime * 8.0 + vWorldPos.y * 3.0)) * gAmt;
  float n0 = hash(vWorldPos.xz + uTime);
  float n1 = hash(vWorldPos.zx - uTime * 1.3);
  float scan = sin(gl_FragCoord.y * 1.35 + uTime * 20.0) * 0.08 * gAmt;
  float gray = lit.r + (n0 - n1) * wobble - scan;

  float burst = step(0.92, hash(floor(gl_FragCoord.xy / 4.0) + floor(uTime * 6.0)));
  float burstL = hash(gl_FragCoord.xy + uTime);
  gray = mix(gray, burstL, burst * 0.55 * gAmt);

  gl_FragColor = vec4(vec3(clamp(gray, 0.0, 1.0)), 1.0);
}
`

const SOURCES: Record<
  ShaderStudyId,
  { vertexShader: string; fragmentShader: string }
> = {
  displace: { vertexShader: DISPLACE_VERT, fragmentShader: DISPLACE_FRAG },
  toon: { vertexShader: TOON_VERT, fragmentShader: TOON_FRAG },
  contact: { vertexShader: CONTACT_VERT, fragmentShader: CONTACT_FRAG },
  glitch: { vertexShader: GLITCH_VERT, fragmentShader: GLITCH_FRAG },
}

export function createStudyMaterial(
  study: ShaderStudyId,
  options?: { glitchIntensity?: number; grayscale?: boolean },
): ShaderMaterial {
  const source = SOURCES[study]
  const grayscale = Boolean(options?.grayscale)
  const fragmentShader =
    study === 'glitch' && grayscale ? GLITCH_GRAY_FRAG : source.fragmentShader
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uLightDir: { value: new Vector3(0.45, 0.85, 0.35).normalize() },
      uColorLow: {
        value: new Color(grayscale ? '#2a2a2a' : '#1238c8'),
      },
      uColorHigh: {
        value: new Color(grayscale ? '#d4d4d4' : '#ff1a1a'),
      },
      uGlitch: { value: options?.glitchIntensity ?? 1 },
    },
    vertexShader: source.vertexShader,
    fragmentShader,
    side: DoubleSide,
    toneMapped: false,
    // Don't set vertexColors — custom attribute handling only
  })
}
