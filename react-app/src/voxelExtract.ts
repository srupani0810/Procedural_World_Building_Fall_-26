import { BufferAttribute, BufferGeometry } from 'three'
import { edgeTable, triTable } from 'three/examples/jsm/objects/MarchingCubes.js'
import { heightToRgb } from './heightColor.ts'
import { cellWorldPosition, gridIndex } from './voxelGrid.ts'
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

/**
 * Step 2 — Marching Cubes over the cell-centered grid.
 * Separate path from Interactive greedy meshing; same VoxelGrid input.
 */
export function extractMarchingCubesFromGrid(
  grid: VoxelGrid,
  isolevel: number,
): BufferGeometry {
  const { size, densities } = grid
  const positions: number[] = []
  const colors: number[] = []

  for (let z = 0; z < size - 1; z++) {
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const cornersVals = [
          densities[gridIndex(x, y, z, size)] ?? 0,
          densities[gridIndex(x + 1, y, z, size)] ?? 0,
          densities[gridIndex(x + 1, y, z + 1, size)] ?? 0,
          densities[gridIndex(x, y, z + 1, size)] ?? 0,
          densities[gridIndex(x, y + 1, z, size)] ?? 0,
          densities[gridIndex(x + 1, y + 1, z, size)] ?? 0,
          densities[gridIndex(x + 1, y + 1, z + 1, size)] ?? 0,
          densities[gridIndex(x, y + 1, z + 1, size)] ?? 0,
        ]

        let cubeIndex = 0
        for (let i = 0; i < 8; i++) {
          if ((cornersVals[i] ?? 0) >= isolevel) cubeIndex |= 1 << i
        }

        const edges = edgeTable[cubeIndex] ?? 0
        if (edges === 0) continue

        const cornerPos: [number, number, number][] = [
          cellWorldPosition(x, y, z, grid),
          cellWorldPosition(x + 1, y, z, grid),
          cellWorldPosition(x + 1, y, z + 1, grid),
          cellWorldPosition(x, y, z + 1, grid),
          cellWorldPosition(x, y + 1, z, grid),
          cellWorldPosition(x + 1, y + 1, z, grid),
          cellWorldPosition(x + 1, y + 1, z + 1, grid),
          cellWorldPosition(x, y + 1, z + 1, grid),
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
          const t = clamp(midY / (grid.half * 2) + 0.5, 0, 1)
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
