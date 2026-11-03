/**
 * Plots from closed road loops: inset from the curb, split oversized blocks.
 * Deterministic. No randomness.
 */

import type { HeightFn, Vec2 } from './directionField.ts'
import type { RoadGraph, RoadNode } from './roadGraph.ts'

export type Plot = {
  id: number
  nodeIds: number[]
  ring: Vec2[]
  area: number
}

const AREA_EPS = 8
const INSET = 1.35
const MAX_AREA_FACTOR = 0.85
const MAX_SPAN_FACTOR = 1.35

export function nodeMap(graph: RoadGraph) {
  const m = new Map<number, RoadNode>()
  for (const n of graph.nodes) m.set(n.id, n)
  return m
}

function polar(from: RoadNode, to: RoadNode) {
  return Math.atan2(to.z - from.z, to.x - from.x)
}

export function signedArea(ring: Vec2[]) {
  let a = 0
  const n = ring.length
  for (let i = 0; i < n; i++) {
    const p = ring[i]!
    const q = ring[(i + 1) % n]!
    a += p.x * q.z - q.x * p.z
  }
  return a * 0.5
}

export function ringOf(ids: number[], nodes: Map<number, RoadNode>): Vec2[] {
  const ring: Vec2[] = []
  for (const id of ids) {
    const n = nodes.get(id)
    if (n) ring.push({ x: n.x, z: n.z })
  }
  return ring
}

function buildAdj(graph: RoadGraph, nodes: Map<number, RoadNode>) {
  const adj = new Map<number, { to: number; edgeId: number; ang: number }[]>()
  const add = (from: number, to: number, edgeId: number) => {
    const a = nodes.get(from)
    const b = nodes.get(to)
    if (!a || !b) return
    let list = adj.get(from)
    if (!list) {
      list = []
      adj.set(from, list)
    }
    list.push({ to, edgeId, ang: polar(a, b) })
  }
  for (const e of graph.edges) {
    add(e.nodeA, e.nodeB, e.id)
    add(e.nodeB, e.nodeA, e.id)
  }
  for (const list of adj.values()) list.sort((x, y) => x.ang - y.ang)
  return adj
}

function nextCW(
  adj: Map<number, { to: number; edgeId: number; ang: number }[]>,
  v: number,
  prev: number,
): number | null {
  const nbrs = adj.get(v)
  if (!nbrs || nbrs.length === 0) return null
  const i = nbrs.findIndex((n) => n.to === prev)
  if (i < 0) return nbrs[0]!.to
  const k = (i - 1 + nbrs.length) % nbrs.length
  return nbrs[k]!.to
}

export function walkFaces(graph: RoadGraph, nodes: Map<number, RoadNode>): number[][] {
  const adj = buildAdj(graph, nodes)
  const used = new Set<string>()
  const faces: number[][] = []
  const key = (a: number, b: number) => `${a}>${b}`

  for (const e of graph.edges) {
    const starts: [number, number][] = [
      [e.nodeA, e.nodeB],
      [e.nodeB, e.nodeA],
    ]
    for (const [sa, sb] of starts) {
      if (used.has(key(sa, sb))) continue
      const face: number[] = []
      let a = sa
      let b = sb
      let guard = 0
      let ok = true
      while (guard++ < 64) {
        if (used.has(key(a, b))) {
          ok = false
          break
        }
        used.add(key(a, b))
        face.push(a)
        const nxt = nextCW(adj, b, a)
        if (nxt == null) {
          ok = false
          break
        }
        a = b
        b = nxt
        if (a === sa && b === sb) break
      }
      if (ok && face.length >= 3) faces.push(face)
    }
  }
  return faces
}

export function insetRing(ring: Vec2[], dist: number): Vec2[] | null {
  const n = ring.length
  if (n < 3) return null
  const out: Vec2[] = []
  for (let i = 0; i < n; i++) {
    const prev = ring[(i + n - 1) % n]!
    const cur = ring[i]!
    const next = ring[(i + 1) % n]!
    let e1x = cur.x - prev.x
    let e1z = cur.z - prev.z
    let e2x = next.x - cur.x
    let e2z = next.z - cur.z
    const l1 = Math.hypot(e1x, e1z) || 1
    const l2 = Math.hypot(e2x, e2z) || 1
    e1x /= l1
    e1z /= l1
    e2x /= l2
    e2z /= l2
    const n1x = -e1z
    const n1z = e1x
    const n2x = -e2z
    const n2z = e2x
    let bx = n1x + n2x
    let bz = n1z + n2z
    const bl = Math.hypot(bx, bz)
    if (bl < 1e-8) {
      bx = n1x
      bz = n1z
    } else {
      bx /= bl
      bz /= bl
    }
    const den = bx * n1x + bz * n1z
    const scale = Math.abs(den) < 0.25 ? dist / 0.25 : dist / den
    if (!Number.isFinite(scale) || Math.abs(scale) > dist * 8) return null
    out.push({ x: cur.x + bx * scale, z: cur.z + bz * scale })
  }
  if (Math.abs(signedArea(out)) < AREA_EPS * 0.25) return null
  if (signedArea(out) * signedArea(ring) < 0) return null
  return out
}

export function bbox(ring: Vec2[]) {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const p of ring) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minZ = Math.min(minZ, p.z)
    maxZ = Math.max(maxZ, p.z)
  }
  return { minX, maxX, minZ, maxZ, w: maxX - minX, h: maxZ - minZ }
}

export function clip(ring: Vec2[], keep: (p: Vec2, q: Vec2) => Vec2 | null, inside: (p: Vec2) => boolean) {
  const out: Vec2[] = []
  const n = ring.length
  for (let i = 0; i < n; i++) {
    const s = ring[i]!
    const e = ring[(i + 1) % n]!
    const sin = inside(s)
    const ein = inside(e)
    if (sin && ein) out.push(e)
    else if (sin && !ein) {
      const hit = keep(s, e)
      if (hit) out.push(hit)
    } else if (!sin && ein) {
      const hit = keep(s, e)
      if (hit) out.push(hit)
      out.push(e)
    }
  }
  return out
}

export function splitByMid(ring: Vec2[]): [Vec2[], Vec2[]] | null {
  const b = bbox(ring)
  if (b.w < 1e-4 && b.h < 1e-4) return null
  const splitX = b.w >= b.h
  const mid = splitX ? (b.minX + b.maxX) * 0.5 : (b.minZ + b.maxZ) * 0.5
  const left = splitX
    ? clip(
        ring,
        (s, e) => {
          const t = (mid - s.x) / (e.x - s.x || 1e-9)
          return { x: mid, z: s.z + (e.z - s.z) * t }
        },
        (p) => p.x <= mid + 1e-9,
      )
    : clip(
        ring,
        (s, e) => {
          const t = (mid - s.z) / (e.z - s.z || 1e-9)
          return { x: s.x + (e.x - s.x) * t, z: mid }
        },
        (p) => p.z <= mid + 1e-9,
      )
  const right = splitX
    ? clip(
        ring,
        (s, e) => {
          const t = (mid - s.x) / (e.x - s.x || 1e-9)
          return { x: mid, z: s.z + (e.z - s.z) * t }
        },
        (p) => p.x >= mid - 1e-9,
      )
    : clip(
        ring,
        (s, e) => {
          const t = (mid - s.z) / (e.z - s.z || 1e-9)
          return { x: s.x + (e.x - s.x) * t, z: mid }
        },
        (p) => p.z >= mid - 1e-9,
      )
  if (left.length < 3 || right.length < 3) return null
  return [left, right]
}

function splitIfBig(ring: Vec2[], maxArea: number, maxSpan: number, depth: number): Vec2[][] {
  const area = Math.abs(signedArea(ring))
  const b = bbox(ring)
  if (depth >= 4 || (area <= maxArea && b.w <= maxSpan && b.h <= maxSpan)) return [ring]
  const parts = splitByMid(ring)
  if (!parts) return [ring]
  return [
    ...splitIfBig(parts[0], maxArea, maxSpan, depth + 1),
    ...splitIfBig(parts[1], maxArea, maxSpan, depth + 1),
  ]
}

export function pointInRing(ring: Vec2[], x: number, z: number) {
  let inside = false
  const n = ring.length
  for (let i = 0, j = n - 1; i < n; j = i, i++) {
    const pi = ring[i]!
    const pj = ring[j]!
    const denom = pj.z - pi.z
    const hit =
      pi.z > z !== pj.z > z && x < ((pj.x - pi.x) * (z - pi.z)) / (denom || 1e-12) + pi.x
    if (hit) inside = !inside
  }
  return inside
}

/** Draped quads inside the ring so the plot sits on the terrain without spanning tris. */
export function plotQuads(
  ring: Vec2[],
  heightAt: HeightFn,
  lift: number,
  step = 1.4,
): { x: number; y: number; z: number }[][] {
  const b = bbox(ring)
  const quads: { x: number; y: number; z: number }[][] = []
  const pad = 0.05
  const x0 = Math.floor((b.minX + pad) / step) * step
  const z0 = Math.floor((b.minZ + pad) / step) * step
  for (let x = x0; x < b.maxX - pad; x += step) {
    for (let z = z0; z < b.maxZ - pad; z += step) {
      const x1 = x + step
      const z1 = z + step
      const cx = (x + x1) * 0.5
      const cz = (z + z1) * 0.5
      if (!pointInRing(ring, cx, cz)) continue
      quads.push([
        { x, y: heightAt(x, z) + lift, z },
        { x: x1, y: heightAt(x1, z) + lift, z },
        { x: x1, y: heightAt(x1, z1) + lift, z: z1 },
        { x, y: heightAt(x, z1) + lift, z: z1 },
      ])
    }
  }
  return quads
}

/** Legacy simple plots — prefer buildMorphology for the Roads panel. */
export function buildPlots(
  graph: RoadGraph,
  spacing: number,
): { plots: Plot[]; blocks: number; log: string[] } {
  const nodes = nodeMap(graph)
  const faces = walkFaces(graph, nodes)
  const log: string[] = []
  const plots: Plot[] = []
  const maxArea = Math.max(90, spacing * spacing * MAX_AREA_FACTOR)
  const maxSpan = Math.max(10, spacing * MAX_SPAN_FACTOR)
  let id = 1
  let blocks = 0

  for (const face of faces) {
    const raw = ringOf(face, nodes)
    if (raw.length < 3) continue
    const area = signedArea(raw)
    if (area <= AREA_EPS) continue
    const inset = insetRing(raw, INSET)
    if (!inset) continue
    blocks += 1
    const pieces = splitIfBig(inset, maxArea, maxSpan, 0)
    for (const ring of pieces) {
      if (ring.length < 3) continue
      const a = Math.abs(signedArea(ring))
      if (a < AREA_EPS * 0.4) continue
      const plot: Plot = { id, nodeIds: face, ring, area: a }
      plots.push(plot)
      id++
    }
  }

  log.unshift(`[plot] rebuild · ${plots.length} plots · ${blocks} blocks`)
  return { plots, blocks, log }
}

/** Degree stats for the road census readout. */
export function degreeStats(graph: RoadGraph): { junctions: number; deadEnds: number } {
  const deg = new Map<number, number>()
  for (const n of graph.nodes) deg.set(n.id, 0)
  for (const e of graph.edges) {
    deg.set(e.nodeA, (deg.get(e.nodeA) ?? 0) + 1)
    deg.set(e.nodeB, (deg.get(e.nodeB) ?? 0) + 1)
  }
  let junctions = 0
  let deadEnds = 0
  for (const d of deg.values()) {
    if (d >= 3) junctions += 1
    else if (d === 1) deadEnds += 1
  }
  return { junctions, deadEnds }
}

