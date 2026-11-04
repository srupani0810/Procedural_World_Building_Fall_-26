/**
 * DECAY Jump In — 2D walkable surface map (Group B).
 * Sidewalks, junction crossings, roads (slow), park/farm/open plots.
 * Building footprints and field exterior are blocked. No Math.random.
 *
 * Built as a ~60 m window around the player (never the whole field).
 */

import type { BuildingInstance } from './buildings.ts'
import type { HeightFn } from './directionField.ts'
import type { PlotLandUse } from './landUse.ts'
import { edgeHalfWidth, type MorphPlot } from './morphology.ts'
import type { RoadNetworkParams } from './params.ts'
import { getNode, type RoadGraph } from './roadGraph.ts'

/** Surface kind. 0 = blocked / off-map. */
export const WALK_NONE = 0
export const WALK_ROAD = 1
export const WALK_ROAD_CROSS = 2
export const WALK_SIDEWALK = 3
export const WALK_OPEN = 4

export type WalkKind = 0 | 1 | 2 | 3 | 4

/** Half-extent of the follow window (~60 m across). */
export const JUMP_WALK_WINDOW_HALF = 30
/** Rebuild when the player drifts this far from the window origin. */
export const JUMP_WALK_RECENTER = 18

/** Hard caps for nearest-walkable ring search. */
export const NEAREST_WALK_MAX_R = 48
export const NEAREST_WALK_MAX_ITERS = 6000

export type WalkableMap = {
  /** World X of window center. */
  originX: number
  /** World Z of window center. */
  originZ: number
  /** Window half-extent in world units. */
  halfExtent: number
  cell: number
  n: number
  /** Row-major, z major then x: index = iz * n + ix */
  cells: Uint8Array
  rule: string
}

export type WalkWindowOpts = {
  originX: number
  originZ: number
  windowHalf?: number
}

export function walkSpeedMult(kind: WalkKind): number {
  if (kind === WALK_ROAD) return 0.5
  if (kind === WALK_NONE) return 0
  return 1
}

export function isWalkable(kind: WalkKind): boolean {
  return kind !== WALK_NONE
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v))
}

function worldToCell(map: WalkableMap, x: number, z: number) {
  const { halfExtent: h, cell, n, originX, originZ } = map
  const ix = clamp(Math.floor((x - originX + h) / cell), 0, n - 1)
  const iz = clamp(Math.floor((z - originZ + h) / cell), 0, n - 1)
  return { ix, iz }
}

function cellCenter(map: WalkableMap, ix: number, iz: number) {
  const { halfExtent: h, cell, originX, originZ } = map
  return {
    x: originX - h + (ix + 0.5) * cell,
    z: originZ - h + (iz + 0.5) * cell,
  }
}

export function sampleWalk(map: WalkableMap, x: number, z: number): WalkKind {
  const h = map.halfExtent
  if (Math.abs(x - map.originX) > h || Math.abs(z - map.originZ) > h) return WALK_NONE
  const { ix, iz } = worldToCell(map, x, z)
  return map.cells[iz * map.n + ix]! as WalkKind
}

function setCell(map: WalkableMap, ix: number, iz: number, kind: WalkKind, priority: number) {
  if (ix < 0 || iz < 0 || ix >= map.n || iz >= map.n) return
  const i = iz * map.n + ix
  const cur = map.cells[i]! as WalkKind
  const curP = kindPriority(cur)
  if (priority >= curP) map.cells[i] = kind
}

function kindPriority(k: WalkKind): number {
  if (k === WALK_SIDEWALK) return 4
  if (k === WALK_ROAD_CROSS) return 3
  if (k === WALK_OPEN) return 2
  if (k === WALK_ROAD) return 1
  return 0
}

function stampDisk(
  map: WalkableMap,
  cx: number,
  cz: number,
  radius: number,
  kind: WalkKind,
  priority: number,
) {
  const { cell, halfExtent: h, originX, originZ } = map
  const x0 = Math.floor((cx - radius - originX + h) / cell)
  const x1 = Math.floor((cx + radius - originX + h) / cell)
  const z0 = Math.floor((cz - radius - originZ + h) / cell)
  const z1 = Math.floor((cz + radius - originZ + h) / cell)
  const r2 = radius * radius
  for (let iz = z0; iz <= z1; iz++) {
    for (let ix = x0; ix <= x1; ix++) {
      const p = cellCenter(map, ix, iz)
      const dx = p.x - cx
      const dz = p.z - cz
      if (dx * dx + dz * dz <= r2) setCell(map, ix, iz, kind, priority)
    }
  }
}

/** Rasterize a road/sidewalk band along an edge (both sides of centerline). */
function stampBand(
  map: WalkableMap,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  inner: number,
  outer: number,
  kind: WalkKind,
  priority: number,
) {
  const dx = bx - ax
  const dz = bz - az
  const len = Math.hypot(dx, dz)
  if (len < 1e-4 || outer <= inner) return
  const tx = dx / len
  const tz = dz / len
  const nx = -tz
  const nz = tx
  const step = map.cell * 0.5
  const along = Math.max(1, Math.ceil(len / step))
  const across = Math.max(1, Math.ceil((outer - inner) / step))
  for (let i = 0; i <= along; i++) {
    const t = i / along
    const px = ax + dx * t
    const pz = az + dz * t
    for (let j = 0; j <= across; j++) {
      const w = inner + ((outer - inner) * j) / across
      stampDisk(map, px + nx * w, pz + nz * w, map.cell * 0.55, kind, priority)
      stampDisk(map, px - nx * w, pz - nz * w, map.cell * 0.55, kind, priority)
    }
  }
}

function stampRoadStrip(
  map: WalkableMap,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  half: number,
  kind: WalkKind,
  priority: number,
) {
  stampBand(map, ax, az, bx, bz, 0, half, kind, priority)
}

/** Point-in-ring (xz), even-odd. */
function pointInRing(x: number, z: number, ring: { x: number; z: number }[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!
    const b = ring[j]!
    const intersect =
      a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z + 1e-12) + a.x
    if (intersect) inside = !inside
  }
  return inside
}

function stampRing(
  map: WalkableMap,
  ring: { x: number; z: number }[],
  kind: WalkKind,
  priority: number,
) {
  if (ring.length < 3) return
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const p of ring) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.z < minZ) minZ = p.z
    if (p.z > maxZ) maxZ = p.z
  }
  const { cell, halfExtent: h, originX, originZ } = map
  const x0 = Math.floor((minX - originX + h) / cell)
  const x1 = Math.floor((maxX - originX + h) / cell)
  const z0 = Math.floor((minZ - originZ + h) / cell)
  const z1 = Math.floor((maxZ - originZ + h) / cell)
  for (let iz = z0; iz <= z1; iz++) {
    for (let ix = x0; ix <= x1; ix++) {
      const p = cellCenter(map, ix, iz)
      if (pointInRing(p.x, p.z, ring)) setCell(map, ix, iz, kind, priority)
    }
  }
}

/** Oriented footprint → clear cells (blocked). */
function clearFootprint(map: WalkableMap, b: BuildingInstance) {
  const cos = Math.cos(b.yaw)
  const sin = Math.sin(b.yaw)
  const hw = b.width * 0.5
  const hd = b.depth * 0.5
  const ex = Math.abs(cos) * hw + Math.abs(sin) * hd
  const ez = Math.abs(sin) * hw + Math.abs(cos) * hd
  const { cell, halfExtent: h, originX, originZ } = map
  const x0 = Math.floor((b.x - ex - originX + h) / cell)
  const x1 = Math.floor((b.x + ex - originX + h) / cell)
  const z0 = Math.floor((b.z - ez - originZ + h) / cell)
  const z1 = Math.floor((b.z + ez - originZ + h) / cell)
  for (let iz = z0; iz <= z1; iz++) {
    for (let ix = x0; ix <= x1; ix++) {
      const p = cellCenter(map, ix, iz)
      const dx = p.x - b.x
      const dz = p.z - b.z
      const lx = dx * cos - dz * sin
      const lz = dx * sin + dz * cos
      if (Math.abs(lx) <= hw && Math.abs(lz) <= hd) {
        const i = iz * map.n + ix
        if (i >= 0 && i < map.cells.length) map.cells[i] = WALK_NONE
      }
    }
  }
}

function segmentHitsWindow(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  pad: number,
  ox: number,
  oz: number,
  half: number,
): boolean {
  const minX = Math.min(ax, bx) - pad
  const maxX = Math.max(ax, bx) + pad
  const minZ = Math.min(az, bz) - pad
  const maxZ = Math.max(az, bz) + pad
  return !(maxX < ox - half || minX > ox + half || maxZ < oz - half || minZ > oz + half)
}

function ringHitsWindow(
  ring: { x: number; z: number }[],
  ox: number,
  oz: number,
  half: number,
): boolean {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const p of ring) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.z < minZ) minZ = p.z
    if (p.z > maxZ) maxZ = p.z
  }
  return !(maxX < ox - half || minX > ox + half || maxZ < oz - half || minZ > oz + half)
}

/**
 * Build a walkable window around origin — never the full field.
 * Rebuild when the player leaves the recenter radius.
 */
export function buildWalkableMap(
  graph: RoadGraph,
  roads: RoadNetworkParams,
  plots: MorphPlot[],
  landById: ReadonlyMap<number, PlotLandUse>,
  buildings: BuildingInstance[],
  _heightAt: HeightFn,
  cell = 0.5,
  window: WalkWindowOpts = { originX: 0, originZ: 0 },
): WalkableMap {
  const originX = window.originX
  const originZ = window.originZ
  const halfExtent = Math.max(8, window.windowHalf ?? JUMP_WALK_WINDOW_HALF)
  const n = Math.max(4, Math.ceil((halfExtent * 2) / cell))
  const map: WalkableMap = {
    originX,
    originZ,
    halfExtent,
    cell,
    n,
    cells: new Uint8Array(n * n),
    rule: '',
  }

  const walk = Math.max(0, roads.sidewalkWidth)
  let roadCells = 0
  let walkCells = 0
  let openCells = 0
  const pad = Math.max(roads.mainWidth, roads.collectorWidth, roads.localWidth) + walk + 1

  // 1) Road surfaces (edges that meet the window)
  for (const e of graph.edges) {
    const a = getNode(graph, e.nodeA)
    const b = getNode(graph, e.nodeB)
    if (!a || !b) continue
    const half = edgeHalfWidth(e, roads)
    if (!segmentHitsWindow(a.x, a.z, b.x, b.z, half + pad, originX, originZ, halfExtent)) continue
    stampRoadStrip(map, a.x, a.z, b.x, b.z, half, WALK_ROAD, 1)
  }

  // 2) Junction crossings — full-speed road near degree ≥ 3 nodes
  const deg = new Map<number, number>()
  for (const nNode of graph.nodes) deg.set(nNode.id, 0)
  for (const e of graph.edges) {
    deg.set(e.nodeA, (deg.get(e.nodeA) ?? 0) + 1)
    deg.set(e.nodeB, (deg.get(e.nodeB) ?? 0) + 1)
  }
  const crossR = Math.max(roads.cornerRadius, roads.mainWidth + walk)
  for (const nNode of graph.nodes) {
    if ((deg.get(nNode.id) ?? 0) < 3) continue
    if (Math.abs(nNode.x - originX) > halfExtent + crossR) continue
    if (Math.abs(nNode.z - originZ) > halfExtent + crossR) continue
    stampDisk(map, nNode.x, nNode.z, crossR, WALK_ROAD_CROSS, 3)
  }

  // 3) Sidewalks (outer strip, both sides)
  if (walk >= 0.05) {
    for (const e of graph.edges) {
      const a = getNode(graph, e.nodeA)
      const b = getNode(graph, e.nodeB)
      if (!a || !b) continue
      const half = edgeHalfWidth(e, roads)
      if (!segmentHitsWindow(a.x, a.z, b.x, b.z, half + walk + 1, originX, originZ, halfExtent))
        continue
      stampBand(map, a.x, a.z, b.x, b.z, half, half + walk, WALK_SIDEWALK, 4)
    }
  }

  // 4) Parks, farms, open plots / plazas
  for (const plot of plots) {
    const lu = landById.get(plot.id)
    const isPark = lu?.use === 'park' || lu?.use === 'farm'
    const isOpen = plot.open
    if (!isPark && !isOpen) continue
    if (plot.ring.length < 3) continue
    if (!ringHitsWindow(plot.ring, originX, originZ, halfExtent)) continue
    stampRing(map, plot.ring, WALK_OPEN, 2)
  }

  // 5) Punch building footprints in-window
  for (const b of buildings) {
    if (b.width < 0.2 || b.depth < 0.2) continue
    const ex = Math.hypot(b.width, b.depth) * 0.5
    if (Math.abs(b.x - originX) > halfExtent + ex) continue
    if (Math.abs(b.z - originZ) > halfExtent + ex) continue
    clearFootprint(map, b)
  }

  for (let i = 0; i < map.cells.length; i++) {
    const k = map.cells[i]!
    if (k === WALK_ROAD || k === WALK_ROAD_CROSS) roadCells += 1
    else if (k === WALK_SIDEWALK) walkCells += 1
    else if (k === WALK_OPEN) openCells += 1
  }

  map.rule = `[jump] walkable window ${n}×${n} @ ${cell.toFixed(2)} · ±${halfExtent.toFixed(0)}m @ (${originX.toFixed(1)}, ${originZ.toFixed(1)}) · walk ${walkCells} · road ${roadCells} · open ${openCells}`
  return map
}

/**
 * Ring search for nearest walkable cell center.
 * Hard-capped radius + iteration count — never scans the whole grid.
 * Deterministic: smaller distance, then lower iz, then lower ix.
 */
export function nearestWalkable(
  map: WalkableMap,
  x: number,
  z: number,
  maxR = NEAREST_WALK_MAX_R,
  maxIters = NEAREST_WALK_MAX_ITERS,
): { x: number; z: number } | null {
  const { n } = map
  const start = worldToCell(map, x, z)
  const rCap = Math.min(Math.max(0, maxR), Math.max(n, 4))
  let bestX = 0
  let bestZ = 0
  let bestD = Infinity
  let bestIz = 0
  let bestIx = 0
  let found = false
  let iters = 0

  for (let r = 0; r <= rCap; r++) {
    const iz0 = start.iz - r
    const iz1 = start.iz + r
    const ix0 = start.ix - r
    const ix1 = start.ix + r
    for (let iz = iz0; iz <= iz1; iz++) {
      for (let ix = ix0; ix <= ix1; ix++) {
        if (r > 0 && iz !== iz0 && iz !== iz1 && ix !== ix0 && ix !== ix1) continue
        if (ix < 0 || iz < 0 || ix >= n || iz >= n) continue
        iters += 1
        if (iters > maxIters) return found ? { x: bestX, z: bestZ } : null
        const kind = map.cells[iz * n + ix]! as WalkKind
        if (!isWalkable(kind)) continue
        const c = cellCenter(map, ix, iz)
        const d = (c.x - x) * (c.x - x) + (c.z - z) * (c.z - z)
        if (
          !found ||
          d < bestD - 1e-9 ||
          (Math.abs(d - bestD) <= 1e-9 && (iz < bestIz || (iz === bestIz && ix < bestIx)))
        ) {
          found = true
          bestD = d
          bestX = c.x
          bestZ = c.z
          bestIz = iz
          bestIx = ix
        }
      }
    }
    if (found) return { x: bestX, z: bestZ }
  }
  return null
}

/**
 * First sidewalk cell in deterministic scan order (iz, then ix).
 * Falls back to any walkable cell if no sidewalk exists in the window.
 */
export function firstSidewalkPoint(map: WalkableMap): { x: number; z: number } | null {
  const { n } = map
  let fallback: { x: number; z: number } | null = null
  for (let iz = 0; iz < n; iz++) {
    for (let ix = 0; ix < n; ix++) {
      const kind = map.cells[iz * n + ix]! as WalkKind
      if (kind === WALK_SIDEWALK) return cellCenter(map, ix, iz)
      if (!fallback && isWalkable(kind)) fallback = cellCenter(map, ix, iz)
    }
  }
  return fallback
}
