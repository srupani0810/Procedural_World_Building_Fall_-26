/**
 * SimCity-style grid field maps for DECAY buildings.
 * Height / Size / Slope influence — deterministic noise + paint. No Math.random.
 */

import { createNoise, type TerrainParams } from '../terrainParams.ts'
import { DECAY_FIELD_HALF, DECAY_FIELD_SIZE } from './params.ts'

export type FieldKind = 'height' | 'size' | 'slope'

export type FieldNoiseSpec = {
  /** World-space frequency for the base noise. */
  frequency: number
  /** Mix of noise into the field (rest is fill). */
  amplitude: number
  /** Constant base fill 0–1 before noise. */
  fill: number
  /** Extra octave count (1–4). */
  octaves: number
}

export type FieldMaps = {
  res: number
  height: Float32Array
  size: Float32Array
  slope: Float32Array
  heightSpec: FieldNoiseSpec
  sizeSpec: FieldNoiseSpec
  slopeSpec: FieldNoiseSpec
}

export const defaultHeightSpec: FieldNoiseSpec = {
  frequency: 0.012,
  amplitude: 0.55,
  fill: 0.35,
  octaves: 3,
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

/** Value noise from integer lattice — deterministic, no Math.random. */
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

function fbm(x: number, z: number, spec: FieldNoiseSpec, salt: number) {
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
      const n = fbm(x * spec.frequency, z * spec.frequency, spec, salt)
      out[iz * res + ix] = clamp01(spec.fill + (n - 0.5) * 2 * spec.amplitude)
    }
  }
}

/** Optional: bias height field with terrain amplitude so hills read taller. */
export function fillHeightWithTerrainHint(
  out: Float32Array,
  res: number,
  spec: FieldNoiseSpec,
  terrain: TerrainParams,
) {
  const sample = createNoise(terrain)
  const amp = Math.max(0.15, terrain.amplitude)
  fillFieldFromSpec(out, res, spec, 11)
  for (let iz = 0; iz < res; iz++) {
    for (let ix = 0; ix < res; ix++) {
      const x = -DECAY_FIELD_HALF + (ix / (res - 1)) * DECAY_FIELD_SIZE
      const z = -DECAY_FIELD_HALF + (iz / (res - 1)) * DECAY_FIELD_SIZE
      const h = sample(x, z)
      const hint = clamp01(0.5 + h / (amp * 2))
      const i = iz * res + ix
      out[i] = clamp01(out[i]! * 0.75 + hint * 0.25)
    }
  }
}

export function createDefaultFieldMaps(terrain: TerrainParams): FieldMaps {
  const res = FIELD_RES
  const height = createEmptyField(res)
  const size = createEmptyField(res)
  const slope = createEmptyField(res)
  const heightSpec = { ...defaultHeightSpec }
  const sizeSpec = { ...defaultSizeSpec }
  const slopeSpec = { ...defaultSlopeSpec }
  fillHeightWithTerrainHint(height, res, heightSpec, terrain)
  fillFieldFromSpec(size, res, sizeSpec, 29)
  fillFieldFromSpec(slope, res, slopeSpec, 47)
  return { res, height, size, slope, heightSpec, sizeSpec, slopeSpec }
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

export function resetField(
  maps: FieldMaps,
  kind: FieldKind,
  terrain: TerrainParams,
): FieldMaps {
  const next = {
    ...maps,
    height: maps.height.slice(),
    size: maps.size.slice(),
    slope: maps.slope.slice(),
    heightSpec: { ...maps.heightSpec },
    sizeSpec: { ...maps.sizeSpec },
    slopeSpec: { ...maps.slopeSpec },
  }
  if (kind === 'height') fillHeightWithTerrainHint(next.height, next.res, next.heightSpec, terrain)
  else if (kind === 'size') fillFieldFromSpec(next.size, next.res, next.sizeSpec, 29)
  else fillFieldFromSpec(next.slope, next.res, next.slopeSpec, 47)
  return next
}

export function fieldArray(maps: FieldMaps, kind: FieldKind): Float32Array {
  if (kind === 'height') return maps.height
  if (kind === 'size') return maps.size
  return maps.slope
}

export function heatmapColor(t: number): [number, number, number] {
  const v = clamp01(t)
  // bone → amber → rust (readable on dark ground)
  if (v < 0.5) {
    const u = v * 2
    return [0.55 + 0.35 * u, 0.5 + 0.2 * u, 0.42 - 0.1 * u]
  }
  const u = (v - 0.5) * 2
  return [0.9 - 0.2 * u, 0.7 - 0.45 * u, 0.32 - 0.15 * u]
}
