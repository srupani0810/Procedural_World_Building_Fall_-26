/**
 * Planar road graph: nodes on the ground, roads as straight XZ segments.
 * Lattice is generated oversized, then clipped to the terrain square so a
 * tilted grid still fills the field with a straight edge.
 * No randomness.
 */

import { segmentSteepness, smoothHeightAt, type HeightFn } from './directionField.ts'
import type { RoadNetworkParams, RoadTier } from './params.ts'

export type RoadNode = {
  id: number
  x: number
  z: number
}

export type RoadEdge = {
  id: number
  nodeA: number
  nodeB: number
  tier: RoadTier
}

export type RoadGraph = {
  nodes: RoadNode[]
  edges: RoadEdge[]
  nextNodeId: number
  nextEdgeId: number
}

export function emptyGraph(): RoadGraph {
  return { nodes: [], edges: [], nextNodeId: 1, nextEdgeId: 1 }
}

function fmt(n: number) {
  return n.toFixed(1)
}

function rotate(x: number, z: number, ang: number) {
  const c = Math.cos(ang)
  const s = Math.sin(ang)
  return { x: x * c - z * s, z: x * s + z * c }
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function onField(x: number, z: number, h: number, eps = 1e-6) {
  return Math.abs(x) <= h + eps && Math.abs(z) <= h + eps
}

function snapToField(x: number, z: number, h: number) {
  const e = 1e-4
  let sx = clamp(x, -h, h)
  let sz = clamp(z, -h, h)
  if (Math.abs(Math.abs(sx) - h) < e) sx = sx >= 0 ? h : -h
  if (Math.abs(Math.abs(sz) - h) < e) sz = sz >= 0 ? h : -h
  return { x: sx, z: sz }
}

function onBoundary(x: number, z: number, h: number, eps = 0.04) {
  return Math.abs(Math.abs(x) - h) <= eps || Math.abs(Math.abs(z) - h) <= eps
}

function nodeAt(graph: RoadGraph, id: number) {
  return graph.nodes.find((n) => n.id === id)
}

function hasEdge(graph: RoadGraph, a: number, b: number) {
  return graph.edges.some(
    (e) => (e.nodeA === a && e.nodeB === b) || (e.nodeA === b && e.nodeB === a),
  )
}

function tooSteep(
  heightAt: HeightFn,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  limit: number,
) {
  return segmentSteepness(heightAt, ax, az, bx, bz) > limit
}

/** Liang–Barsky clip of a segment to the closed square [-h,h]². */
function clipToSquare(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  h: number,
): { ax: number; az: number; bx: number; bz: number } | null {
  let t0 = 0
  let t1 = 1
  const dx = bx - ax
  const dz = bz - az
  const clip = (p: number, q: number) => {
    if (Math.abs(p) < 1e-12) return q >= 0
    const r = q / p
    if (p < 0) {
      if (r > t1) return false
      if (r > t0) t0 = r
    } else {
      if (r < t0) return false
      if (r < t1) t1 = r
    }
    return true
  }
  if (!clip(-dx, ax + h)) return null
  if (!clip(dx, h - ax)) return null
  if (!clip(-dz, az + h)) return null
  if (!clip(dz, h - az)) return null
  if (t0 > t1) return null
  const a = snapToField(ax + dx * t0, az + dz * t0, h)
  const b = snapToField(ax + dx * t1, az + dz * t1, h)
  if (Math.hypot(b.x - a.x, b.z - a.z) < 1e-4) return null
  return { ax: a.x, az: a.z, bx: b.x, bz: b.z }
}

function addNode(
  graph: RoadGraph,
  x: number,
  z: number,
  log: string[] | null,
  label: string,
): number {
  const id = graph.nextNodeId
  graph.nextNodeId += 1
  graph.nodes.push({ id, x, z })
  if (log) log.push(`[node] created n${id} at ${fmt(x)}, ${fmt(z)} · ${label}`)
  return id
}

function addEdge(
  graph: RoadGraph,
  a: number,
  b: number,
  heightAt: HeightFn | null,
  limit: number,
  log: string[] | null,
  label: string,
  skipCounts: { steep: number },
  tier: RoadTier = 'local',
): number | null {
  if (a === b || hasEdge(graph, a, b)) return null
  const na = nodeAt(graph, a)
  const nb = nodeAt(graph, b)
  if (!na || !nb) return null
  if (heightAt && tooSteep(heightAt, na.x, na.z, nb.x, nb.z, limit)) {
    skipCounts.steep += 1
    return null
  }
  const id = graph.nextEdgeId
  graph.nextEdgeId += 1
  graph.edges.push({ id, nodeA: a, nodeB: b, tier })
  if (log) log.push(`[road] created r${id} n${a}–n${b} · ${tier} · ${label}`)
  return id
}

/** Lattice line index → tier. Mains every mainEvery; collectors every collectorEvery. */
export function latticeTier(
  lineIndex: number,
  mainEvery: number,
  collectorEvery: number,
): RoadTier {
  const m = Math.max(1, Math.round(mainEvery))
  const c = Math.max(1, Math.round(collectorEvery))
  if (mod(lineIndex, m) === 0) return 'main'
  if (mod(lineIndex, c) === 0) return 'collector'
  return 'local'
}

function keyOf(i: number, j: number) {
  return `${i},${j}`
}

function mod(a: number, m: number) {
  return ((a % m) + m) % m
}

function qKey(x: number, z: number) {
  return `${Math.round(x * 8)},${Math.round(z * 8)}`
}

export function buildGridGraph(roads: RoadNetworkParams, heightAt: HeightFn): {
  graph: RoadGraph
  log: string[]
} {
  const graph = emptyGraph()
  const h = roads.halfExtent
  const log: string[] = [
    `[graph] lattice · field ±${h.toFixed(0)} · spacing ${roads.spacing.toFixed(0)} · angle ${roads.angleDeg.toFixed(0)}° · diagonals ${roads.diagonals ? 'on' : 'off'} · slope≤${roads.slopeLimit.toFixed(2)}`,
  ]
  const slopeH = smoothHeightAt(heightAt)
  const ang = (roads.angleDeg * Math.PI) / 180
  const s = Math.max(1, roads.spacing)
  const pad = h * (Math.abs(Math.cos(ang)) + Math.abs(Math.sin(ang)))
  const n = Math.ceil(pad / s) + 2
  const snap = new Map<string, number>()
  const skipCounts = { steep: 0 }

  const ensure = (x: number, z: number, label: string) => {
    const p = snapToField(x, z, h)
    if (!onField(p.x, p.z, h)) return null
    const k = qKey(p.x, p.z)
    const hit = snap.get(k)
    if (hit != null) return hit
    const id = addNode(graph, p.x, p.z, null, label)
    snap.set(k, id)
    return id
  }

  const clipLink = (
    ax: number,
    az: number,
    bx: number,
    bz: number,
    label: string,
    checkSlope: boolean,
    tier: RoadTier,
  ) => {
    const c = clipToSquare(ax, az, bx, bz, h)
    if (!c) return
    const a = ensure(c.ax, c.az, label)
    const b = ensure(c.bx, c.bz, label)
    if (a == null || b == null) return
    addEdge(graph, a, b, checkSlope ? slopeH : null, roads.slopeLimit, null, label, skipCounts, tier)
  }

  const pts = new Map<string, { x: number; z: number }>()
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      const p = rotate(i * s, j * s, ang)
      pts.set(keyOf(i, j), p)
      if (onField(p.x, p.z, h)) ensure(p.x, p.z, 'grid')
    }
  }

  const linkLattice = (
    i0: number,
    j0: number,
    i1: number,
    j1: number,
    label: string,
    tier: RoadTier,
  ) => {
    const a = pts.get(keyOf(i0, j0))
    const b = pts.get(keyOf(i1, j1))
    if (!a || !b) return
    clipLink(a.x, a.z, b.x, b.z, label, true, tier)
  }

  const mainEvery = roads.mainEvery
  const collectorEvery = roads.collectorEvery
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      // Horizontal link along +i: tier from constant j line.
      linkLattice(i, j, i + 1, j, 'grid', latticeTier(j, mainEvery, collectorEvery))
      // Vertical link along +j: tier from constant i line.
      linkLattice(i, j, i, j + 1, 'grid', latticeTier(i, mainEvery, collectorEvery))
    }
  }

  if (roads.diagonals) {
    const stride = Math.max(1, Math.round(roads.diagonalSpacing / s))
    if (stride === 1) {
      for (let i = -n; i < n; i++) {
        for (let j = -n; j < n; j++) {
          const a = pts.get(keyOf(i, j))
          const b = pts.get(keyOf(i + 1, j))
          const c = pts.get(keyOf(i + 1, j + 1))
          const d = pts.get(keyOf(i, j + 1))
          if (!a || !b || !c || !d) continue
          const mid = { x: (a.x + c.x) * 0.5, z: (a.z + c.z) * 0.5 }
          if (onField(mid.x, mid.z, h)) {
            clipLink(a.x, a.z, mid.x, mid.z, 'diagonal', true, 'local')
            clipLink(mid.x, mid.z, c.x, c.z, 'diagonal', true, 'local')
            clipLink(b.x, b.z, mid.x, mid.z, 'diagonal', true, 'local')
            clipLink(mid.x, mid.z, d.x, d.z, 'diagonal', true, 'local')
          } else {
            clipLink(a.x, a.z, c.x, c.z, 'diagonal', true, 'local')
            clipLink(b.x, b.z, d.x, d.z, 'diagonal', true, 'local')
          }
        }
      }
    } else {
      for (let i = -n; i <= n; i++) {
        for (let j = -n; j <= n; j++) {
          if (mod(i - j, stride) === 0) linkLattice(i, j, i + 1, j + 1, 'diagonal', 'local')
          if (mod(i + j, stride) === 0) linkLattice(i, j, i + 1, j - 1, 'diagonal', 'local')
        }
      }
    }
  }

  for (const cx of [-h, h]) {
    for (const cz of [-h, h]) ensure(cx, cz, 'edge')
  }

  const sides: { pred: (n: RoadNode) => boolean; ord: (n: RoadNode) => number }[] = [
    { pred: (n) => Math.abs(n.z - h) <= 0.05, ord: (n) => n.x },
    { pred: (n) => Math.abs(n.z + h) <= 0.05, ord: (n) => n.x },
    { pred: (n) => Math.abs(n.x - h) <= 0.05, ord: (n) => n.z },
    { pred: (n) => Math.abs(n.x + h) <= 0.05, ord: (n) => n.z },
  ]
  for (const side of sides) {
    const list = graph.nodes.filter((n) => onBoundary(n.x, n.z, h) && side.pred(n))
    list.sort((a, b) => side.ord(a) - side.ord(b) || a.id - b.id)
    for (let i = 0; i < list.length - 1; i++) {
      addEdge(graph, list[i]!.id, list[i + 1]!.id, null, roads.slopeLimit, null, 'edge', skipCounts, 'local')
    }
  }

  if (skipCounts.steep > 0) {
    log.push(`[road] skipped ${skipCounts.steep} steep`)
  }
  const mains = graph.edges.filter((e) => e.tier === 'main').length
  const colls = graph.edges.filter((e) => e.tier === 'collector').length
  const locals = graph.edges.filter((e) => e.tier === 'local').length
  log.push(`[tier] main ${mains} · collector ${colls} · local ${locals}`)
  log.unshift(`[graph] ${graph.nodes.length} nodes · ${graph.edges.length} roads`)
  return { graph, log }
}

export function moveNode(
  graph: RoadGraph,
  id: number,
  x: number,
  z: number,
): { graph: RoadGraph; log: string[] } {
  const next: RoadGraph = {
    ...graph,
    nodes: graph.nodes.map((n) => (n.id === id ? { ...n, x, z } : n)),
  }
  return { graph: next, log: [`[node] moved n${id} to ${fmt(x)}, ${fmt(z)}`] }
}

export function closestPointOnEdge(
  graph: RoadGraph,
  edgeId: number,
  x: number,
  z: number,
): { x: number; z: number; t: number; d: number } | null {
  const e = graph.edges.find((ed) => ed.id === edgeId)
  if (!e) return null
  const a = nodeAt(graph, e.nodeA)
  const b = nodeAt(graph, e.nodeB)
  if (!a || !b) return null
  const abx = b.x - a.x
  const abz = b.z - a.z
  const len2 = abx * abx + abz * abz
  let t = 0
  if (len2 > 1e-10) t = Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.z) * abz) / len2))
  const qx = a.x + abx * t
  const qz = a.z + abz * t
  return { x: qx, z: qz, t, d: Math.hypot(x - qx, z - qz) }
}

export function pickNearest(
  graph: RoadGraph,
  x: number,
  z: number,
  nodeR: number,
  edgeR: number,
): { kind: 'node'; id: number } | { kind: 'edge'; id: number; x: number; z: number } | null {
  let bestN: { id: number; d: number } | null = null
  for (const n of graph.nodes) {
    const d = Math.hypot(n.x - x, n.z - z)
    if (d <= nodeR && (!bestN || d < bestN.d)) bestN = { id: n.id, d }
  }
  if (bestN) return { kind: 'node', id: bestN.id }
  let bestE: { id: number; d: number; x: number; z: number } | null = null
  for (const e of graph.edges) {
    const hit = closestPointOnEdge(graph, e.id, x, z)
    if (hit && hit.d <= edgeR && (!bestE || hit.d < bestE.d)) {
      bestE = { id: e.id, d: hit.d, x: hit.x, z: hit.z }
    }
  }
  if (bestE) return { kind: 'edge', id: bestE.id, x: bestE.x, z: bestE.z }
  return null
}

export function insertNodeOnEdge(
  graph: RoadGraph,
  edgeId: number,
  x: number,
  z: number,
  heightAt: HeightFn,
  slopeLimit: number,
): { graph: RoadGraph; log: string[] } | null {
  const hit = closestPointOnEdge(graph, edgeId, x, z)
  const e = graph.edges.find((ed) => ed.id === edgeId)
  if (!hit || !e) return null
  if (hit.t < 0.08 || hit.t > 0.92) return null
  const a = nodeAt(graph, e.nodeA)
  const b = nodeAt(graph, e.nodeB)
  if (!a || !b) return null

  const next: RoadGraph = {
    nodes: graph.nodes.map((n) => ({ ...n })),
    edges: graph.edges.filter((ed) => ed.id !== edgeId).map((ed) => ({ ...ed })),
    nextNodeId: graph.nextNodeId,
    nextEdgeId: graph.nextEdgeId,
  }
  const log: string[] = [`[road] deleted r${edgeId} · split`]
  const slopeH = smoothHeightAt(heightAt)
  const skip = { steep: 0 }
  const nid = addNode(next, hit.x, hit.z, log, 'split')
  addEdge(next, e.nodeA, nid, slopeH, slopeLimit, log, 'split', skip, e.tier)
  addEdge(next, nid, e.nodeB, slopeH, slopeLimit, log, 'split', skip, e.tier)
  return { graph: next, log }
}

export function connectNodes(
  graph: RoadGraph,
  a: number,
  b: number,
  heightAt: HeightFn,
  slopeLimit: number,
): { graph: RoadGraph; log: string[] } | null {
  if (a === b || hasEdge(graph, a, b)) return null
  const next: RoadGraph = {
    nodes: graph.nodes.map((n) => ({ ...n })),
    edges: graph.edges.map((e) => ({ ...e })),
    nextNodeId: graph.nextNodeId,
    nextEdgeId: graph.nextEdgeId,
  }
  const log: string[] = []
  const skip = { steep: 0 }
  const id = addEdge(next, a, b, smoothHeightAt(heightAt), slopeLimit, log, 'edit', skip, 'local')
  if (id == null) {
    if (skip.steep) return { graph, log: [`[road] skipped n${a}–n${b} · steep · edit`] }
    return null
  }
  return { graph: next, log }
}

export function deleteNode(
  graph: RoadGraph,
  id: number,
): { graph: RoadGraph; log: string[] } | null {
  if (!nodeAt(graph, id)) return null
  const log: string[] = []
  const kept: RoadEdge[] = []
  for (const e of graph.edges) {
    if (e.nodeA === id || e.nodeB === id) log.push(`[road] deleted r${e.id} · with n${id}`)
    else kept.push({ ...e })
  }
  log.push(`[node] deleted n${id}`)
  return {
    graph: {
      nodes: graph.nodes.filter((n) => n.id !== id).map((n) => ({ ...n })),
      edges: kept,
      nextNodeId: graph.nextNodeId,
      nextEdgeId: graph.nextEdgeId,
    },
    log,
  }
}

export function deleteEdge(graph: RoadGraph, id: number): { graph: RoadGraph; log: string[] } | null {
  if (!graph.edges.some((e) => e.id === id)) return null
  return {
    graph: {
      ...graph,
      nodes: graph.nodes.map((n) => ({ ...n })),
      edges: graph.edges.filter((e) => e.id !== id).map((e) => ({ ...e })),
    },
    log: [`[road] deleted r${id}`],
  }
}

export function getNode(graph: RoadGraph, id: number) {
  return nodeAt(graph, id)
}
