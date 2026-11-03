/**
 * City morphology from the road graph.
 * Blocks = closed road loops. Plots pack along each lot edge (not world AABB).
 * Deterministic — no randomness.
 */

import type { HeightFn, Vec2 } from './directionField.ts'
import type { RoadNetworkParams, RoadTier } from './params.ts'
import { tierHalfWidth } from './params.ts'
import {
  bbox,
  degreeStats,
  insetRing,
  pointInRing,
  ringOf,
  signedArea,
  walkFaces,
  nodeMap,
} from './plots.ts'
import type { RoadEdge, RoadGraph, RoadNode } from './roadGraph.ts'

export type MorphPlot = {
  id: number
  blockId: number
  blockKey: string
  ring: Vec2[]
  buildingLine: Vec2[]
  area: number
  corner: boolean
  open: boolean
  roadTouch: number
  steep: number
}

export type MorphStats = {
  blocks: number
  plots: number
  cornerPlots: number
  openPlots: number
  avgPlotArea: number
  roadShare: number
  sidewalkShare: number
  plotShare: number
  junctions: number
  deadEnds: number
}

export type BlockCacheEntry = {
  fingerprint: string
  nodeIds: number[]
  plots: Omit<MorphPlot, 'id' | 'blockId'>[]
}

export type MorphCache = {
  blocks: Map<string, BlockCacheEntry>
}

export type MorphologyResult = {
  plots: MorphPlot[]
  stats: MorphStats
  log: string[]
  curbInset: number
  cache: MorphCache
  rebuiltBlocks: number
}

const AREA_EPS = 2.5
const MIN_FRONT = 2.2
const MIN_DEPTH = 2.0

export function emptyMorphCache(): MorphCache {
  return { blocks: new Map() }
}

function centroid(ring: Vec2[]): Vec2 {
  let x = 0
  let z = 0
  for (const p of ring) {
    x += p.x
    z += p.z
  }
  const n = Math.max(1, ring.length)
  return { x: x / n, z: z / n }
}

function edgeLen(a: RoadNode, b: RoadNode) {
  return Math.hypot(b.x - a.x, b.z - a.z)
}

function canonFaceKey(nodeIds: number[]): string {
  const n = nodeIds.length
  if (n === 0) return ''
  const fwd = (s: number) => {
    const parts: number[] = []
    for (let i = 0; i < n; i++) parts.push(nodeIds[(s + i) % n]!)
    return parts.join(',')
  }
  const revIds = [...nodeIds].reverse()
  const rev = (s: number) => {
    const parts: number[] = []
    for (let i = 0; i < n; i++) parts.push(revIds[(s + i) % n]!)
    return parts.join(',')
  }
  let best = fwd(0)
  for (let s = 1; s < n; s++) {
    const a = fwd(s)
    if (a < best) best = a
  }
  for (let s = 0; s < n; s++) {
    const a = rev(s)
    if (a < best) best = a
  }
  return best
}

function morphParamKey(roads: RoadNetworkParams): string {
  return [
    roads.localWidth,
    roads.collectorWidth,
    roads.mainWidth,
    roads.sidewalkWidth,
    roads.frontSetback,
    roads.sideSetback,
    roads.backSetback,
    roads.plotFrontage,
    roads.plotDepth,
    roads.backLanes ? 1 : 0,
    roads.openPlotShare,
    roads.blockSize,
    roads.blockShape,
  ].join('|')
}

function faceFingerprint(
  nodeIds: number[],
  nodes: Map<number, RoadNode>,
  roads: RoadNetworkParams,
): string {
  const pts = nodeIds
    .map((id) => {
      const n = nodes.get(id)
      return n ? `${id}:${n.x.toFixed(3)},${n.z.toFixed(3)}` : `${id}:?`
    })
    .join(';')
  return `${pts}#${morphParamKey(roads)}`
}

function edgeLen2(a: Vec2, b: Vec2) {
  return Math.hypot(b.x - a.x, b.z - a.z)
}

/** Inward unit normal for a ring edge (works for CW or CCW). */
function inwardNormal(a: Vec2, b: Vec2, areaSign: number): Vec2 {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const len = Math.hypot(dx, dz) || 1
  // Left of A→B for CCW (positive area).
  let nx = -dz / len
  let nz = dx / len
  if (areaSign < 0) {
    nx = -nx
    nz = -nz
  }
  return { x: nx, z: nz }
}

function inwardDepth(lot: Vec2[], origin: Vec2, n: Vec2, maxD: number): number {
  if (maxD <= 0) return 0
  let lo = 0
  let hi = maxD
  // Ensure start is inside; if not, no depth.
  if (!pointInRing(lot, origin.x + n.x * 0.05, origin.z + n.z * 0.05)) return 0
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) * 0.5
    const p = { x: origin.x + n.x * mid, z: origin.z + n.z * mid }
    if (pointInRing(lot, p.x, p.z)) lo = mid
    else hi = mid
  }
  return lo
}

function lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }
}

function ringFromQuad(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2): Vec2[] {
  return [p0, p1, p2, p3]
}

type RawParcel = {
  ring: Vec2[]
  buildingLine: Vec2[]
  corner: boolean
  open: boolean
  edgeIndex: number
}

function clipRingToLot(ring: Vec2[], lot: Vec2[]): Vec2[] | null {
  const c = centroid(ring)
  if (!pointInRing(lot, c.x, c.z)) return null
  if (Math.abs(signedArea(ring)) < AREA_EPS) return null
  // Soft-pull any vertex that sits outside the lot back toward the centroid.
  const out: Vec2[] = ring.map((p) => {
    if (pointInRing(lot, p.x, p.z)) return { x: p.x, z: p.z }
    return { x: c.x + (p.x - c.x) * 0.82, z: c.z + (p.z - c.z) * 0.82 }
  })
  if (!pointInRing(lot, centroid(out).x, centroid(out).z)) return null
  if (Math.abs(signedArea(out)) < AREA_EPS) return null
  return out
}

function overlapsExisting(ring: Vec2[], existing: RawParcel[]): boolean {
  const c = centroid(ring)
  for (const e of existing) {
    if (pointInRing(e.ring, c.x, c.z)) return true
    const ec = centroid(e.ring)
    if (pointInRing(ring, ec.x, ec.z)) return true
  }
  return false
}

function sampleSteep(ring: Vec2[], heightAt: HeightFn): number {
  const b = bbox(ring)
  const step = Math.max(1.2, Math.min(b.w, b.h) / 4)
  let maxS = 0
  for (let x = b.minX; x <= b.maxX; x += step) {
    for (let z = b.minZ; z <= b.maxZ; z += step) {
      if (!pointInRing(ring, x, z)) continue
      const h0 = heightAt(x, z)
      const hx = heightAt(x + 0.8, z)
      const hz = heightAt(x, z + 0.8)
      const s = Math.max(Math.abs(hx - h0), Math.abs(hz - h0)) / 0.8
      if (s > maxS) maxS = s
    }
  }
  return maxS
}

/**
 * Pack plots along every edge of the lot polygon.
 * Depth is capped to half the inward clearance so opposite edges never overlap.
 * Adjacent-edge corner overlaps are skipped (first edge keeps the corner).
 * Leftover frontage joins the last plot, or becomes an open remnant if large.
 */
function packLotAlongEdges(
  lot: Vec2[],
  roads: RoadNetworkParams,
): RawParcel[] {
  const area = signedArea(lot)
  if (Math.abs(area) < AREA_EPS) return []
  const areaSign = Math.sign(area) || 1
  const n = lot.length
  const frontage = Math.max(MIN_FRONT, roads.plotFrontage)
  const targetDepth = Math.max(MIN_DEPTH, roads.plotDepth)
  const sideGap = Math.max(0, roads.sideSetback)
  const backGap = Math.max(0, roads.backSetback)
  const out: RawParcel[] = []

  for (let ei = 0; ei < n; ei++) {
    const A = lot[ei]!
    const B = lot[(ei + 1) % n]!
    const L = edgeLen2(A, B)
    if (L < MIN_FRONT * 0.85) continue
    const N = inwardNormal(A, B, areaSign)
    const mid = lerp(A, B, 0.5)
    const probe = { x: mid.x + N.x * 0.08, z: mid.z + N.z * 0.08 }
    const avail = inwardDepth(lot, probe, N, Math.max(L, targetDepth * 4))
    const halfClear = Math.max(0, avail * 0.5 - backGap * 0.5)
    let depth = Math.min(targetDepth, halfClear)
    if (roads.backLanes) depth = Math.min(depth, Math.max(MIN_DEPTH, halfClear * 0.92))
    if (depth < MIN_DEPTH * 0.85) continue

    const cornerW = Math.min(frontage, Math.max(MIN_FRONT, depth), L * 0.42)
    type Seg = { w: number; open: boolean; corner: boolean }
    const segs: Seg[] = []
    if (L >= cornerW * 2 + MIN_FRONT * 0.9) {
      segs.push({ w: cornerW, open: false, corner: true })
      const midLen = L - 2 * cornerW
      let midCount = Math.floor((midLen + 1e-6) / frontage)
      if (midCount < 1 && midLen >= MIN_FRONT) midCount = 1
      if (midCount >= 1) {
        const gaps = Math.max(0, midCount - 1) * sideGap
        const usable = Math.max(MIN_FRONT, midLen - gaps)
        const rem = usable - midCount * frontage
        if (midCount === 1) segs.push({ w: usable, open: false, corner: false })
        else if (rem < frontage * 0.4) {
          const extra = rem / midCount
          for (let i = 0; i < midCount; i++) segs.push({ w: frontage + extra, open: false, corner: false })
        } else {
          for (let i = 0; i < midCount; i++) segs.push({ w: frontage, open: false, corner: false })
          segs.push({ w: rem, open: true, corner: false })
        }
      }
      segs.push({ w: cornerW, open: false, corner: true })
    } else {
      segs.push({ w: L, open: false, corner: false })
    }

    let cursor = 0
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i]!
      const t0 = cursor / L
      cursor += seg.w
      const t1 = cursor / L
      if (i < segs.length - 1) {
        const nxt = segs[i + 1]!
        if (!seg.corner && !nxt.corner) cursor += sideGap
      }
      const p0 = lerp(A, B, t0)
      const p1 = lerp(A, B, Math.min(1, t1))
      const p2 = { x: p1.x + N.x * depth, z: p1.z + N.z * depth }
      const p3 = { x: p0.x + N.x * depth, z: p0.z + N.z * depth }
      const ring = clipRingToLot(ringFromQuad(p0, p1, p2, p3), lot)
      if (!ring || overlapsExisting(ring, out)) continue
      const blDepth = Math.max(0.2, Math.min(depth * 0.35, backGap + 0.25))
      const buildingLine =
        clipRingToLot(
          ringFromQuad(
            { x: p0.x + N.x * blDepth, z: p0.z + N.z * blDepth },
            { x: p1.x + N.x * blDepth, z: p1.z + N.z * blDepth },
            { x: p2.x - N.x * blDepth * 0.25, z: p2.z - N.z * blDepth * 0.25 },
            { x: p3.x - N.x * blDepth * 0.25, z: p3.z - N.z * blDepth * 0.25 },
          ),
          lot,
        ) ?? ring
      out.push({
        ring,
        buildingLine,
        corner: seg.corner && !seg.open,
        open: seg.open,
        edgeIndex: ei,
      })
    }
  }

  return out
}

function fillBlock(
  nodeIds: number[],
  nodes: Map<number, RoadNode>,
  roads: RoadNetworkParams,
  heightAt: HeightFn,
  curbInset: number,
): Omit<MorphPlot, 'id' | 'blockId'>[] {
  const raw = ringOf(nodeIds, nodes)
  if (raw.length < 3) return []
  if (signedArea(raw) <= AREA_EPS) return []

  // Centerline → past road half + sidewalk → past front setback = plottable lot.
  const afterWalk = insetRing(raw, curbInset)
  if (!afterWalk) return []
  const lot =
    roads.frontSetback > 0.02
      ? insetRing(afterWalk, roads.frontSetback) ?? afterWalk
      : afterWalk
  const lotArea = Math.abs(signedArea(lot))
  const minPlotArea = MIN_FRONT * MIN_DEPTH * 0.75
  const blockKey = canonFaceKey(nodeIds)

  // Too small for a normal plot → whole lot is one open plot.
  if (lotArea < minPlotArea) {
    return [
      {
        blockKey,
        ring: lot,
        buildingLine: lot,
        area: lotArea,
        corner: false,
        open: true,
        roadTouch: raw.length,
        steep: sampleSteep(lot, heightAt),
      },
    ]
  }

  const parcels = packLotAlongEdges(lot, roads)
  if (parcels.length === 0) {
    return [
      {
        blockKey,
        ring: lot,
        buildingLine: lot,
        area: lotArea,
        corner: false,
        open: true,
        roadTouch: 1,
        steep: sampleSteep(lot, heightAt),
      },
    ]
  }

  return parcels.map((p) => ({
    blockKey,
    ring: p.ring,
    buildingLine: p.buildingLine,
    area: Math.abs(signedArea(p.ring)),
    corner: p.corner,
    open: p.open,
    roadTouch: p.corner ? 2 : 1,
    steep: sampleSteep(p.ring, heightAt),
  }))
}

function roadArea(graph: RoadGraph, roads: RoadNetworkParams) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  let area = 0
  for (const e of graph.edges) {
    const a = byId.get(e.nodeA)
    const b = byId.get(e.nodeB)
    if (!a || !b) continue
    area += edgeLen(a, b) * 2 * tierHalfWidth(roads, e.tier)
  }
  // Rough junction correction: each deg≥3 node over-counts ~ halfW² overlap.
  const deg = new Map<number, number>()
  for (const n of graph.nodes) deg.set(n.id, 0)
  for (const e of graph.edges) {
    deg.set(e.nodeA, (deg.get(e.nodeA) ?? 0) + 1)
    deg.set(e.nodeB, (deg.get(e.nodeB) ?? 0) + 1)
  }
  for (const n of graph.nodes) {
    const d = deg.get(n.id) ?? 0
    if (d < 3) continue
    const w = roads.localWidth
    area -= w * w * Math.max(0, d - 2) * 0.35
  }
  return Math.max(0, area)
}

function sidewalkArea(graph: RoadGraph, roads: RoadNetworkParams) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  let area = 0
  const w = Math.max(0, roads.sidewalkWidth)
  for (const e of graph.edges) {
    const a = byId.get(e.nodeA)
    const b = byId.get(e.nodeB)
    if (!a || !b) continue
    area += edgeLen(a, b) * 2 * w
  }
  return area
}

/** Exclusive shares: roads, then sidewalks, then plots, never summing past 100%. */
function exclusiveShares(roadA: number, walkA: number, plotA: number, field: number) {
  if (field <= 0) return { roadShare: 0, sidewalkShare: 0, plotShare: 0 }
  let r = Math.max(0, roadA) / field
  let s = Math.max(0, walkA) / field
  let p = Math.max(0, plotA) / field
  if (r > 1) r = 1
  if (r + s > 1) s = Math.max(0, 1 - r)
  if (r + s + p > 1) p = Math.max(0, 1 - r - s)
  return { roadShare: r, sidewalkShare: s, plotShare: p }
}

export function buildMorphology(
  graph: RoadGraph,
  roads: RoadNetworkParams,
  heightAt: HeightFn,
  prevCache: MorphCache = emptyMorphCache(),
): MorphologyResult {
  const log: string[] = []
  const nodes = nodeMap(graph)
  const faces = walkFaces(graph, nodes)
  const curbInset =
    Math.max(roads.localWidth, roads.collectorWidth * 0.75, roads.mainWidth * 0.55) +
    Math.max(0, roads.sidewalkWidth)

  const nextCache: MorphCache = { blocks: new Map() }
  const plots: MorphPlot[] = []
  let blockId = 0
  let rebuiltBlocks = 0
  let reusedBlocks = 0
  let id = 1

  for (const face of faces) {
    if (face.length < 3) continue
    const raw = ringOf(face, nodes)
    if (raw.length < 3 || signedArea(raw) <= AREA_EPS) continue
    const key = canonFaceKey(face)
    const fp = faceFingerprint(face, nodes, roads)
    blockId += 1
    const cached = prevCache.blocks.get(key)
    let rawPlots: Omit<MorphPlot, 'id' | 'blockId'>[]
    if (cached && cached.fingerprint === fp) {
      rawPlots = cached.plots
      reusedBlocks += 1
    } else {
      rawPlots = fillBlock(face, nodes, roads, heightAt, curbInset)
      rebuiltBlocks += 1
    }
    nextCache.blocks.set(key, { fingerprint: fp, nodeIds: face, plots: rawPlots })
    for (const p of rawPlots) {
      plots.push({
        ...p,
        id,
        blockId,
      })
      id += 1
    }
  }

  // Open-plot share by steepness (only among non-already-open remnants).
  const share = Math.max(0, Math.min(1, roads.openPlotShare))
  const candidates = plots.filter((p) => !p.open)
  const openN = Math.floor(plots.length * share)
  const ranked = [...candidates].sort((a, b) => {
    if (b.steep !== a.steep) return b.steep - a.steep
    return b.area - a.area || a.id - b.id
  })
  let taggedOpen = 0
  for (let i = 0; i < ranked.length && taggedOpen < openN; i++) {
    const p = ranked[i]!
    if (p.corner) continue // keep corner lots claimable/buildable in spirit
    p.open = true
    taggedOpen += 1
    log.push(
      `[open] plot p${p.id} · steep ${p.steep.toFixed(2)} · area ${p.area.toFixed(0)} · rule steepest`,
    )
  }

  const cornerPlots = plots.filter((p) => p.corner).length
  const openPlots = plots.filter((p) => p.open).length
  const plotArea = plots.reduce((s, p) => s + p.area, 0)
  const fieldArea = (2 * roads.halfExtent) ** 2
  const rArea = roadArea(graph, roads)
  const sArea = sidewalkArea(graph, roads)
  const shares = exclusiveShares(rArea, sArea, plotArea, fieldArea)
  const deg = degreeStats(graph)

  log.unshift(
    `[morph] blocks ${blockId} · plots ${plots.length} · corner ${cornerPlots} · open ${openPlots} · rebuilt ${rebuiltBlocks} · cached ${reusedBlocks}`,
  )
  log.push(
    `[morph] curb ${curbInset.toFixed(2)} (= road½+walk) · front ${roads.frontSetback.toFixed(2)} · edge-pack frontage ${roads.plotFrontage.toFixed(1)} depth ${roads.plotDepth.toFixed(1)}`,
  )
  log.push(
    `[morph] land roads ${(shares.roadShare * 100).toFixed(1)}% · walks ${(shares.sidewalkShare * 100).toFixed(1)}% · plots ${(shares.plotShare * 100).toFixed(1)}% · sum ${((shares.roadShare + shares.sidewalkShare + shares.plotShare) * 100).toFixed(1)}%`,
  )

  return {
    plots,
    curbInset,
    rebuiltBlocks,
    cache: nextCache,
    stats: {
      blocks: blockId,
      plots: plots.length,
      cornerPlots,
      openPlots,
      avgPlotArea: plots.length ? plotArea / plots.length : 0,
      roadShare: shares.roadShare,
      sidewalkShare: shares.sidewalkShare,
      plotShare: shares.plotShare,
      junctions: deg.junctions,
      deadEnds: deg.deadEnds,
    },
    log,
  }
}

export function edgeHalfWidth(e: RoadEdge, roads: RoadNetworkParams) {
  return tierHalfWidth(roads, e.tier)
}

export type { RoadTier }
