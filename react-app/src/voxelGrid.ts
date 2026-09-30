import { createNoise, createNoise3D } from './terrainParams.ts'
import type { TerrainParams } from './terrainParams.ts'
import { VOXEL_WORLD_SIZE } from './voxelParams.ts'
import type { VoxelParams } from './voxelParams.ts'

/**
 * Step 1 output: a real N³ voxel grid.
 * Each cell stores one density sample at its center from density(x, y, z).
 */
export type VoxelGrid = {
  size: number
  densities: Float32Array
  half: number
  cellSize: number
}

function clamp(value: number, min: number, max: number) {
  return value < min ? min : value > max ? max : value
}

export function gridIndex(x: number, y: number, z: number, size: number) {
  return x + y * size + z * size * size
}

/**
 * density(x, y, z): positive ≈ solid, negative ≈ air (at isolevel 0).
 *
 * Same terrain field as the 3D tab (`Scene.tsx`):
 *   surfaceY = createNoise(terrain)(x, z) * terrain.height
 * Voxels fill solid columns under that surface (a voxelized heightfield),
 * instead of a separate island / shell volume.
 */
export function createDensityFunction(terrain: TerrainParams, voxel: VoxelParams) {
  const sample2 = createNoise(terrain)
  const sample3 = createNoise3D(terrain)
  const height = Math.max(terrain.height, 0.01)
  const volume = clamp(voxel.volume, 0, 2)
  // Match the 3D displacement range: noise ∈ [-1, 1] → surface ∈ [-height, height]
  const floorY = -height

  return (x: number, y: number, z: number) => {
    // Identical sampling to the 3D plane (local x,y → world x,z after rotation)
    const surface = sample2(x, z) * height

    // Outside the terrain slab (below the lowest possible surface)
    if (y < floorY) return y - floorY

    // Heightfield: solid below the surface, air above — same field as 3D
    let density = surface - y

    // Optional 3D noise carve (Volume slider); 0 keeps a pure 3D-tab match
    if (volume > 0.001) {
      density += sample3(x, y, z) * volume * height * 0.3
    }

    return density
  }
}

/** 3D blur so neighboring voxels bleed density into each other. */
export function applyBleed3D(densities: Float32Array, size: number, bleed: number): Float32Array {
  const amount = clamp(bleed, 0, 1)
  if (amount < 0.001) return densities.slice()

  const radius = Math.max(1, Math.round(amount * 2))
  const out = new Float32Array(densities.length)

  for (let iz = 0; iz < size; iz++) {
    for (let iy = 0; iy < size; iy++) {
      for (let ix = 0; ix < size; ix++) {
        let sum = 0
        let weight = 0
        for (let jz = -radius; jz <= radius; jz++) {
          for (let jy = -radius; jy <= radius; jy++) {
            for (let jx = -radius; jx <= radius; jx++) {
              const x = ix + jx
              const y = iy + jy
              const z = iz + jz
              if (x < 0 || y < 0 || z < 0 || x >= size || y >= size || z >= size) continue
              const dist = Math.hypot(jx, jy, jz)
              if (dist > radius) continue
              const w = radius - dist + 1
              sum += (densities[gridIndex(x, y, z, size)] ?? 0) * w
              weight += w
            }
          }
        }
        const original = densities[gridIndex(ix, iy, iz, size)] ?? 0
        const blurred = weight > 0 ? sum / weight : original
        out[gridIndex(ix, iy, iz, size)] = original * (1 - amount) + blurred * amount
      }
    }
  }

  return out
}

/**
 * Step 1 — build the voxel grid.
 * Fills every cell with density(x, y, z), then optionally bleeds neighbors.
 */
export function buildVoxelGrid(terrain: TerrainParams, voxel: VoxelParams): VoxelGrid {
  const size = Math.max(4, Math.round(voxel.resolution))
  const half = VOXEL_WORLD_SIZE * 0.5
  const cellSize = VOXEL_WORLD_SIZE / size
  const densityAt = createDensityFunction(terrain, voxel)
  const raw = new Float32Array(size * size * size)

  let i = 0
  for (let iz = 0; iz < size; iz++) {
    for (let iy = 0; iy < size; iy++) {
      for (let ix = 0; ix < size; ix++) {
        const wx = -half + (ix + 0.5) * cellSize
        const wy = -half + (iy + 0.5) * cellSize
        const wz = -half + (iz + 0.5) * cellSize
        raw[i++] = densityAt(wx, wy, wz)
      }
    }
  }

  const densities = applyBleed3D(raw, size, voxel.bleed)
  return { size, densities, half, cellSize }
}

export function cellWorldPosition(
  ix: number,
  iy: number,
  iz: number,
  grid: VoxelGrid,
): [number, number, number] {
  return [
    -grid.half + (ix + 0.5) * grid.cellSize,
    -grid.half + (iy + 0.5) * grid.cellSize,
    -grid.half + (iz + 0.5) * grid.cellSize,
  ]
}

export function isSolid(density: number, isolevel: number) {
  return density >= isolevel
}
