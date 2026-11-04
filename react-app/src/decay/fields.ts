/**
 * SimCity-style grid field maps for DECAY buildings.
 * Height: FastNoiseLite district + plot layers, center blend, paint.
 * Deterministic. No Math.random.
 */

import FastNoiseLite from 'fastnoise-lite'
import type { TerrainParams } from '../terrainParams.ts'
import { DECAY_FIELD_HALF, DECAY_FIELD_SIZE } from './params.ts'

export type FieldKind = 'height' | 'size' | 'slope'

export type HeightNoiseId =
  | 'perlin'
  | 'simplex'
  | 'value'
  | 'fbm'
  | 'ridged'
  | 'cellular'

export type HeightHeatView = 'combined' | 'district' | 'plot'

export const HEIGHT_NOISE_OPTIONS: { id: HeightNoiseId; label: string }[] = [
  { id: 'perlin', label: 'Perlin' },
  { id: 'simplex', label: 'Simplex' },
  { id: 'value', label: 'Value' },
  { id: 'fbm', label: 'fBm' },
  { id: 'ridged', label: 'Ridged' },
  { id: 'cellular', label: 'Cellular' },
]

/**
 * Height noise — shared type/seed/octaves/contrast/offset;
 * two spatial scales + mix; center/edge blend on the combined field.
 */
export type HeightNoiseSpec = {
  noiseId: HeightNoiseId
  seed: number
  octaves: number
  contrast: number
  offset: number
  /**
   * District (large) world frequency.
   * Default ~0.004 → wavelength ~250 ≈ 8 blocks at blockSize 30.
   */
  districtScale: number
  /**
   * Plot (small) world frequency.
   * Default ~0.045 → wavelength ~22 ≈ 1–2 plots.
   */
  plotScale: number
  /** 0 = all plot, 1 = all district. Default 0.65 = 65% district. */
  districtMix: number
  /** Heat-map view of which layer. */
  heatView: HeightHeatView
  /** Lift field toward center (0–1). Default 0.35. */
  centerRise: number
  /** Lower field near outer ring (0–1). Default 0.5. */
  edgeFalloff: number
  /** Rim radius of the raised core (0–1). Default 0.42. */
  centerSize: number
}

export type FieldNoiseSpec = {
  frequency: number
  amplitude: number
  fill: number
  octaves: number
}

export type FieldMaps = {
  res: number
  /** Combined field after mix + center blend (+ paint). */
  height: Float32Array
  /** District layer alone (0–1), pre-mix / pre-blend. */
  heightDistrict: Float32Array
  /** Plot layer alone (0–1), pre-mix / pre-blend. */
  heightPlot: Float32Array
  size: Float32Array
  slope: Float32Array
  heightSpec: HeightNoiseSpec
  sizeSpec: FieldNoiseSpec
  slopeSpec: FieldNoiseSpec
}

export const defaultHeightSpec: HeightNoiseSpec = {
  noiseId: 'fbm',
  seed: 11,
  octaves: 3,
  contrast: 1.1,
  offset: 0.35,
  districtScale: 0.004,
  plotScale: 0.045,
  districtMix: 0.65,
  heatView: 'combined',
  centerRise: 0.35,
  edgeFalloff: 0.5,
  centerSize: 0.42,
}

export const defaultSizeSpec: FieldNoiseSpec = {
  frequency: 0.018,
  amplitude: 0.4,
  fill: 0.55,
  octaves: 2,
}

export const defaultSlopeSpec: FieldNoiseSpec = {
  frequency: 0.01,
  amplitude: 0.35,
  fill: 0.45,
  octaves: 2,
}

export const FIELD_RES = 64

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}

function hash2(ix: number, iz: number, salt: number) {
  let n = ix * 374761393 + iz * 668265263 + salt * 982451653
  n = (n ^ (n >> 13)) * 1274126177
  n = n ^ (n >> 16)
  return (n >>> 0) / 4294967295
}

function smoothstep(t: number) {
  return t * t * (3 - 2 * t)
}

function valueNoise2(x: number, z: number, salt: number) {
  const x0 = Math.floor(x)
  const z0 = Math.floor(z)
  const fx = smoothstep(x - x0)
  const fz = smoothstep(z - z0)
  const a = hash2(x0, z0, salt)
  const b = hash2(x0 + 1, z0, salt)
  const c = hash2(x0, z0 + 1, salt)
  const d = hash2(x0 + 1, z0 + 1, salt)
  const ab = a + (b - a) * fx
  const cd = c + (d - c) * fx
  return ab + (cd - ab) * fz
}

function fbmLegacy(x: number, z: number, spec: FieldNoiseSpec, salt: number) {
  let amp = 1
  let freq = 1
  let sum = 0
  let norm = 0
  const oct = Math.max(1, Math.min(4, Math.round(spec.octaves)))
  for (let o = 0; o < oct; o++) {
    sum += amp * valueNoise2(x * freq, z * freq, salt + o * 97)
    norm += amp
    amp *= 0.5
    freq *= 2
  }
  return norm > 0 ? sum / norm : 0
}

function worldToCell(x: number, z: number, res: number) {
  const u = (x + DECAY_FIELD_HALF) / DECAY_FIELD_SIZE
  const v = (z + DECAY_FIELD_HALF) / DECAY_FIELD_SIZE
  const gx = u * (res - 1)
  const gz = v * (res - 1)
  return { gx, gz }
}

export function createEmptyField(res = FIELD_RES): Float32Array {
  return new Float32Array(res * res)
}

function configureHeightNoise(
  noise: FastNoiseLite,
  spec: HeightNoiseSpec,
  frequency: number,
) {
  const oct = Math.max(1, Math.min(8, Math.round(spec.octaves)))
  noise.SetFrequency(Math.max(0.00005, frequency))
  noise.SetFractalOctaves(oct)

  switch (spec.noiseId) {
    case 'perlin':
      noise.SetNoiseType(FastNoiseLite.NoiseType.Perlin)
      noise.SetFractalType(
        oct === 1 ? FastNoiseLite.FractalType.None : FastNoiseLite.FractalType.FBm,
      )
      noise.SetFractalLacunarity(2)
      noise.SetFractalGain(0.5)
      break
    case 'simplex':
      noise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2)
      noise.SetFractalType(
        oct === 1 ? FastNoiseLite.FractalType.None : FastNoiseLite.FractalType.FBm,
      )
      noise.SetFractalLacunarity(2)
      noise.SetFractalGain(0.5)
      break
    case 'value':
      noise.SetNoiseType(FastNoiseLite.NoiseType.Value)
      noise.SetFractalType(
        oct === 1 ? FastNoiseLite.FractalType.None : FastNoiseLite.FractalType.FBm,
      )
      noise.SetFractalGain(0.5)
      break
    case 'fbm':
      noise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2)
      noise.SetFractalType(FastNoiseLite.FractalType.FBm)
      noise.SetFractalLacunarity(2)
      noise.SetFractalGain(0.5)
      break
    case 'ridged':
      noise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2)
      noise.SetFractalType(FastNoiseLite.FractalType.Ridged)
      noise.SetFractalGain(0.5)
      break
    case 'cellular':
      noise.SetNoiseType(FastNoiseLite.NoiseType.Cellular)
      noise.SetFractalType(FastNoiseLite.FractalType.None)
      noise.SetCellularReturnType(FastNoiseLite.CellularReturnType.CellValue)
      noise.SetCellularDistanceFunction(FastNoiseLite.CellularDistanceFunction.EuclideanSq)
      noise.SetCellularJitter(1)
      break
  }
}

function createLayerNoise(
  spec: HeightNoiseSpec,
  frequency: number,
  seedSalt: number,
) {
  const noise = new FastNoiseLite((spec.seed + seedSalt) | 0)
  configureHeightNoise(noise, spec, frequency)
  return (x: number, z: number) => noise.GetNoise(x, z)
}

function noiseTo01(n: number, spec: HeightNoiseSpec) {
  return clamp01(spec.offset + n * (Math.max(0, spec.contrast) * 0.5))
}

/** Rim 0 at origin … 1 at field edge (same as building forms). */
export function fieldRim(x: number, z: number) {
  return Math.min(1, Math.hypot(x, z) / Math.max(1, DECAY_FIELD_HALF))
}

/**
 * Center rise + edge falloff — only moves the 0–1 field value.
 * riseW = 1 inside centerSize rim, fades to 0 outside.
 */
export function applyCenterBlend(
  value: number,
  x: number,
  z: number,
  spec: HeightNoiseSpec,
): number {
  const rim = fieldRim(x, z)
  const centerSize = clamp01(spec.centerSize)
  const rise = clamp01(spec.centerRise)
  const edge = clamp01(spec.edgeFalloff)

  let v = clamp01(value)
  const riseW =
    centerSize <= 1e-6 ? 0 : 1 - smoothstep(Math.min(1, rim / Math.max(1e-6, centerSize)))
  v = v + rise * riseW * (1 - v)

  // Edge falloff: start lowering from (1 - edge) toward the rim.
  const fallStart = 1 - edge
  const edgeW = edge <= 1e-6 ? 0 : smoothstep((rim - fallStart) / Math.max(1e-6, edge))
  v = v * (1 - edgeW * edge)

  return clamp01(v)
}

/** Fill district, plot, and combined height grids. Paint applies later on `height`. */
export function fillHeightFromSpec(
  height: Float32Array,
  district: Float32Array,
  plot: Float32Array,
  res: number,
  spec: HeightNoiseSpec,
) {
  const districtSample = createLayerNoise(spec, spec.districtScale, 0)
  const plotSample = createLayerNoise(spec, spec.plotScale, 97)
  const mix = clamp01(spec.districtMix)

  for (let iz = 0; iz < res; iz++) {
    for (let ix = 0; ix < res; ix++) {
      const x = -DECAY_FIELD_HALF + (ix / (res - 1)) * DECAY_FIELD_SIZE
      const z = -DECAY_FIELD_HALF + (iz / (res - 1)) * DECAY_FIELD_SIZE
      const i = iz * res + ix
      const d = noiseTo01(districtSample(x, z), spec)
      const p = noiseTo01(plotSample(x, z), spec)
      district[i] = d
      plot[i] = p
      const combined = mix * d + (1 - mix) * p
      height[i] = applyCenterBlend(combined, x, z, spec)
    }
  }
}

export function fillFieldFromSpec(
  out: Float32Array,
  res: number,
  spec: FieldNoiseSpec,
  salt: number,
) {
  for (let iz = 0; iz < res; iz++) {
    for (let ix = 0; ix < res; ix++) {
      const x = -DECAY_FIELD_HALF + (ix / (res - 1)) * DECAY_FIELD_SIZE
      const z = -DECAY_FIELD_HALF + (iz / (res - 1)) * DECAY_FIELD_SIZE
      const n = fbmLegacy(x * spec.frequency, z * spec.frequency, spec, salt)
      out[iz * res + ix] = clamp01(spec.fill + (n - 0.5) * 2 * spec.amplitude)
    }
  }
}

export function createDefaultFieldMaps(_terrain?: TerrainParams): FieldMaps {
  const res = FIELD_RES
  const height = createEmptyField(res)
  const heightDistrict = createEmptyField(res)
  const heightPlot = createEmptyField(res)
  const size = createEmptyField(res)
  const slope = createEmptyField(res)
  const heightSpec = { ...defaultHeightSpec }
  const sizeSpec = { ...defaultSizeSpec }
  const slopeSpec = { ...defaultSlopeSpec }
  fillHeightFromSpec(height, heightDistrict, heightPlot, res, heightSpec)
  fillFieldFromSpec(size, res, sizeSpec, 29)
  fillFieldFromSpec(slope, res, slopeSpec, 47)
  return {
    res,
    height,
    heightDistrict,
    heightPlot,
    size,
    slope,
    heightSpec,
    sizeSpec,
    slopeSpec,
  }
}

export function sampleField(grid: Float32Array, res: number, x: number, z: number): number {
  const { gx, gz } = worldToCell(x, z, res)
  const x0 = Math.max(0, Math.min(res - 2, Math.floor(gx)))
  const z0 = Math.max(0, Math.min(res - 2, Math.floor(gz)))
  const fx = gx - x0
  const fz = gz - z0
  const i00 = z0 * res + x0
  const a = grid[i00]!
  const b = grid[i00 + 1]!
  const c = grid[i00 + res]!
  const d = grid[i00 + res + 1]!
  const ab = a + (b - a) * fx
  const cd = c + (d - c) * fx
  return clamp01(ab + (cd - ab) * fz)
}

export function paintField(
  grid: Float32Array,
  res: number,
  wx: number,
  wz: number,
  brushRadius: number,
  strength: number,
  raise: boolean,
) {
  const r = Math.max(1, brushRadius)
  const { gx: cx, gz: cz } = worldToCell(wx, wz, res)
  const cellR = (r / DECAY_FIELD_SIZE) * (res - 1)
  const x0 = Math.max(0, Math.floor(cx - cellR - 1))
  const x1 = Math.min(res - 1, Math.ceil(cx + cellR + 1))
  const z0 = Math.max(0, Math.floor(cz - cellR - 1))
  const z1 = Math.min(res - 1, Math.ceil(cz + cellR + 1))
  const sign = raise ? 1 : -1
  const mag = Math.max(0, Math.min(1, Math.abs(strength))) * 0.08
  for (let iz = z0; iz <= z1; iz++) {
    for (let ix = x0; ix <= x1; ix++) {
      const d = Math.hypot(ix - cx, iz - cz)
      if (d > cellR) continue
      const w = 1 - d / cellR
      const fall = w * w
      const i = iz * res + ix
      grid[i] = clamp01(grid[i]! + sign * mag * fall)
    }
  }
}

export function applyHeightNoisePatch(
  maps: FieldMaps,
  patch: Partial<HeightNoiseSpec>,
): FieldMaps {
  const heightSpec = { ...maps.heightSpec, ...patch }
  // Heat-map view toggle only — keep grids, skip regenerate.
  const keys = Object.keys(patch)
  if (keys.length === 1 && patch.heatView != null) {
    return { ...maps, heightSpec }
  }
  const height = maps.height.slice()
  const heightDistrict = maps.heightDistrict.slice()
  const heightPlot = maps.heightPlot.slice()
  fillHeightFromSpec(height, heightDistrict, heightPlot, maps.res, heightSpec)
  return {
    ...maps,
    height,
    heightDistrict,
    heightPlot,
    heightSpec,
    size: maps.size,
    slope: maps.slope,
    sizeSpec: { ...maps.sizeSpec },
    slopeSpec: { ...maps.slopeSpec },
  }
}

export function resetField(
  maps: FieldMaps,
  kind: FieldKind,
  _terrain?: TerrainParams,
): FieldMaps {
  const next: FieldMaps = {
    ...maps,
    height: maps.height.slice(),
    heightDistrict: maps.heightDistrict.slice(),
    heightPlot: maps.heightPlot.slice(),
    size: maps.size.slice(),
    slope: maps.slope.slice(),
    heightSpec: { ...maps.heightSpec },
    sizeSpec: { ...maps.sizeSpec },
    slopeSpec: { ...maps.slopeSpec },
  }
  if (kind === 'height') {
    next.heightSpec = { ...defaultHeightSpec }
    fillHeightFromSpec(
      next.height,
      next.heightDistrict,
      next.heightPlot,
      next.res,
      next.heightSpec,
    )
  } else if (kind === 'size') {
    fillFieldFromSpec(next.size, next.res, next.sizeSpec, 29)
  } else {
    fillFieldFromSpec(next.slope, next.res, next.slopeSpec, 47)
  }
  return next
}

export function fieldArray(maps: FieldMaps, kind: FieldKind): Float32Array {
  if (kind === 'height') {
    if (maps.heightSpec.heatView === 'district') return maps.heightDistrict
    if (maps.heightSpec.heatView === 'plot') return maps.heightPlot
    return maps.height
  }
  if (kind === 'size') return maps.size
  return maps.slope
}

export function heatmapColor(t: number): [number, number, number] {
  const v = clamp01(t)
  if (v < 0.5) {
    const u = v * 2
    return [0.55 + 0.35 * u, 0.5 + 0.2 * u, 0.42 - 0.1 * u]
  }
  const u = (v - 0.5) * 2
  return [0.9 - 0.2 * u, 0.7 - 0.45 * u, 0.32 - 0.15 * u]
}

export function heightNoiseRuleLine(spec: HeightNoiseSpec): string {
  return [
    `[height] noise ${spec.noiseId} · seed ${spec.seed}`,
    `districtScale ${spec.districtScale.toFixed(4)} · plotScale ${spec.plotScale.toFixed(4)}`,
    `mix ${spec.districtMix.toFixed(2)} (district)`,
    `centerRise ${spec.centerRise.toFixed(2)} · edgeFalloff ${spec.edgeFalloff.toFixed(2)} · centerSize ${spec.centerSize.toFixed(2)}`,
    `oct ${spec.octaves} · contrast ${spec.contrast.toFixed(2)} · offset ${spec.offset.toFixed(2)}`,
  ].join(' · ')
}
