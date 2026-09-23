import { BufferAttribute, BufferGeometry, Color } from 'three'
import { edgeTable, triTable } from 'three/examples/jsm/objects/MarchingCubes.js'
import { heightToRgb } from './heightColor.ts'
import { createNoise } from './terrainParams.ts'
import type { TerrainParams } from './terrainParams.ts'
import { VOXEL_WORLD_SIZE } from './voxelParams.ts'
import type { VoxelParams } from './voxelParams.ts'

export type OccupiedCell = {
  x: number
  y: number
  z: number
  color: Color
}

function clamp(value: number, min: number, max: number) {
  return value < min ? min : value > max ? max : value
}

/** Sample the same noise field as 3D/2D into an XZ height grid. */
export function buildHeightGrid(terrain: TerrainParams, resolution: number): Float32Array {
  const res = Math.max(4, Math.round(resolution))
  const sample = createNoise(terrain)
  const half = VOXEL_WORLD_SIZE * 0.5
  const step = VOXEL_WORLD_SIZE / res
  const heights = new Float32Array(res * res)

  for (let iz = 0; iz < res; iz++) {
    for (let ix = 0; ix < res; ix++) {
      const wx = -half + (ix + 0.5) * step
      const wz = -half + (iz + 0.5) * step
      heights[iz * res + ix] = sample(wx, wz) * terrain.height
    }
  }

  return heights
}

/**
 * Bleed neighboring column heights into each other.
 * Radius grows with bleed; 0 leaves the field pixel-hard.
 */
export function applyBleed(heights: Float32Array, resolution: number, bleed: number): Float32Array {
  const amount = clamp(bleed, 0, 1)
  if (amount < 0.001) {
    return heights.slice()
  }

  const radius = Math.max(1, Math.round(amount * 3))
  const out = new Float32Array(heights.length)

  for (let iz = 0; iz < resolution; iz++) {
    for (let ix = 0; ix < resolution; ix++) {
      let sum = 0
      let weight = 0
      for (let jz = -radius; jz <= radius; jz++) {
        for (let jx = -radius; jx <= radius; jx++) {
          const x = ix + jx
          const z = iz + jz
          if (x < 0 || z < 0 || x >= resolution || z >= resolution) continue
          const dist = Math.hypot(jx, jz)
          if (dist > radius) continue
          const w = (radius - dist + 1) * (1 - amount * 0.15)
          sum += (heights[z * resolution + x] ?? 0) * w
          weight += w
        }
      }
      const original = heights[iz * resolution + ix] ?? 0
      const blurred = weight > 0 ? sum / weight : original
      out[iz * resolution + ix] = original * (1 - amount) + blurred * amount
    }
  }

  return out
}

function heightColor(surfaceY: number, maxAbs: number): Color {
  const t = clamp(surfaceY / (maxAbs * 2) + 0.5, 0, 1)
  const [r, g, b] = heightToRgb(t)
  return new Color(r / 255, g / 255, b / 255)
}

/** Minecraft-style solid columns from the terrain height field. */
export function extractTerrainVoxels(
  terrain: TerrainParams,
  voxel: VoxelParams,
): { cells: OccupiedCell[]; cellSize: number } {
  const res = Math.max(4, Math.round(voxel.resolution))
  const cellSize = VOXEL_WORLD_SIZE / res
  const half = VOXEL_WORLD_SIZE * 0.5
  const raw = buildHeightGrid(terrain, res)
  const heights = applyBleed(raw, res, voxel.bleed)
  const floorY = -Math.max(terrain.height, 0.01)
  const cells: OccupiedCell[] = []

  for (let iz = 0; iz < res; iz++) {
    for (let ix = 0; ix < res; ix++) {
      const surface = heights[iz * res + ix] ?? 0
      const wx = -half + (ix + 0.5) * cellSize
      const wz = -half + (iz + 0.5) * cellSize
      const color = heightColor(surface, Math.max(terrain.height, 0.01))

      const yStart = Math.floor(floorY / cellSize)
      const yEnd = Math.floor(surface / cellSize)
      for (let iy = yStart; iy <= yEnd; iy++) {
        cells.push({
          x: wx,
          y: (iy + 0.5) * cellSize,
          z: wz,
          color,
        })
      }
    }
  }

  return { cells, cellSize }
}

/**
 * Density volume where solid = below the height surface (for marching / ray / points).
 * Values are SDF-like: negative inside / below surface.
 */
export function buildTerrainDensityVolume(
  terrain: TerrainParams,
  voxel: VoxelParams,
): { data: Float32Array; corners: number; half: number; step: number } {
  const res = Math.max(4, Math.round(voxel.resolution))
  const corners = res + 1
  const half = VOXEL_WORLD_SIZE * 0.5
  const step = VOXEL_WORLD_SIZE / res
  const heightRes = res
  const raw = buildHeightGrid(terrain, heightRes)
  const heights = applyBleed(raw, heightRes, voxel.bleed)
  const data = new Float32Array(corners * corners * corners)

  const sampleHeight = (fx: number, fz: number) => {
    const x = clamp(fx, 0, heightRes - 1)
    const z = clamp(fz, 0, heightRes - 1)
    const x0 = Math.floor(x)
    const z0 = Math.floor(z)
    const x1 = Math.min(x0 + 1, heightRes - 1)
    const z1 = Math.min(z0 + 1, heightRes - 1)
    const tx = x - x0
    const tz = z - z0
    const h00 = heights[z0 * heightRes + x0] ?? 0
    const h10 = heights[z0 * heightRes + x1] ?? 0
    const h01 = heights[z1 * heightRes + x0] ?? 0
    const h11 = heights[z1 * heightRes + x1] ?? 0
    return h00 * (1 - tx) * (1 - tz) + h10 * tx * (1 - tz) + h01 * (1 - tx) * tz + h11 * tx * tz
  }

  let i = 0
  for (let iz = 0; iz < corners; iz++) {
    for (let iy = 0; iy < corners; iy++) {
      for (let ix = 0; ix < corners; ix++) {
        const wx = -half + ix * step
        const wy = -half + iy * step
        const wz = -half + iz * step
        const fx = (wx + half) / step - 0.5
        const fz = (wz + half) / step - 0.5
        const surface = sampleHeight(fx, fz)
        // Below surface = solid (negative)
        data[i++] = wy - surface
      }
    }
  }

  return { data, corners, half, step }
}

function volumeIndex(x: number, y: number, z: number, corners: number) {
  return x + y * corners + z * corners * corners
}

const EDGE_VERTICES: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
]

function lerpEdge(
  isolevel: number,
  p0: [number, number, number],
  p1: [number, number, number],
  v0: number,
  v1: number,
): [number, number, number] {
  if (Math.abs(isolevel - v0) < 1e-6) return p0
  if (Math.abs(isolevel - v1) < 1e-6) return p1
  if (Math.abs(v0 - v1) < 1e-6) return p0
  const t = (isolevel - v0) / (v1 - v0)
  return [p0[0] + t * (p1[0] - p0[0]), p0[1] + t * (p1[1] - p0[1]), p0[2] + t * (p1[2] - p0[2])]
}

export function extractMarchingCubesGeometry(
  terrain: TerrainParams,
  voxel: VoxelParams,
): BufferGeometry {
  const { data, corners, half, step } = buildTerrainDensityVolume(terrain, voxel)
  const positions: number[] = []
  const colors: number[] = []
  const res = corners - 1
  const iso = 0

  for (let z = 0; z < res; z++) {
    for (let y = 0; y < res; y++) {
      for (let x = 0; x < res; x++) {
        const cornersVals = [
          data[volumeIndex(x, y, z, corners)] ?? 1,
          data[volumeIndex(x + 1, y, z, corners)] ?? 1,
          data[volumeIndex(x + 1, y, z + 1, corners)] ?? 1,
          data[volumeIndex(x, y, z + 1, corners)] ?? 1,
          data[volumeIndex(x, y + 1, z, corners)] ?? 1,
          data[volumeIndex(x + 1, y + 1, z, corners)] ?? 1,
          data[volumeIndex(x + 1, y + 1, z + 1, corners)] ?? 1,
          data[volumeIndex(x, y + 1, z + 1, corners)] ?? 1,
        ]

        let cubeIndex = 0
        for (let i = 0; i < 8; i++) {
          if ((cornersVals[i] ?? 1) < iso) cubeIndex |= 1 << i
        }

        const edges = edgeTable[cubeIndex] ?? 0
        if (edges === 0) continue

        const cornerPos: [number, number, number][] = [
          [-half + x * step, -half + y * step, -half + z * step],
          [-half + (x + 1) * step, -half + y * step, -half + z * step],
          [-half + (x + 1) * step, -half + y * step, -half + (z + 1) * step],
          [-half + x * step, -half + y * step, -half + (z + 1) * step],
          [-half + x * step, -half + (y + 1) * step, -half + z * step],
          [-half + (x + 1) * step, -half + (y + 1) * step, -half + z * step],
          [-half + (x + 1) * step, -half + (y + 1) * step, -half + (z + 1) * step],
          [-half + x * step, -half + (y + 1) * step, -half + (z + 1) * step],
        ]

        const vertList: ([number, number, number] | null)[] = Array.from({ length: 12 }, () => null)
        for (let i = 0; i < 12; i++) {
          if (edges & (1 << i)) {
            const pair = EDGE_VERTICES[i]!
            vertList[i] = lerpEdge(
              iso,
              cornerPos[pair[0]]!,
              cornerPos[pair[1]]!,
              cornersVals[pair[0]] ?? 1,
              cornersVals[pair[1]] ?? 1,
            )
          }
        }

        const base = cubeIndex * 16
        for (let i = 0; triTable[base + i] !== -1; i += 3) {
          const a = vertList[triTable[base + i] ?? 0]
          const b = vertList[triTable[base + i + 1] ?? 0]
          const c = vertList[triTable[base + i + 2] ?? 0]
          if (!a || !b || !c) continue
          positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2])
          const midY = (a[1] + b[1] + c[1]) / 3
          const t = clamp(midY / (Math.max(terrain.height, 0.01) * 2) + 0.5, 0, 1)
          const [r, g, bl] = heightToRgb(t)
          for (let k = 0; k < 3; k++) colors.push(r / 255, g / 255, bl / 255)
        }
      }
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3))
  geometry.computeVertexNormals()
  return geometry
}

export function extractPointGeometry(
  terrain: TerrainParams,
  voxel: VoxelParams,
): BufferGeometry {
  const { cells } = extractTerrainVoxels(terrain, voxel)
  const positions = new Float32Array(cells.length * 3)
  const colors = new Float32Array(cells.length * 3)
  cells.forEach((cell, i) => {
    positions[i * 3] = cell.x
    positions[i * 3 + 1] = cell.y
    positions[i * 3 + 2] = cell.z
    colors[i * 3] = cell.color.r
    colors[i * 3 + 1] = cell.color.g
    colors[i * 3 + 2] = cell.color.b
  })
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  return geometry
}

export function buildDensityTextureData(
  terrain: TerrainParams,
  voxel: VoxelParams,
): { data: Uint8Array; size: number; half: number } {
  const { data, corners, half } = buildTerrainDensityVolume(terrain, voxel)
  const out = new Uint8Array(corners * corners * corners)
  for (let i = 0; i < data.length; i++) {
    const d = data[i] ?? 1
    const t = clamp(0.5 - d * 0.5, 0, 1)
    out[i] = Math.round(t * 255)
  }
  return { data: out, size: corners, half }
}
