/**
 * Copied Weathering/EP world defaults for Weathering v2 only.
 * Independent of weathering/epParams.ts.
 */
import { defaultTerrainParams } from '../terrainParams.ts'
import type { TerrainParams } from '../terrainParams.ts'
import { defaultVoxelParams } from '../voxelParams.ts'
import type { VoxelParams } from '../voxelParams.ts'

export function createDefaultV2Terrain(): TerrainParams {
  return {
    ...defaultTerrainParams,
    extras: { ...defaultTerrainParams.extras },
  }
}

export function createDefaultV2Voxel(): VoxelParams {
  return {
    ...defaultVoxelParams,
    renderMode: 'interactive',
    resolution: 16,
    loadRadius: 2,
    isolevel: 0,
    bleed: 0.12,
    volume: 0.15,
    overlap: 1,
  }
}
