import { BufferAttribute, BufferGeometry } from 'three'
import { edgeTable, triTable } from 'three/examples/jsm/objects/MarchingCubes.js'
import { heightToRgb } from './heightColor.ts'
import { gridIndex, isSolid } from './voxelGrid.ts'
import type { VoxelGrid } from './voxelGrid.ts'

function clamp(value: number, min: number, max: number) {
  return value < min ? min : value > max ? max : value
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

type DensityAt = (x: number, y: number, z: number) => number

/**
 * Marching Cubes over a chunk. Iterates one cell past the stored grid by
 * sampling `densityAt` in world space so the dual lattice bridges chunk borders.
 */
export function extractMarchingCubesFromGrid(
  grid: VoxelGrid,
  isolevel: number,
  densityAt?: DensityAt,
): BufferGeometry {
  const { size, densities, cellSize, colorHeight } = grid
  const positions: number[] = []
  const colors: number[] = []

  const sample = (lx: number, ly: number, lz: number) => {
    if (lx >= 0 && ly >= 0 && lz >= 0 && lx < size && ly < size && lz < size) {
      return densities[gridIndex(lx, ly, lz, size)] ?? 0
    }
    if (!densityAt) return isolevel - 1
    const wx = grid.origin[0] + (lx + 0.5) * cellSize
    const wy = grid.origin[1] + (ly + 0.5) * cellSize
    const wz = grid.origin[2] + (lz + 0.5) * cellSize
    return densityAt(wx, wy, wz)
  }

  const cornerWorld = (lx: number, ly: number, lz: number): [number, number, number] => [
    grid.origin[0] + (lx + 0.5) * cellSize,
    grid.origin[1] + (ly + 0.5) * cellSize,
    grid.origin[2] + (lz + 0.5) * cellSize,
  ]

  // Include the dual cubes that straddle this chunk and +X/+Y/+Z neighbors
  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const cornersVals = [
          sample(x, y, z),
          sample(x + 1, y, z),
          sample(x + 1, y, z + 1),
          sample(x, y, z + 1),
          sample(x, y + 1, z),
          sample(x + 1, y + 1, z),
          sample(x + 1, y + 1, z + 1),
          sample(x, y + 1, z + 1),
        ]

        let cubeIndex = 0
        for (let i = 0; i < 8; i++) {
          if (isSolid(cornersVals[i] ?? 0, isolevel)) cubeIndex |= 1 << i
        }

        const edges = edgeTable[cubeIndex] ?? 0
        if (edges === 0) continue

        const cornerPos: [number, number, number][] = [
          cornerWorld(x, y, z),
          cornerWorld(x + 1, y, z),
          cornerWorld(x + 1, y, z + 1),
          cornerWorld(x, y, z + 1),
          cornerWorld(x, y + 1, z),
          cornerWorld(x + 1, y + 1, z),
          cornerWorld(x + 1, y + 1, z + 1),
          cornerWorld(x, y + 1, z + 1),
        ]

        const vertList: ([number, number, number] | null)[] = Array.from({ length: 12 }, () => null)
        for (let i = 0; i < 12; i++) {
          if (edges & (1 << i)) {
            const pair = EDGE_VERTICES[i]!
            vertList[i] = lerpEdge(
              isolevel,
              cornerPos[pair[0]]!,
              cornerPos[pair[1]]!,
              cornersVals[pair[0]] ?? 0,
              cornersVals[pair[1]] ?? 0,
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
          const t = clamp(midY / (colorHeight * 2) + 0.5, 0, 1)
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
