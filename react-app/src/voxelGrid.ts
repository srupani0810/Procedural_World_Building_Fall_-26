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

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

/**
 * density(x, y, z): positive ≈ solid, negative ≈ air (at isolevel 0).
 *
 * Landscape-style field (not a filled cube):
 * - Solid only in a thin band just below the noise surface (no deep fill)
 * - Smooth horizontal falloff toward the grid rim so edges trail off
 * - Optional 3D noise (`volume`) for caves / overhangs inside that band
 */
export function createDensityFunction(terrain: TerrainParams, voxel: VoxelParams) {
  const sample2 = createNoise(terrain)
  const sample3 = createNoise3D(terrain)
  const height = Math.max(terrain.height, 0.01)
  const volume = clamp(voxel.volume, 0, 2)
  const half = VOXEL_WORLD_SIZE * 0.5
  /** World-unit thickness of solid crust under the surface. */
  const crust = Math.max(0.2, height * 0.5)

  return (x: number, y: number, z: number) => {
    // Normalized distance to rim: 0 at center, ~1 at grid boundary
    const nx = x / half
    const nz = z / half
    const radial = Math.hypot(nx, nz)
    const square = Math.max(Math.abs(nx), Math.abs(nz))
    // Blend so both circular islands and square-grid corners fade cleanly
    const edgeDist = Math.max(radial * 0.9, square)

    // 1 in the interior → 0 at the rim (voxels thin out / empty)
    const edgeMask = 1 - smoothstep(0.42, 0.93, edgeDist)
    if (edgeMask < 0.002) return -1

    // Terrain lowers toward the rim so hills trail off instead of clipping
    const surface = sample2(x, z) * height * (0.25 + 0.75 * edgeMask)

    // depth > 0 below the surface. Shell is solid only for 0 < depth < crust.
    const depth = surface - y
    const shell = Math.min(depth, crust - depth)

    const volumetric = sample3(x, y, z) * volume * height * 0.45

    // Pull density to air as edgeMask → 0 (no flat vertical walls at the boundary)
    return (shell + volumetric) * edgeMask - (1 - edgeMask) * 0.35
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
