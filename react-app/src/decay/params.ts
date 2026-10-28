/**
 * DECAY tab params — terrain only for now (settlement stripped; rebuild incrementally).
 */

import { defaultTerrainParams, type TerrainParams } from '../terrainParams.ts'

/** Independent terrain defaults — edits here do not touch Weathering / Noise tabs. */
export function createDefaultDecayTerrain(): TerrainParams {
  return {
    ...defaultTerrainParams,
    extras: { ...defaultTerrainParams.extras },
  }
}

export const DECAY_SKY = '#3a4046'
export const DECAY_FOG = DECAY_SKY

export type DecayViewParams = {
  fogDensity: number
}

export const defaultDecayView: DecayViewParams = {
  fogDensity: 0.045,
}
