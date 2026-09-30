import { createNoise, createNoise3D } from './terrainParams.ts'
import type { TerrainParams } from './terrainParams.ts'
import { VOXEL_CHUNK_SIZE } from './voxelParams.ts'
import type { VoxelParams } from './voxelParams.ts'

export type ChunkCoord = { cx: number; cy: number; cz: number }

/**
 * One streamed chunk: N³ densities sampled in **world** space.
 * No per-chunk edge fade — the field is continuous across borders.
 */
export type VoxelGrid = {
  size: number
  densities: Float32Array
  cellSize: number
  /** World-space minimum corner of cell (0,0,0). */
  origin: [number, number, number]
  chunk: ChunkCoord
  /** Half-extent used only for height→color normalization (terrain height scale). */
  colorHeight: number
}

function clamp(value: number, min: number, max: number) {
  return value < min ? min : value > max ? max : value
}

export function gridIndex(x: number, y: number, z: number, size: number) {
  return x + y * size + z * size * size
}

export function chunkKey(c: ChunkCoord) {
  return `${c.cx},${c.cy},${c.cz}`
}

export function worldToChunk(x: number, y: number, z: number, chunkSize = VOXEL_CHUNK_SIZE): ChunkCoord {
  return {
    cx: Math.floor(x / chunkSize),
    cy: Math.floor(y / chunkSize),
    cz: Math.floor(z / chunkSize),
  }
}

export function chunkOrigin(c: ChunkCoord, chunkSize = VOXEL_CHUNK_SIZE): [number, number, number] {
  return [c.cx * chunkSize, c.cy * chunkSize, c.cz * chunkSize]
}

/**
 * density(x, y, z) in world coordinates — same heightfield as the 3D tab.
 * No island / rim falloff (that would create seams at every chunk edge).
 */
export function createDensityFunction(terrain: TerrainParams, voxel: VoxelParams) {
  const sample2 = createNoise(terrain)
  const sample3 = createNoise3D(terrain)
  const height = Math.max(terrain.height, 0.01)
  const volume = clamp(voxel.volume, 0, 2)
  const floorY = -height

  return (x: number, y: number, z: number) => {
    const surface = sample2(x, z) * height
    if (y < floorY) return y - floorY
    let density = surface - y
    if (volume > 0.001) {
      density += sample3(x, y, z) * volume * height * 0.3
    }
    return density
  }
}

/**
 * Build one chunk. Densities are sampled at world-space cell centers so
 * neighboring chunks share the same continuous field (no tiling / seams).
 */
export function buildVoxelChunk(
  terrain: TerrainParams,
  voxel: VoxelParams,
  chunk: ChunkCoord,
): VoxelGrid {
  const size = Math.max(4, Math.round(voxel.resolution))
  const cellSize = VOXEL_CHUNK_SIZE / size
  const origin = chunkOrigin(chunk)
  const densityAt = createDensityFunction(terrain, voxel)
  const colorHeight = Math.max(terrain.height, 0.01)
  const bleed = clamp(voxel.bleed, 0, 1)

  // Optional halo so 3D bleed can use neighbors outside this chunk (still world-sampled).
  const radius = bleed < 0.001 ? 0 : Math.max(1, Math.round(bleed * 2))
  const pad = radius
  const dim = size + pad * 2
  const raw = new Float32Array(dim * dim * dim)

  let i = 0
  for (let iz = 0; iz < dim; iz++) {
    for (let iy = 0; iy < dim; iy++) {
      for (let ix = 0; ix < dim; ix++) {
        const wx = origin[0] + (ix - pad + 0.5) * cellSize
        const wy = origin[1] + (iy - pad + 0.5) * cellSize
        const wz = origin[2] + (iz - pad + 0.5) * cellSize
        raw[i++] = densityAt(wx, wy, wz)
      }
    }
  }

  const blurred = pad > 0 ? applyBleed3D(raw, dim, bleed) : raw
  const densities = new Float32Array(size * size * size)
  let o = 0
  for (let iz = 0; iz < size; iz++) {
    for (let iy = 0; iy < size; iy++) {
      for (let ix = 0; ix < size; ix++) {
        densities[o++] = blurred[gridIndex(ix + pad, iy + pad, iz + pad, dim)] ?? 0
      }
    }
  }

  return { size, densities, cellSize, origin, chunk, colorHeight }
}

/** @deprecated use buildVoxelChunk — single fixed grid at chunk (0,0,0) */
export function buildVoxelGrid(terrain: TerrainParams, voxel: VoxelParams): VoxelGrid {
  return buildVoxelChunk(terrain, voxel, { cx: 0, cy: 0, cz: 0 })
}

function applyBleed3D(densities: Float32Array, size: number, bleed: number): Float32Array {
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

export function cellWorldPosition(
  ix: number,
  iy: number,
  iz: number,
  grid: VoxelGrid,
): [number, number, number] {
  return [
    grid.origin[0] + (ix + 0.5) * grid.cellSize,
    grid.origin[1] + (iy + 0.5) * grid.cellSize,
    grid.origin[2] + (iz + 0.5) * grid.cellSize,
  ]
}

/** World position of the negative corner of cell (ix,iy,iz). */
export function cellCornerPosition(
  ix: number,
  iy: number,
  iz: number,
  grid: VoxelGrid,
): [number, number, number] {
  return [
    grid.origin[0] + ix * grid.cellSize,
    grid.origin[1] + iy * grid.cellSize,
    grid.origin[2] + iz * grid.cellSize,
  ]
}

export function isSolid(density: number, isolevel: number) {
  return density >= isolevel
}

/** Chunk coords within chebyshev radius of the camera chunk (inclusive). */
export function chunksAround(center: ChunkCoord, radius: number): ChunkCoord[] {
  const r = Math.max(0, Math.round(radius))
  const out: ChunkCoord[] = []
  for (let dz = -r; dz <= r; dz++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        out.push({ cx: center.cx + dx, cy: center.cy + dy, cz: center.cz + dz })
      }
    }
  }
  return out
}
