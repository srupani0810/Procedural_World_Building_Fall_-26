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
  fogDensity: 0.04,
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
    loadRadius: 1,
    isolevel: 0,
    bleed: 0.12,
    volume: 0.15,
    overlap: 1,
  }
}

/** Dark mist / clear-color — Voxel Cloud atmosphere. */
export const EP_FOG_COLOR = '#14161a'

/** Near-black sky behind the mist. */
export const EP_SKY_COLOR = '#0c0d10'

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
