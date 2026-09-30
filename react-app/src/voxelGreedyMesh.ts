import { BufferAttribute, BufferGeometry } from 'three'
import { sampleHeightGradient } from './heightGradient.ts'
import type { GradientStop } from './heightGradient.ts'
import { cellCornerPosition, gridIndex, isSolid } from './voxelGrid.ts'
import type { VoxelGrid } from './voxelGrid.ts'

function clamp(value: number, min: number, max: number) {
  return value < min ? min : value > max ? max : value
}

function colorAtY(
  wy: number,
  colorHeight: number,
  gradient: GradientStop[],
): [number, number, number] {
  const t = clamp(wy / (colorHeight * 2) + 0.5, 0, 1)
  const [r, g, b] = sampleHeightGradient(gradient, t)
  return [r / 255, g / 255, b / 255]
}

function pushVert(
  positions: number[],
  normals: number[],
  colors: number[],
  px: number,
  py: number,
  pz: number,
  nx: number,
  ny: number,
  nz: number,
  colorHeight: number,
  gradient: GradientStop[],
) {
  positions.push(px, py, pz)
  normals.push(nx, ny, nz)
  const [r, g, b] = colorAtY(py, colorHeight, gradient)
  colors.push(r, g, b)
}

type DensityAt = (x: number, y: number, z: number) => number

/**
 * Interactive mesher: face-culled + greedy-meshed quads.
 * Out-of-chunk neighbors are sampled via `densityAt` in world space so faces
 * are not drawn between two solid cells across a chunk border (no wall seams).
 */
export function buildGreedyInteractiveMesh(
  grid: VoxelGrid,
  isolevel: number,
  gradient: GradientStop[],
  densityAt?: DensityAt,
): BufferGeometry {
  const { size, densities, cellSize, colorHeight } = grid
  const positions: number[] = []
  const normals: number[] = []
  const colors: number[] = []

  const solid = (lx: number, ly: number, lz: number) => {
    if (lx >= 0 && ly >= 0 && lz >= 0 && lx < size && ly < size && lz < size) {
      return isSolid(densities[gridIndex(lx, ly, lz, size)] ?? 0, isolevel)
    }
    if (!densityAt) return false
    const wx = grid.origin[0] + (lx + 0.5) * cellSize
    const wy = grid.origin[1] + (ly + 0.5) * cellSize
    const wz = grid.origin[2] + (lz + 0.5) * cellSize
    return isSolid(densityAt(wx, wy, wz), isolevel)
  }

  const dims = [size, size, size]

  for (let d = 0; d < 3; d++) {
    const u = (d + 1) % 3
    const v = (d + 2) % 3
    const x = [0, 0, 0]
    const q = [0, 0, 0]
    q[d] = 1

    const maskW = dims[u]!
    const maskH = dims[v]!
    const mask = new Int8Array(maskW * maskH)

    for (x[d] = -1; x[d]! < dims[d]!; ) {
      let n = 0
      for (x[v] = 0; x[v]! < maskH; x[v]!++) {
        for (x[u] = 0; x[u]! < maskW; x[u]!++, n++) {
          const a = solid(x[0]!, x[1]!, x[2]!)
          const b = solid(x[0]! + q[0]!, x[1]! + q[1]!, x[2]! + q[2]!)

          if (a === b) mask[n] = 0
          else if (a) mask[n] = 1
          else mask[n] = -1
        }
      }

      x[d]!++
      n = 0

      for (let j = 0; j < maskH; j++) {
        for (let i = 0; i < maskW; ) {
          const c = mask[n] ?? 0
          if (c !== 0) {
            let w = 1
            while (i + w < maskW && (mask[n + w] ?? 0) === c) w++

            let h = 1
            outer: for (; j + h < maskH; h++) {
              for (let k = 0; k < w; k++) {
                if ((mask[n + k + h * maskW] ?? 0) !== c) break outer
              }
            }

            x[u] = i
            x[v] = j

            const du = [0, 0, 0]
            const dv = [0, 0, 0]
            if (c > 0) {
              du[u] = w
              dv[v] = h
            } else {
              du[v] = h
              dv[u] = w
            }

            const [ox, oy, oz] = cellCornerPosition(x[0]!, x[1]!, x[2]!, grid)
            const dux = du[0]! * cellSize
            const duy = du[1]! * cellSize
            const duz = du[2]! * cellSize
            const dvx = dv[0]! * cellSize
            const dvy = dv[1]! * cellSize
            const dvz = dv[2]! * cellSize

            const nx = q[0]! * c
            const ny = q[1]! * c
            const nz = q[2]! * c

            const x0 = ox
            const y0 = oy
            const z0 = oz
            const x1 = ox + dux
            const y1 = oy + duy
            const z1 = oz + duz
            const x2 = ox + dux + dvx
            const y2 = oy + duy + dvy
            const z2 = oz + duz + dvz
            const x3 = ox + dvx
            const y3 = oy + dvy
            const z3 = oz + dvz

            pushVert(positions, normals, colors, x0, y0, z0, nx, ny, nz, colorHeight, gradient)
            pushVert(positions, normals, colors, x1, y1, z1, nx, ny, nz, colorHeight, gradient)
            pushVert(positions, normals, colors, x2, y2, z2, nx, ny, nz, colorHeight, gradient)

            pushVert(positions, normals, colors, x0, y0, z0, nx, ny, nz, colorHeight, gradient)
            pushVert(positions, normals, colors, x2, y2, z2, nx, ny, nz, colorHeight, gradient)
            pushVert(positions, normals, colors, x3, y3, z3, nx, ny, nz, colorHeight, gradient)

            for (let jj = 0; jj < h; jj++) {
              for (let ii = 0; ii < w; ii++) {
                mask[n + ii + jj * maskW] = 0
              }
            }

            i += w
            n += w
          } else {
            i++
            n++
          }
        }
      }
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3))
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3))
  return geometry
}

/** Map a world-space face hit to a voxel index inside this chunk. */
export function hitToVoxelIndex(
  point: { x: number; y: number; z: number },
  normal: { x: number; y: number; z: number },
  grid: VoxelGrid,
  towardSolid: boolean,
): { ix: number; iy: number; iz: number } | null {
  const offset = grid.cellSize * (towardSolid ? -0.25 : 0.25)
  const wx = point.x + normal.x * offset
  const wy = point.y + normal.y * offset
  const wz = point.z + normal.z * offset
  const ix = Math.floor((wx - grid.origin[0]) / grid.cellSize)
  const iy = Math.floor((wy - grid.origin[1]) / grid.cellSize)
  const iz = Math.floor((wz - grid.origin[2]) / grid.cellSize)
  if (
    ix < 0 ||
    iy < 0 ||
    iz < 0 ||
    ix >= grid.size ||
    iy >= grid.size ||
    iz >= grid.size
  ) {
    return null
  }
  return { ix, iy, iz }
}
