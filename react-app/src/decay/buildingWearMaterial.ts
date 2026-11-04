/**
 * Shared DECAY building wear material — one MeshStandardMaterial for all instances.
 * Wear is procedural from world/local position (no bitmaps, no UVs).
 * Vertex path never displaces mass; missing panel is a shaded void only.
 */

import {
  Color,
  MeshStandardMaterial,
  Vector2,
  type IUniform,
} from 'three'
import { LAND_USE_COLORS, type LandUseViewMode } from './landUse.ts'
import {
  assignMixedMaterial,
  materialId,
  toneHex,
  type MaterialityParams,
  type ShellMaterial,
} from './materiality.ts'

export type WearUniformBag = {
  uWearLayers: IUniform // xyzw: grime, rain, rust, chalk (strength * on)
  uWearLayers2: IUniform // xy: salt, moss; z: missingPanel on; w: unused
  uToneBrick: IUniform
  uToneConcrete: IUniform
  uTonePlaster: IUniform
  uToneMetal: IUniform
  uGeoGate: IUniform // Vector2: x = panel gate wear
  /** 0 = land use, 1 = stage, 2 = both (type shape + light stage). */
  uTintMode: IUniform
  uStageNew: IUniform
  uStageSettled: IUniform
  uStageAbandoned: IUniform
  uStageReclaimed: IUniform
  uLandIndustry: IUniform
  uLandCommerce: IUniform
  uLandHousing: IUniform
  uLandCivic: IUniform
  uLandPark: IUniform
  uLandFarm: IUniform
  uLandYard: IUniform
}

const ATTR_BLOCK = /* glsl */ `
attribute float aMatId;
attribute float aWear;
attribute float aFailSide;
attribute float aSeed;
attribute float aStage;
attribute float aLandUse;
varying float vMatId;
varying float vWear;
varying float vFailSide;
varying float vSeed;
varying float vStage;
varying float vLandUse;
varying vec3 vLocal;
varying vec3 vWorld;
`

const VERTEX_CHUNK = /* glsl */ `
#include <begin_vertex>
vMatId = aMatId;
vWear = aWear;
vFailSide = aFailSide;
vSeed = aSeed;
vStage = aStage;
vLandUse = aLandUse;
vLocal = position;
#ifdef USE_INSTANCING
  vec4 decayWorld = instanceMatrix * vec4(transformed, 1.0);
  decayWorld = modelMatrix * decayWorld;
  vWorld = decayWorld.xyz;
#else
  vWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif
`

const FRAG_HEADER = /* glsl */ `
varying float vMatId;
varying float vWear;
varying float vFailSide;
varying float vSeed;
varying float vStage;
varying float vLandUse;
varying vec3 vLocal;
varying vec3 vWorld;
uniform vec4 uWearLayers;
uniform vec4 uWearLayers2;
uniform vec3 uToneBrick;
uniform vec3 uToneConcrete;
uniform vec3 uTonePlaster;
uniform vec3 uToneMetal;
uniform vec2 uGeoGate;
uniform float uTintMode;
uniform vec3 uStageNew;
uniform vec3 uStageSettled;
uniform vec3 uStageAbandoned;
uniform vec3 uStageReclaimed;
uniform vec3 uLandIndustry;
uniform vec3 uLandCommerce;
uniform vec3 uLandHousing;
uniform vec3 uLandCivic;
uniform vec3 uLandPark;
uniform vec3 uLandFarm;
uniform vec3 uLandYard;

float decayHash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float decayValueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = decayHash21(i);
  float b = decayHash21(i + vec2(1.0, 0.0));
  float c = decayHash21(i + vec2(0.0, 1.0));
  float d = decayHash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
`

const FRAG_CHUNK = /* glsl */ `
#include <color_fragment>

float wear = clamp(vWear, 0.0, 3.0);
float settled = smoothstep(0.15, 1.0, wear);
float abandoned = smoothstep(0.95, 2.05, wear);
float reclaim = smoothstep(2.1, 2.95, wear);

float grimeS = uWearLayers.x;
float rainS = uWearLayers.y;
float rustS = uWearLayers.z;
float chalkS = uWearLayers.w;
float saltS = uWearLayers2.x;
float mossS = uWearLayers2.y;
float panelOn = uWearLayers2.z;

// Local box: y in [-0.5, 0.5] → relY 0 at floor, 1 at roof.
float relY = clamp(vLocal.y + 0.5, 0.0, 1.0);
float ax = abs(vLocal.x);
float az = abs(vLocal.z);
float edge = max(smoothstep(0.42, 0.5, ax), smoothstep(0.42, 0.5, az));
float face = 1.0 - edge;

// Which local face (same encoding as fail side).
float side = ax > az
  ? (vLocal.x >= 0.0 ? 1.0 : 3.0)
  : (vLocal.z >= 0.0 ? 2.0 : 0.0);
float onFail = step(0.5, 1.0 - abs(side - vFailSide));

vec3 baseTone = uToneBrick;
if (vMatId > 0.5 && vMatId < 1.5) baseTone = uToneConcrete;
else if (vMatId > 1.5 && vMatId < 2.5) baseTone = uTonePlaster;
else if (vMatId > 2.5) baseTone = uToneMetal;

float isBrick = 1.0 - step(0.5, abs(vMatId - 0.0));
float isMetal = step(2.5, vMatId);
float isPlaster = 1.0 - step(0.5, abs(vMatId - 2.0));
float isConcrete = 1.0 - step(0.5, abs(vMatId - 1.0));

// Corrugation cue on metal — color only, no vertex move.
float plate = abs(fract(vLocal.y * 14.0 + vSeed * 0.1) - 0.5);
vec3 col = baseTone;
col = mix(col, col * 0.78, isMetal * smoothstep(0.3, 0.48, plate) * 0.4);

// World-space mottling (no UVs).
float blotch = decayValueNoise(vWorld.xz * 0.35 + vSeed * 3.1);
float blotch2 = decayValueNoise(vWorld.xz * 0.9 + vSeed * 7.7);

// —— Paint loss / chalking (settled+) ——
vec3 chalkCol = mix(baseTone, vec3(0.78, 0.72, 0.66), 0.7);
float chalkMask = face * (0.2 + 0.55 * blotch) * (1.0 - isMetal * 0.45);
col = mix(col, chalkCol, settled * chalkS * chalkMask * 0.85);

// —— Grime at base + under roof edges ——
float baseGrime = (1.0 - smoothstep(0.0, 0.22, relY));
float roofGrime = smoothstep(0.82, 0.98, relY);
float grimeMask = max(baseGrime, roofGrime * 0.75) * (0.55 + 0.45 * blotch2);
vec3 grimeCol = col * vec3(0.55, 0.52, 0.48);
col = mix(col, grimeCol, clamp(settled * grimeS * grimeMask, 0.0, 0.75));

// —— Vertical rain streaks (process, not speckles) ——
float streakId = floor((vWorld.x * cos(vSeed) + vWorld.z * sin(vSeed)) * 1.8 + vSeed * 11.0);
float streakChance = decayHash21(vec2(streakId, vSeed));
float streak = step(0.72, streakChance)
  * (1.0 - smoothstep(0.0, 0.08, abs(fract((vWorld.x + vWorld.z) * 1.8) - 0.5)))
  * smoothstep(1.0, 0.15, relY);
vec3 streakCol = col * vec3(0.62, 0.58, 0.54);
col = mix(col, streakCol, abandoned * rainS * streak * 0.55);

// —— Rust (metal heavy; edges elsewhere) ——
vec3 rustCol = vec3(0.52, 0.22, 0.08);
float rustMask = max(edge, isMetal * (0.35 + 0.4 * blotch));
float drip = step(0.9, decayHash21(vec2(streakId, vSeed + 2.3)))
  * smoothstep(0.95, 0.35, relY)
  * max(edge, isMetal * 0.4);
col = mix(col, rustCol, abandoned * rustS * rustMask * (0.45 + 0.35 * blotch));
col = mix(col, rustCol * 0.88, abandoned * rustS * drip * 0.5);

// —— Salt stains (brick only) ——
float saltPatch = smoothstep(0.55, 0.9, blotch2) * face;
vec3 saltCol = mix(col, vec3(0.72, 0.7, 0.66), 0.65);
col = mix(col, saltCol, abandoned * saltS * isBrick * saltPatch * 0.55);

// —— Moss / weeds from base ——
float mossBand = (1.0 - smoothstep(0.0, 0.18, relY)) * (0.4 + 0.6 * blotch);
vec3 mossCol = vec3(0.28, 0.34, 0.22);
col = mix(col, mix(col, mossCol, 0.7), reclaim * mossS * mossBand);

// Soft darkening into reclaim — mass stays readable.
col = mix(col, col * vec3(0.88, 0.86, 0.82), reclaim * face * 0.2);

// —— Missing wall panel (shaded void, not vertex dissolve). Caps at gate. ——
float along = side == 1.0 || side == 3.0 ? vLocal.z : vLocal.x;
float bay = 1.0 - smoothstep(0.12, 0.32, abs(along));
float storyBand = smoothstep(0.12, 0.22, relY) * (1.0 - smoothstep(0.38, 0.5, relY));
float panelMask = onFail * bay * storyBand;
float holeGate = smoothstep(uGeoGate.x, uGeoGate.x + 0.2, wear); // saturates; no further growth
float hole = panelOn * holeGate * panelMask;
vec3 voidCol = vec3(0.05, 0.055, 0.06);
col = mix(col, voidCol, hole * 0.9);
col = mix(col, rustCol, hole * edge * 0.4);

// —— Land use / stage tint (color only — no vertex move). ——
vec3 landCol = uLandHousing;
if (vLandUse < 0.5) landCol = uLandIndustry;
else if (vLandUse < 1.5) landCol = uLandCommerce;
else if (vLandUse < 2.5) landCol = uLandHousing;
else if (vLandUse < 3.5) landCol = uLandCivic;
else if (vLandUse < 4.5) landCol = uLandPark;
else if (vLandUse < 5.5) landCol = uLandFarm;
else landCol = uLandYard;

vec3 stageCol = uStageNew;
if (vStage > 0.5 && vStage < 1.5) stageCol = uStageSettled;
else if (vStage > 1.5 && vStage < 2.5) stageCol = uStageAbandoned;
else if (vStage > 2.5) stageCol = uStageReclaimed;

// uTintMode: 0 normal · 1 landUse · 2 stage · 3 both
if (uTintMode > 0.5 && uTintMode < 1.5) {
  col = mix(col, landCol, 0.88);
} else if (uTintMode > 1.5 && uTintMode < 2.5) {
  col = mix(col, stageCol, 0.82);
} else if (uTintMode > 2.5) {
  col = mix(col, landCol, 0.72);
  col = mix(col, stageCol, 0.28);
}
// normal (≤ 0.5): keep material / wear color — no land or stage wash

diffuseColor.rgb = col;
`

function tintModeValue(mode: LandUseViewMode): number {
  if (mode === 'normal') return 0
  if (mode === 'landUse') return 1
  if (mode === 'stage') return 2
  return 3
}

export function createWearUniforms(mat: MaterialityParams): WearUniformBag {
  return {
    uWearLayers: {
      value: layerVec4(mat),
    },
    uWearLayers2: {
      value: layerVec4b(mat),
    },
    uToneBrick: { value: new Color(toneHex(mat, 'brick')) },
    uToneConcrete: { value: new Color(toneHex(mat, 'concrete')) },
    uTonePlaster: { value: new Color(toneHex(mat, 'plaster')) },
    uToneMetal: { value: new Color(toneHex(mat, 'metal')) },
    uGeoGate: { value: new Vector2(2.15, 0) },
    uTintMode: { value: 0 },
    uStageNew: { value: new Color('#e8e2d6') },
    uStageSettled: { value: new Color('#d4a017') },
    uStageAbandoned: { value: new Color('#a84828') },
    uStageReclaimed: { value: new Color('#6b7260') },
    uLandIndustry: { value: new Color(LAND_USE_COLORS.industry) },
    uLandCommerce: { value: new Color(LAND_USE_COLORS.commerce) },
    uLandHousing: { value: new Color(LAND_USE_COLORS.housing) },
    uLandCivic: { value: new Color(LAND_USE_COLORS.civic) },
    uLandPark: { value: new Color(LAND_USE_COLORS.park) },
    uLandFarm: { value: new Color(LAND_USE_COLORS.farm) },
    uLandYard: { value: new Color(LAND_USE_COLORS.yard) },
  }
}

function layerVec4(mat: MaterialityParams) {
  return {
    x: mat.grime.on ? mat.grime.strength : 0,
    y: mat.rainStreaks.on ? mat.rainStreaks.strength : 0,
    z: mat.rust.on ? mat.rust.strength : 0,
    w: mat.chalk.on ? mat.chalk.strength : 0,
  }
}

function layerVec4b(mat: MaterialityParams) {
  return {
    x: mat.salt.on ? mat.salt.strength : 0,
    y: mat.moss.on ? mat.moss.strength : 0,
    z: mat.missingPanel ? 1 : 0,
    w: 0,
  }
}

export function syncWearUniforms(
  u: WearUniformBag,
  mat: MaterialityParams,
  tintMode: LandUseViewMode = 'normal',
) {
  Object.assign(u.uWearLayers.value, layerVec4(mat))
  Object.assign(u.uWearLayers2.value, layerVec4b(mat))
  ;(u.uToneBrick.value as Color).set(toneHex(mat, 'brick'))
  ;(u.uToneConcrete.value as Color).set(toneHex(mat, 'concrete'))
  ;(u.uTonePlaster.value as Color).set(toneHex(mat, 'plaster'))
  ;(u.uToneMetal.value as Color).set(toneHex(mat, 'metal'))
  u.uTintMode.value = tintModeValue(tintMode)
  ;(u.uLandIndustry.value as Color).set(LAND_USE_COLORS.industry)
  ;(u.uLandCommerce.value as Color).set(LAND_USE_COLORS.commerce)
  ;(u.uLandHousing.value as Color).set(LAND_USE_COLORS.housing)
  ;(u.uLandCivic.value as Color).set(LAND_USE_COLORS.civic)
  ;(u.uLandPark.value as Color).set(LAND_USE_COLORS.park)
  ;(u.uLandFarm.value as Color).set(LAND_USE_COLORS.farm)
  ;(u.uLandYard.value as Color).set(LAND_USE_COLORS.yard)
}

export function createBuildingWearMaterial(mat: MaterialityParams): {
  material: MeshStandardMaterial
  uniforms: WearUniformBag
} {
  const uniforms = createWearUniforms(mat)
  const material = new MeshStandardMaterial({
    color: '#c4b6a4',
    roughness: 0.88,
    metalness: 0.04,
  })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWearLayers = uniforms.uWearLayers
    shader.uniforms.uWearLayers2 = uniforms.uWearLayers2
    shader.uniforms.uToneBrick = uniforms.uToneBrick
    shader.uniforms.uToneConcrete = uniforms.uToneConcrete
    shader.uniforms.uTonePlaster = uniforms.uTonePlaster
    shader.uniforms.uToneMetal = uniforms.uToneMetal
    shader.uniforms.uGeoGate = uniforms.uGeoGate
    shader.uniforms.uTintMode = uniforms.uTintMode
    shader.uniforms.uStageNew = uniforms.uStageNew
    shader.uniforms.uStageSettled = uniforms.uStageSettled
    shader.uniforms.uStageAbandoned = uniforms.uStageAbandoned
    shader.uniforms.uStageReclaimed = uniforms.uStageReclaimed
    shader.uniforms.uLandIndustry = uniforms.uLandIndustry
    shader.uniforms.uLandCommerce = uniforms.uLandCommerce
    shader.uniforms.uLandHousing = uniforms.uLandHousing
    shader.uniforms.uLandCivic = uniforms.uLandCivic
    shader.uniforms.uLandPark = uniforms.uLandPark
    shader.uniforms.uLandFarm = uniforms.uLandFarm
    shader.uniforms.uLandYard = uniforms.uLandYard

    shader.vertexShader = ATTR_BLOCK + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      VERTEX_CHUNK,
    )

    shader.fragmentShader = FRAG_HEADER + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      FRAG_CHUNK,
    )
  }
  material.customProgramCacheKey = () => 'decay-building-wear-v4-land'
  material.needsUpdate = true
  return { material, uniforms }
}

/** Resolve per-instance mat id from materiality + building stats. */
export function resolveMatId(
  mat: MaterialityParams,
  stories: number,
  maxStories: number,
  x: number,
  z: number,
  halfExtent: number,
): number {
  const kind: ShellMaterial =
    mat.material === 'mixed'
      ? assignMixedMaterial(stories, maxStories, x, z, halfExtent, mat.mixedRule)
      : mat.material
  return materialId(kind)
}

/** Deterministic 0–1 seed from plot id (no Math.random). */
export function seedFromPlot(plotId: number): number {
  let n = plotId * 374761393 + 668265263
  n = (n ^ (n >>> 13)) * 1274126177
  return ((n >>> 0) % 10000) / 10000
}
