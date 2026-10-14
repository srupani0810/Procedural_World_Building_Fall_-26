/**
 * Water mask for Weathering.
 * A noise field of its own picks wetland patches. Terrain height then keeps
 * those patches off the high ground. Later steps read the grid through
 * `waterMaskAt` / `readWaterMask`.
 */
import FastNoiseLite from 'fastnoise-lite'

export type WaterMask = {
  /** World X of column 0. */
  originX: number
  /** World Z of row 0. */
  originZ: number
  cellSize: number
  resolution: number
  /** Row-major, 0 land, 1 water. Solid core used by click-to-build. */
  cells: Uint8Array
  /** Row-major 0–1 wetness. The mesh fades out through the low values. */
  field: Float32Array
  /** Water surface does not climb above this height. */
  surfaceCeiling: number
}

export type WaterMaskOptions = {
  /** World center of the mask. */
  originX?: number
  originZ?: number
  /** Full width and depth of the mask, in world units. */
  size?: number
  resolution?: number
  /** 0–1 share of the water-noise field allowed to be wet. Sets the threshold. */
  coverage?: number
  /** World-space frequency of the water noise. Independent of terrain frequency. */
  frequency?: number
  /**
   * Noise at or below this value can be water.
   * Coverage writes this from the noise field's spread, so the percent matches the wet share.
   */
  threshold?: number
}

/** Coverage and the threshold slider are the same cutoff. */
export const WATER_THRESHOLD_MIN = -1
export const WATER_THRESHOLD_MAX = 1

/** Spread of the water-noise field, so a coverage percent matches that share of the field. */
const WATER_NOISE_SIGMA = 0.38

/** Inverse standard-normal CDF (Acklam). Maps a 0–1 share onto a noise cutoff. */
function inverseNorm(p: number) {
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2,
    -3.066479806614716e1, 2.506628277459239,
  ]
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1,
    -1.328068155288572e1,
  ]
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734,
    4.374664141464968, 2.938163982698783,
  ]
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416]
  const plow = 0.02425
  const phigh = 1 - plow
  let q: number
  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p))
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    )
  }
  if (p > phigh) {
    q = Math.sqrt(-2 * Math.log(1 - p))
    return (
      -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    )
  }
  q = p - 0.5
  const r = q * q
  return (
    ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  )
}

function normalCdf(x: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989422804 * Math.exp((-x * x) / 2)
  const p =
    d *
    t *
    (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  return x >= 0 ? 1 - p : p
}

export function coverageToThreshold(coverage: number) {
  const p = Math.min(0.999, Math.max(0.001, coverage))
  const cutoff = WATER_NOISE_SIGMA * inverseNorm(p)
  return Math.min(WATER_THRESHOLD_MAX, Math.max(WATER_THRESHOLD_MIN, cutoff))
}

export function thresholdToCoverage(threshold: number) {
  return Math.min(1, Math.max(0, normalCdf(threshold / WATER_NOISE_SIGMA)))
}

let activeMask: WaterMask | null = null

/** Published by the weathering scene whenever the water field changes. */
export function publishWaterMask(mask: WaterMask | null) {
  activeMask = mask
}

export function readWaterMask() {
  return activeMask
}

/** 1 when (x, z) falls inside a water cell of the mask. Outside the grid is land. */
export function waterMaskAt(mask: WaterMask | null, x: number, z: number) {
  if (!mask) return 0
  const ix = Math.floor((x - mask.originX) / mask.cellSize)
  const iz = Math.floor((z - mask.originZ) / mask.cellSize)
  if (ix < 0 || iz < 0 || ix >= mask.resolution || iz >= mask.resolution) return 0
  return mask.cells[iz * mask.resolution + ix]
}

function cellIndex(resolution: number, ix: number, iz: number) {
  return iz * resolution + ix
}

/** Separable box blur. Softens the noise field into lake-sized patches. */
function blurGrid(source: Float32Array, resolution: number, radius: number) {
  const tmp = new Float32Array(source.length)
  const out = new Float32Array(source.length)
  for (let iz = 0; iz < resolution; iz++) {
    for (let ix = 0; ix < resolution; ix++) {
      let sum = 0
      let count = 0
      for (let k = -radius; k <= radius; k++) {
        const x = ix + k
        if (x < 0 || x >= resolution) continue
        sum += source[iz * resolution + x]
        count++
      }
      tmp[iz * resolution + ix] = sum / count
    }
  }
  for (let iz = 0; iz < resolution; iz++) {
    for (let ix = 0; ix < resolution; ix++) {
      let sum = 0
      let count = 0
      for (let k = -radius; k <= radius; k++) {
        const z = iz + k
        if (z < 0 || z >= resolution) continue
        sum += tmp[z * resolution + ix]
        count++
      }
      out[iz * resolution + ix] = sum / count
    }
  }
  return out
}

function percentile(values: Float32Array, p: number) {
  const sorted = Array.from(values).sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))
  return sorted[index]
}

function smooth01(t: number) {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

/** 1 below cutoff − band, 0 above cutoff + band, smooth between. */
function fadeBelow(value: number, cutoff: number, band: number) {
  const span = Math.max(1e-4, band * 2)
  return smooth01((cutoff + band - value) / span)
}

/** Dedicated field. Seed stays off the terrain noise so the two patterns diverge. */
function createWaterNoise(frequency: number) {
  const noise = new FastNoiseLite(4181)
  noise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2)
  noise.SetFrequency(Math.max(0.0001, frequency))
  noise.SetFractalType(FastNoiseLite.FractalType.FBm)
  noise.SetFractalOctaves(3)
  noise.SetFractalLacunarity(2)
  noise.SetFractalGain(0.5)
  return (x: number, z: number) => noise.GetNoise(x, z)
}

/**
 * Wet where the water noise is at or below the threshold and the ground is
 * in the lower part of the heightfield. High ground stays dry.
 */
export function buildWaterMask(
  heightAt: (x: number, z: number) => number,
  options: WaterMaskOptions = {},
): WaterMask {
  const resolution = Math.max(16, Math.round(options.resolution ?? 96))
  const size = Math.max(resolution, options.size ?? 520)
  const cellSize = size / resolution
  const originX = (options.originX ?? 0) - size / 2
  const originZ = (options.originZ ?? 0) - size / 2
  const threshold =
    options.threshold ?? coverageToThreshold(options.coverage ?? 0.45)
  const sampleNoise = createWaterNoise(options.frequency ?? 0.012)

  const noiseGrid = new Float32Array(resolution * resolution)
  const heightGrid = new Float32Array(resolution * resolution)
  for (let iz = 0; iz < resolution; iz++) {
    for (let ix = 0; ix < resolution; ix++) {
      const x = originX + (ix + 0.5) * cellSize
      const z = originZ + (iz + 0.5) * cellSize
      const index = cellIndex(resolution, ix, iz)
      noiseGrid[index] = sampleNoise(x, z)
      heightGrid[index] = heightAt(x, z)
    }
  }

  const soft = blurGrid(noiseGrid, resolution, 3)
  const surfaceCeiling = percentile(heightGrid, 0.7)
  const low = percentile(heightGrid, 0.2)
  const heightBand = Math.max(0.04, (surfaceCeiling - low) * 0.22)
  const noiseBand = 0.16
  const raw = new Float32Array(resolution * resolution)
  for (let i = 0; i < raw.length; i++) {
    const noiseFade = fadeBelow(soft[i], threshold, noiseBand)
    const heightFade = fadeBelow(heightGrid[i], surfaceCeiling, heightBand)
    raw[i] = noiseFade * heightFade
  }
  const field = blurGrid(raw, resolution, 2)
  const cells = new Uint8Array(resolution * resolution)
  for (let i = 0; i < cells.length; i++) cells[i] = field[i] >= 0.5 ? 1 : 0

  return { originX, originZ, cellSize, resolution, cells, field, surfaceCeiling }
}
