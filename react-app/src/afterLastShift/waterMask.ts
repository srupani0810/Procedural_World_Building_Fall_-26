/**
 * Water mask for After the Last Shift.
 * Heights stay on the noise field. This grid only stores land (0) or water (1).
 * Later steps should read it through `waterMaskAt` / `readWaterMask`.
 */

export type WaterMask = {
  /** World X of column 0. */
  originX: number
  /** World Z of row 0. */
  originZ: number
  cellSize: number
  resolution: number
  /** Row-major, 0 land, 1 water. */
  cells: Uint8Array
  /** Smoothed world-space centerlines. The ribbon mesh follows these. */
  paths: Array<Array<[number, number]>>
  /** Half-width of the visible ribbon, in world units. */
  halfWidth: number
}

export type WaterMaskOptions = {
  /** World center of the mask. */
  originX?: number
  originZ?: number
  /** Full width and depth of the mask, in world units. */
  size?: number
  resolution?: number
  /** How many valley mouths to grow. */
  streamCount?: number
}

/** Edge neighbors only, so a stream step always shares a side. */
const CARDINAL: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

let activeMask: WaterMask | null = null

/** Published by the shift scene whenever the heightfield changes. */
export function publishWaterMask(mask: WaterMask | null) {
  activeMask = mask
}

export function readWaterMask() {
  return activeMask
}

/** 1 when (x, z) falls inside a water cell of the mask. Outside the grid is land. */
export function waterMaskAt(mask: WaterMask | null, x: number, z: number) {
  if (!mask) return 0
  const ix = Math.floor((x - mask.originX) / mask.cellSize)
  const iz = Math.floor((z - mask.originZ) / mask.cellSize)
  if (ix < 0 || iz < 0 || ix >= mask.resolution || iz >= mask.resolution) return 0
  return mask.cells[iz * mask.resolution + ix]
}

function cellIndex(resolution: number, ix: number, iz: number) {
  return iz * resolution + ix
}

/** Separable box blur. Knocks the high-frequency pits out of the heightfield. */
function blurGrid(source: Float32Array, resolution: number, radius: number) {
  const tmp = new Float32Array(source.length)
  const out = new Float32Array(source.length)
  for (let iz = 0; iz < resolution; iz++) {
    for (let ix = 0; ix < resolution; ix++) {
      let sum = 0
      let count = 0
      for (let k = -radius; k <= radius; k++) {
        const x = ix + k
        if (x < 0 || x >= resolution) continue
        sum += source[iz * resolution + x]
        count++
      }
      tmp[iz * resolution + ix] = sum / count
    }
  }
  for (let iz = 0; iz < resolution; iz++) {
    for (let ix = 0; ix < resolution; ix++) {
      let sum = 0
      let count = 0
      for (let k = -radius; k <= radius; k++) {
        const z = iz + k
        if (z < 0 || z >= resolution) continue
        sum += tmp[z * resolution + ix]
        count++
      }
      out[iz * resolution + ix] = sum / count
    }
  }
  return out
}

/**
 * Grow a few streams by linking valley floors through their lowest passes.
 * The channel is an edge-connected centerline, widened to a steady width,
 * then blurred so the bank is a soft curve instead of a stair of cells.
 */
export function buildWaterMask(
  heightAt: (x: number, z: number) => number,
  options: WaterMaskOptions = {},
): WaterMask {
  const resolution = Math.max(16, Math.round(options.resolution ?? 96))
  const size = Math.max(resolution, options.size ?? 520)
  const cellSize = size / resolution
  const originX = (options.originX ?? 0) - size / 2
  const originZ = (options.originZ ?? 0) - size / 2
  const streamCount = Math.max(1, Math.round(options.streamCount ?? 4))
  const raw = new Float32Array(resolution * resolution)

  for (let iz = 0; iz < resolution; iz++) {
    for (let ix = 0; ix < resolution; ix++) {
      raw[cellIndex(resolution, ix, iz)] = heightAt(originX + (ix + 0.5) * cellSize, originZ + (iz + 0.5) * cellSize)
    }
  }
  const heights = blurGrid(blurGrid(raw, resolution, 2), resolution, 2)

  const minima: { ix: number; iz: number; h: number }[] = []
  for (let iz = 1; iz < resolution - 1; iz++) {
    for (let ix = 1; ix < resolution - 1; ix++) {
      const h = heights[cellIndex(resolution, ix, iz)]
      let lowest = true
      for (const [dx, dz] of CARDINAL) {
        if (heights[cellIndex(resolution, ix + dx, iz + dz)] < h) {
          lowest = false
          break
        }
      }
      if (lowest) minima.push({ ix, iz, h })
    }
  }
  minima.sort((a, b) => a.h - b.h)

  const mouths: { ix: number; iz: number }[] = []
  const separation = Math.max(8, Math.round(resolution / 8))
  for (const basin of minima) {
    const spaced = mouths.every((mouth) => {
      const dx = mouth.ix - basin.ix
      const dz = mouth.iz - basin.iz
      return dx * dx + dz * dz >= separation * separation
    })
    if (!spaced) continue
    mouths.push(basin)
    if (mouths.length >= streamCount) break
  }

  const owner = new Int16Array(resolution * resolution)
  const parent = new Int32Array(resolution * resolution)
  parent.fill(-1)
  const heap: { index: number; h: number }[] = []
  const push = (index: number, h: number) => {
    heap.push({ index, h })
    let cursor = heap.length - 1
    while (cursor > 0) {
      const up = (cursor - 1) >> 1
      if (heap[up].h <= heap[cursor].h) break
      const swap = heap[up]
      heap[up] = heap[cursor]
      heap[cursor] = swap
      cursor = up
    }
  }
  const pop = () => {
    const top = heap[0]
    const last = heap.pop()
    if (!top || !last || heap.length === 0) return top
    heap[0] = last
    let cursor = 0
    for (;;) {
      const left = cursor * 2 + 1
      const right = left + 1
      let smallest = cursor
      if (left < heap.length && heap[left].h < heap[smallest].h) smallest = left
      if (right < heap.length && heap[right].h < heap[smallest].h) smallest = right
      if (smallest === cursor) break
      const swap = heap[smallest]
      heap[smallest] = heap[cursor]
      heap[cursor] = swap
      cursor = smallest
    }
    return top
  }

  mouths.forEach((mouth, basin) => {
    const index = cellIndex(resolution, mouth.ix, mouth.iz)
    owner[index] = basin + 1
    push(index, heights[index])
  })

  const center = new Uint8Array(resolution * resolution)
  const carve = (index: number) => {
    let cursor = index
    let guard = 0
    while (cursor >= 0 && guard < resolution * resolution) {
      center[cursor] = 1
      cursor = parent[cursor]
      guard++
    }
  }

  let links = 0
  const linkGoal = Math.max(1, mouths.length - 1)
  while (heap.length > 0 && links < linkGoal) {
    const current = pop()
    if (!current) break
    const ix = current.index % resolution
    const iz = Math.floor(current.index / resolution)
    const basin = owner[current.index]
    for (const [dx, dz] of CARDINAL) {
      const nx = ix + dx
      const nz = iz + dz
      if (nx < 0 || nz < 0 || nx >= resolution || nz >= resolution) continue
      const neighbor = cellIndex(resolution, nx, nz)
      const other = owner[neighbor]
      if (other === basin) continue
      if (other !== 0) {
        if (links >= linkGoal) break
        carve(current.index)
        carve(neighbor)
        links++
        continue
      }
      owner[neighbor] = basin
      parent[neighbor] = current.index
      push(neighbor, heights[neighbor])
    }
  }

  pruneSpurs(center, resolution, 10)

  const coverage = new Float32Array(resolution * resolution)
  const dist = new Int16Array(resolution * resolution)
  dist.fill(-1)
  const queue: number[] = []
  for (let i = 0; i < center.length; i++) {
    if (!center[i]) continue
    dist[i] = 0
    coverage[i] = 1
    queue.push(i)
  }
  const reach = 3
  let head = 0
  while (head < queue.length) {
    const index = queue[head++]
    const d = dist[index]
    if (d >= reach) continue
    const ix = index % resolution
    const iz = Math.floor(index / resolution)
    for (const [dx, dz] of CARDINAL) {
      const nx = ix + dx
      const nz = iz + dz
      if (nx < 0 || nz < 0 || nx >= resolution || nz >= resolution) continue
      const neighbor = cellIndex(resolution, nx, nz)
      if (dist[neighbor] !== -1) continue
      const next = d + 1
      dist[neighbor] = next
      coverage[neighbor] = next <= 1 ? 1 : 1 - (next - 1) / 2
      queue.push(neighbor)
    }
  }

  const soft = blurGrid(coverage, resolution, 1)
  const cells = new Uint8Array(resolution * resolution)
  for (let i = 0; i < soft.length; i++) cells[i] = soft[i] >= 0.5 ? 1 : 0

  const halfWidth = cellSize * 2.15
  return { originX, originZ, cellSize, resolution, cells, paths: tracePaths(center, resolution, originX, originZ, cellSize), halfWidth }
}

/** Drop short dead-end twigs so the channel stays one route, not a spray of spurs. */
function pruneSpurs(center: Uint8Array, resolution: number, minLength: number) {
  const neighborsOf = (index: number) => {
    const found: number[] = []
    const ix = index % resolution
    const iz = Math.floor(index / resolution)
    for (const [dx, dz] of CARDINAL) {
      const nx = ix + dx
      const nz = iz + dz
      if (nx < 0 || nz < 0 || nx >= resolution || nz >= resolution) continue
      const neighbor = cellIndex(resolution, nx, nz)
      if (center[neighbor]) found.push(neighbor)
    }
    return found
  }
  for (let pass = 0; pass < 8; pass++) {
    const tips: number[] = []
    for (let index = 0; index < center.length; index++) {
      if (center[index] && neighborsOf(index).length === 1) tips.push(index)
    }
    let cut = false
    for (const tip of tips) {
      if (!center[tip]) continue
      const spur: number[] = []
      let prev = -1
      let cursor = tip
      while (center[cursor]) {
        const next = neighborsOf(cursor).filter((neighbor) => neighbor !== prev)
        spur.push(cursor)
        if (next.length !== 1) break
        prev = cursor
        cursor = next[0]
        if (spur.length > minLength) break
      }
      if (spur.length > minLength) continue
      for (let i = 0; i < spur.length - 1; i++) center[spur[i]] = 0
      cut = true
    }
    if (!cut) break
  }
}

function worldPoint(index: number, resolution: number, originX: number, originZ: number, cellSize: number): [number, number] {
  const ix = index % resolution
  const iz = Math.floor(index / resolution)
  return [originX + (ix + 0.5) * cellSize, originZ + (iz + 0.5) * cellSize]
}

/** Even spacing so the ribbon follows the valley curve instead of every grid step. */
function resample(points: Array<[number, number]>, spacing: number) {
  if (points.length < 2) return points
  const out: Array<[number, number]> = [points[0]]
  let carry = 0
  for (let i = 1; i < points.length; i++) {
    let ax = points[i - 1][0]
    let az = points[i - 1][1]
    const bx = points[i][0]
    const bz = points[i][1]
    let dx = bx - ax
    let dz = bz - az
    let dist = Math.hypot(dx, dz)
    if (dist < 1e-5) continue
    while (carry + dist >= spacing) {
      const t = (spacing - carry) / dist
      ax += dx * t
      az += dz * t
      out.push([ax, az])
      dx = bx - ax
      dz = bz - az
      dist = Math.hypot(dx, dz)
      carry = 0
      if (dist < 1e-5) break
    }
    carry += dist
  }
  const last = points[points.length - 1]
  const prev = out[out.length - 1]
  if (Math.hypot(last[0] - prev[0], last[1] - prev[1]) > spacing * 0.35) out.push(last)
  return out
}

/** Corner-cutting smooth so a grid walk reads as a curve. */
function chaikin(points: Array<[number, number]>) {
  let current = points
  for (let pass = 0; pass < 3; pass++) {
    if (current.length < 3) break
    const next: Array<[number, number]> = [current[0]]
    for (let i = 0; i < current.length - 1; i++) {
      const a = current[i]
      const b = current[i + 1]
      next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25])
      next.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75])
    }
    next.push(current[current.length - 1])
    current = next
  }
  return current
}

/** Walk the centerline from junctions so each piece is one ordered curve. */
function tracePaths(
  center: Uint8Array,
  resolution: number,
  originX: number,
  originZ: number,
  cellSize: number,
) {
  const adj: number[][] = Array.from({ length: center.length }, () => [])
  for (let index = 0; index < center.length; index++) {
    if (!center[index]) continue
    const ix = index % resolution
    const iz = Math.floor(index / resolution)
    for (const [dx, dz] of CARDINAL) {
      const nx = ix + dx
      const nz = iz + dz
      if (nx < 0 || nz < 0 || nx >= resolution || nz >= resolution) continue
      const neighbor = cellIndex(resolution, nx, nz)
      if (center[neighbor] && neighbor > index) {
        adj[index].push(neighbor)
        adj[neighbor].push(index)
      }
    }
  }

  const used = new Set<string>()
  const edgeKey = (a: number, b: number) => (a < b ? `${a},${b}` : `${b},${a}`)
  const toWorld = (indexes: number[]) =>
    resample(chaikin(indexes.map((index) => worldPoint(index, resolution, originX, originZ, cellSize))), cellSize * 3)

  const walk = (from: number, to: number) => {
    const indexes = [from]
    let prev = from
    let cursor = to
    used.add(edgeKey(prev, cursor))
    for (;;) {
      indexes.push(cursor)
      const next = adj[cursor].find((neighbor) => neighbor !== prev && !used.has(edgeKey(cursor, neighbor)))
      if (next === undefined || adj[cursor].length !== 2) break
      prev = cursor
      cursor = next
      used.add(edgeKey(prev, cursor))
    }
    return toWorld(indexes)
  }

  const paths: Array<Array<[number, number]>> = []
  const starts: number[] = []
  for (let index = 0; index < center.length; index++) {
    if (center[index] && adj[index].length !== 2) starts.push(index)
  }
  if (starts.length === 0) {
    const any = center.findIndex((value) => value === 1)
    if (any >= 0) starts.push(any)
  }
  for (const start of starts) {
    for (const neighbor of adj[start]) {
      if (used.has(edgeKey(start, neighbor))) continue
      const path = walk(start, neighbor)
      let length = 0
      for (let i = 1; i < path.length; i++) {
        length += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1])
      }
      if (length >= cellSize * 10) paths.push(path)
    }
  }
  return paths
}
