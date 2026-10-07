import type { GradientStop } from './heightGradient.ts'
import { defaultTerrainParams, type TerrainParams } from './terrainParams.ts'
import { defaultVoxelParams, type VoxelParams } from './voxelParams.ts'

export type EpParams = {
  /** Soft mist fog density (Voxel Cloud depth). */
  fogDensity: number
  /** Filigree / porous grain on the EP material (0–2). */
  glitchIntensity: number
}

export const defaultEpParams: EpParams = {
  /**
   * Slider thickness for linear Fog: higher → opaque sooner past EP_FOG_NEAR.
   * Near field stays clear; density only tightens the horizon fade.
   */
  fogDensity: 0.045,
  glitchIntensity: 0.65,
}

/**
 * EP-owned terrain defaults — independent copy of the shared terrain defaults so
 * Noise / Voxels / Shaders edits never mutate the Playground field.
 */
export function createDefaultEpTerrain(): TerrainParams {
  return {
    ...defaultTerrainParams,
    extras: { ...defaultTerrainParams.extras },
  }
}

/**
 * EP-owned voxel/world defaults — Interactive streaming only; not linked to
 * Voxels `voxelParams` or Shaders study mesh settings.
 */
export function createDefaultEpVoxel(): VoxelParams {
  return {
    ...defaultVoxelParams,
    renderMode: 'interactive',
    resolution: 16,
    /** Keep modest — 3D Chebyshev cost is (2r+1)³; endless feel comes from ground + fog. */
    loadRadius: 2,
    isolevel: 0,
    bleed: 0.12,
    volume: 0.15,
    overlap: 1,
  }
}

/** Near-black sky / clear-color — also used for fog so haze has no color seam. */
export const EP_SKY_COLOR = '#0c0d10'

/** Fog matches background exactly (seamless fade into haze). */
export const EP_FOG_COLOR = EP_SKY_COLOR

/**
 * First-person (Jump In): fog starts at this distance — nearby ground stays clear,
 * horizon softens into an endless haze as you walk.
 */
export const EP_FOG_NEAR_FP = 22

/**
 * Orbit / overview: clear through near–mid range; haze only near the field rim.
 * Tuned to sit just inside a ~80-unit ground half-extent so the edge soft-fades.
 */
export const EP_FOG_NEAR_ORBIT = 54

/** @deprecated use EP_FOG_NEAR_FP — kept for any stray imports */
export const EP_FOG_NEAR = EP_FOG_NEAR_FP

export function epFogNear(firstPerson: boolean) {
  return firstPerson ? EP_FOG_NEAR_FP : EP_FOG_NEAR_ORBIT
}

/**
 * Linear Fog far (full opacity).
 * FP: higher `fogDensity` pulls the opaque horizon in (endless-walk haze).
 * Orbit: light rim fade at the loaded field edge (near–mid stay readable).
 */
export function epFogFar(fogDensity: number, firstPerson = true) {
  const minD = 0.02
  const maxD = 0.15
  const t = Math.min(1, Math.max(0, (fogDensity - minD) / (maxD - minD)))
  if (!firstPerson) {
    // Soft boundary haze only — density gently pulls the rim in (82 → 70)
    return 82 - t * 12
  }
  // density 0.02 → far 110; 0.15 → far ~46 (thick walk horizon, still past near)
  const farMin = EP_FOG_NEAR_FP + 24
  const farMax = 110
  return farMax + (farMin - farMax) * t
}

/** Ground / water half-extent budget — past FP fog so Jump In never reveals a rim. */
export function epFogReach(fogDensity: number) {
  return Math.max(epFogFar(fogDensity, true), epFogFar(fogDensity, false) + 8)
}

/** Dark water under the blocky islands. */
export const EP_WATER_COLOR = '#1a1e24'

/** Height colors for EP Interactive mesh only. */
export const EP_TOWN_GRADIENT: GradientStop[] = [
  { id: 'ep-deep', position: 0, color: '#1a1c20' },
  { id: 'ep-low', position: 0.28, color: '#2c3038' },
  { id: 'ep-mid', position: 0.55, color: '#4a505a' },
  { id: 'ep-high', position: 0.78, color: '#6e7682' },
  { id: 'ep-crest', position: 1, color: '#9aa1ab' },
]

/** Fixed scaffold-link density for pale filigree spans. */
export const EP_SCAFFOLD_DENSITY = 0.38
