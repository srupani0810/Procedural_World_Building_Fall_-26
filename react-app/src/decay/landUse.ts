/**
 * DECAY land use — rule-ordered assignment per morphology plot.
 * Deterministic. No Math.random. Does not mutate the road graph.
 */

import type { MorphPlot } from './morphology.ts'
import type { RoadNetworkParams } from './params.ts'
import type { RoadEdge, RoadGraph, RoadNode } from './roadGraph.ts'

export type LandUse =
  | 'industry'
  | 'commerce'
  | 'housing'
  | 'civic'
  | 'park'
  | 'farm'
  | 'yard'

export type PlotLandUse = {
  plotId: number
  use: LandUse
  /** Short rule label for hover / log. */
  rule: string
}

export type LandUseCounts = Record<LandUse, number>

/**
 * Building color view.
 * - normal: material / Before parts palette (no land or stage wash)
 * - landUse / stage / both: tint overlays for analysis
 */
export type LandUseViewMode = 'normal' | 'landUse' | 'stage' | 'both'

export const LAND_USE_ORDER: LandUse[] = [
  'industry',
  'commerce',
  'housing',
  'civic',
  'park',
  'farm',
  'yard',
]

/** Distinct colors per type (buildings + legend). */
export const LAND_USE_COLORS: Record<LandUse, string> = {
  industry: '#8a6a4a',
  commerce: '#c4a035',
  housing: '#9a8a78',
  civic: '#5a6a8a',
  park: '#3d6b45',
  farm: '#8a9a4a',
  yard: '#6a5a52',
}

/** Shader / instance index 0..6 matching LAND_USE_ORDER for built types + ground. */
export function landUseIndex(use: LandUse): number {
  const i = LAND_USE_ORDER.indexOf(use)
  return i < 0 ? 2 : i
}

export function isGroundOnly(use: LandUse): boolean {
  return use === 'park' || use === 'farm'
}

export const emptyLandUseCounts = (): LandUseCounts => ({
  industry: 0,
  commerce: 0,
  housing: 0,
  civic: 0,
  park: 0,
  farm: 0,
  yard: 0,
})

/**
 * Fixed thresholds. "Flat" is relative (≤ median steep) — absolute steep on this
 * terrain is rarely under 0.2, so a hard cap left Industry/Farm empty.
 */
export const LAND_USE_DEFAULTS = {
  /** Rim (0–1) above this = outer edge (Farm). */
  outerRim: 0.72,
  /** Rim below this = near center / core (Commerce). */
  coreRim: 0.48,
  /** Rim above this = outside the core (Industry / Yard). */
  outsideCoreRim: 0.42,
  /** World units — near a main / collector edge. */
  mainNear: 16,
  collectorNear: 18,
  /** World units — near a junction (deg ≥ 3) stands in for corner frontage. */
  junctionNear: 18,
} as const

/**
 * Target plot shares (Housing = remainder). Parks stay = open plots (~6–8% via
 * morphology open share). Quotas are filled in rule order — no Math.random.
 */
export const LAND_USE_TARGETS = {
  farm: 0.07,
  industry: 0.12,
  commerce: 0.1,
  yard: 0.015,
  civic: 0.025,
} as const

export type LandUseParams = typeof LAND_USE_DEFAULTS

function quotaCount(total: number, share: number) {
  return Math.max(0, Math.round(total * share))
}

type PlotFeat = {
  plot: MorphPlot
  cx: number
  cz: number
  rim: number
  flat: boolean
  distMain: number
  distCollector: number
  distJunction: number
  nearMain: boolean
  nearCollector: boolean
  nearJunction: boolean
  outsideCore: boolean
  nearCenter: boolean
  outer: boolean
}

function ringCentroid(ring: { x: number; z: number }[]) {
  let x = 0
  let z = 0
  for (const p of ring) {
    x += p.x
    z += p.z
  }
  const n = Math.max(1, ring.length)
  return { x: x / n, z: z / n }
}

function distPointSeg(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const dx = bx - ax
  const dz = bz - az
  const len2 = dx * dx + dz * dz
  if (len2 < 1e-12) return Math.hypot(px - ax, pz - az)
  let t = ((px - ax) * dx + (pz - az) * dz) / len2
  if (t < 0) t = 0
  else if (t > 1) t = 1
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz))
}

function distToTier(
  cx: number,
  cz: number,
  graph: RoadGraph,
  nodes: Map<number, RoadNode>,
  tier: RoadEdge['tier'],
): number {
  let best = Infinity
  for (const e of graph.edges) {
    if (e.tier !== tier) continue
    const a = nodes.get(e.nodeA)
    const b = nodes.get(e.nodeB)
    if (!a || !b) continue
    const d = distPointSeg(cx, cz, a.x, a.z, b.x, b.z)
    if (d < best) best = d
  }
  return best
}

function junctionNodes(graph: RoadGraph): RoadNode[] {
  const deg = new Map<number, number>()
  for (const n of graph.nodes) deg.set(n.id, 0)
  for (const e of graph.edges) {
    deg.set(e.nodeA, (deg.get(e.nodeA) ?? 0) + 1)
    deg.set(e.nodeB, (deg.get(e.nodeB) ?? 0) + 1)
  }
  return graph.nodes.filter((n) => (deg.get(n.id) ?? 0) >= 3)
}

function distToJunctions(cx: number, cz: number, junctions: RoadNode[]): number {
  let best = Infinity
  for (const n of junctions) {
    const d = Math.hypot(cx - n.x, cz - n.z)
    if (d < best) best = d
  }
  return best
}

function edgeLength(e: RoadEdge, nodes: Map<number, RoadNode>) {
  const a = nodes.get(e.nodeA)
  const b = nodes.get(e.nodeB)
  if (!a || !b) return 0
  return Math.hypot(b.x - a.x, b.z - a.z)
}

/** Longest main edge — the Yard corridor spine (deterministic). */
function pickYardSpine(
  graph: RoadGraph,
  nodes: Map<number, RoadNode>,
): RoadEdge | null {
  let best: RoadEdge | null = null
  let bestLen = -1
  for (const e of graph.edges) {
    if (e.tier !== 'main') continue
    const len = edgeLength(e, nodes)
    if (len > bestLen || (len === bestLen && best && e.id < best.id)) {
      best = e
      bestLen = len
    }
  }
  return best
}

function alongEdge(
  cx: number,
  cz: number,
  e: RoadEdge,
  nodes: Map<number, RoadNode>,
): number {
  const a = nodes.get(e.nodeA)
  const b = nodes.get(e.nodeB)
  if (!a || !b) return 0
  const dx = b.x - a.x
  const dz = b.z - a.z
  return (cx - a.x) * dx + (cz - a.z) * dz
}

/** Median steep among non-open plots — relative flatness, no Math.random. */
function medianSteep(plots: MorphPlot[]): number {
  const steeps = plots.filter((p) => !p.open).map((p) => p.steep)
  if (steeps.length === 0) return 0.5
  steeps.sort((a, b) => a - b)
  return steeps[Math.floor((steeps.length - 1) * 0.5)]!
}

export type PlotMainProximity = {
  plotId: number
  cx: number
  cz: number
  distMain: number
  nearMain: boolean
  steep: number
  area: number
}

/** Main-road distance per plot — shared by housing / industry form pickers. */
export function plotMainProximity(
  plots: MorphPlot[],
  graph: RoadGraph,
  params: LandUseParams = LAND_USE_DEFAULTS,
): Map<number, PlotMainProximity> {
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]))
  const out = new Map<number, PlotMainProximity>()
  for (const plot of plots) {
    const c = ringCentroid(plot.ring.length >= 3 ? plot.ring : plot.buildingLine)
    const distMain = distToTier(c.x, c.z, graph, nodes, 'main')
    out.set(plot.id, {
      plotId: plot.id,
      cx: c.x,
      cz: c.z,
      distMain,
      nearMain: distMain <= params.mainNear,
      steep: plot.steep,
      area: plot.area,
    })
  }
  return out
}

function buildFeatures(
  plots: MorphPlot[],
  graph: RoadGraph,
  halfExtent: number,
  params: LandUseParams,
): PlotFeat[] {
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]))
  const junctions = junctionNodes(graph)
  const half = Math.max(1, halfExtent)
  const flatCap = medianSteep(plots)
  const out: PlotFeat[] = []
  for (const plot of plots) {
    const c = ringCentroid(plot.ring.length >= 3 ? plot.ring : plot.buildingLine)
    const rim = Math.min(1, Math.hypot(c.x, c.z) / half)
    const distMain = distToTier(c.x, c.z, graph, nodes, 'main')
    const distCollector = distToTier(c.x, c.z, graph, nodes, 'collector')
    const distJunction = distToJunctions(c.x, c.z, junctions)
    out.push({
      plot,
      cx: c.x,
      cz: c.z,
      rim,
      flat: plot.steep <= flatCap,
      distMain,
      distCollector,
      distJunction,
      nearMain: distMain <= params.mainNear,
      nearCollector: distCollector <= params.collectorNear,
      nearJunction: distJunction <= params.junctionNear,
      outsideCore: rim >= params.outsideCoreRim,
      nearCenter: rim <= params.coreRim,
      outer: rim >= params.outerRim,
    })
  }
  return out
}

/**
 * Assign one land use per plot. Rule order is fixed; each non-housing type is
 * capped to LAND_USE_TARGETS so the mix stays city-like. Housing = remainder.
 */
export function assignLandUse(
  plots: MorphPlot[],
  graph: RoadGraph,
  roads: Pick<RoadNetworkParams, 'halfExtent'>,
  params: LandUseParams = LAND_USE_DEFAULTS,
): {
  assignments: PlotLandUse[]
  byId: Map<number, PlotLandUse>
  counts: LandUseCounts
  summary: string
} {
  const feats = buildFeatures(plots, graph, roads.halfExtent, params)
  const total = Math.max(1, feats.length)
  const byId = new Map<number, PlotLandUse>()
  const taken = new Set<number>()

  const set = (plotId: number, use: LandUse, rule: string) => {
    byId.set(plotId, { plotId, use, rule })
    taken.add(plotId)
  }

  const takeRanked = (
    candidates: PlotFeat[],
    limit: number,
    use: LandUse,
    rule: string,
  ) => {
    const n = Math.min(limit, candidates.length)
    for (let i = 0; i < n; i++) set(candidates[i]!.plot.id, use, rule)
  }

  // 1. Open → Park (share follows morphology openPlotShare, target band 6–8%)
  for (const f of feats) {
    if (f.plot.open) set(f.plot.id, 'park', 'open→park')
  }

  // Reserve Yard corridor before Industry eats main-road lots (assigned in slot 5).
  // Candidates: outside-core plots near *any* main edge, ordered along the longest spine.
  const yardCap = quotaCount(total, LAND_USE_TARGETS.yard)
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]))
  const spine = pickYardSpine(graph, nodes)
  const yardReserved = new Set<number>()
  if (spine && yardCap > 0) {
    const yardCandidates = feats
      .filter(
        (f) =>
          !taken.has(f.plot.id) && f.outsideCore && f.distMain <= params.mainNear * 1.5,
      )
      .sort((a, b) => {
        const aa = alongEdge(a.cx, a.cz, spine, nodes)
        const bb = alongEdge(b.cx, b.cz, spine, nodes)
        if (aa !== bb) return aa - bb
        if (a.distMain !== b.distMain) return a.distMain - b.distMain
        return a.plot.id - b.plot.id
      })
    const run = Math.min(yardCap, yardCandidates.length)
    const start =
      yardCandidates.length <= run
        ? 0
        : Math.max(0, Math.floor((yardCandidates.length - run) / 2))
    for (let i = start; i < start + run; i++) {
      yardReserved.add(yardCandidates[i]!.plot.id)
    }
  }

  // 2. Flat outer edge → Farm (quota)
  {
    const farmCap = quotaCount(total, LAND_USE_TARGETS.farm)
    const candidates = feats
      .filter(
        (f) =>
          !taken.has(f.plot.id) &&
          !yardReserved.has(f.plot.id) &&
          f.flat &&
          f.outer,
      )
      .sort((a, b) => {
        if (b.rim !== a.rim) return b.rim - a.rim
        if (a.plot.steep !== b.plot.steep) return a.plot.steep - b.plot.steep
        return a.plot.id - b.plot.id
      })
    takeRanked(candidates, farmCap, 'farm', 'flat+outer→farm·quota')
  }

  // 3. Flat + main + outside core → Industry (quota; fill if short)
  {
    const indCap = quotaCount(total, LAND_USE_TARGETS.industry)
    const primary = feats
      .filter(
        (f) =>
          !taken.has(f.plot.id) &&
          !yardReserved.has(f.plot.id) &&
          f.flat &&
          f.nearMain &&
          f.outsideCore,
      )
      .sort((a, b) => {
        if (a.distMain !== b.distMain) return a.distMain - b.distMain
        return a.plot.id - b.plot.id
      })
    takeRanked(primary, indCap, 'industry', 'flat+main+outside-core→industry·quota')
    const need =
      indCap - [...byId.values()].filter((a) => a.use === 'industry').length
    if (need > 0) {
      const fill = feats
        .filter(
          (f) =>
            !taken.has(f.plot.id) &&
            !yardReserved.has(f.plot.id) &&
            f.nearMain &&
            f.outsideCore,
        )
        .sort((a, b) => {
          if (a.plot.steep !== b.plot.steep) return a.plot.steep - b.plot.steep
          if (a.distMain !== b.distMain) return a.distMain - b.distMain
          return a.plot.id - b.plot.id
        })
      takeRanked(fill, need, 'industry', 'main+outside-core→industry·fill-quota')
    }
  }

  // 4. Main near center → Commerce (quota); prefer junction/corner, then fill
  {
    const comCap = quotaCount(total, LAND_USE_TARGETS.commerce)
    const primary = feats
      .filter(
        (f) =>
          !taken.has(f.plot.id) &&
          !yardReserved.has(f.plot.id) &&
          f.nearMain &&
          f.nearCenter &&
          (f.plot.corner || f.nearJunction),
      )
      .sort((a, b) => {
        if (a.rim !== b.rim) return a.rim - b.rim
        if (a.distJunction !== b.distJunction) return a.distJunction - b.distJunction
        return a.plot.id - b.plot.id
      })
    takeRanked(
      primary,
      comCap,
      'commerce',
      'main+junction+core→commerce·quota',
    )
    const need =
      comCap - [...byId.values()].filter((a) => a.use === 'commerce').length
    if (need > 0) {
      const fill = feats
        .filter(
          (f) =>
            !taken.has(f.plot.id) &&
            !yardReserved.has(f.plot.id) &&
            f.nearMain &&
            f.nearCenter,
        )
        .sort((a, b) => {
          if (a.rim !== b.rim) return a.rim - b.rim
          return a.plot.id - b.plot.id
        })
      takeRanked(fill, need, 'commerce', 'main+core→commerce·fill-quota')
    }
  }

  // 5. Yard — assign reserved corridor (quota ~1–2%)
  if (spine && yardReserved.size > 0) {
    for (const id of yardReserved) {
      if (taken.has(id)) continue
      set(id, 'yard', `main-spine-r${spine.id}+outside-core→yard·quota`)
    }
  }

  // 6. Near collectors → Civic (quota ~2–3%), spaced by id
  {
    const civicCap = quotaCount(total, LAND_USE_TARGETS.civic)
    const civicCandidates = feats
      .filter((f) => !taken.has(f.plot.id) && f.nearCollector)
      .sort((a, b) => a.plot.id - b.plot.id)
    if (civicCandidates.length > 0 && civicCap > 0) {
      const every = Math.max(
        1,
        Math.floor(civicCandidates.length / Math.max(1, civicCap)),
      )
      let placed = 0
      for (let i = 0; i < civicCandidates.length && placed < civicCap; i += every) {
        const f = civicCandidates[i]!
        set(f.plot.id, 'civic', `collector+1/${every}→civic·quota`)
        placed += 1
      }
    }
  }

  // 7. Everything else → Housing (target band 55–60% as remainder)
  for (const f of feats) {
    if (taken.has(f.plot.id)) continue
    set(f.plot.id, 'housing', 'remainder→housing')
  }

  const counts = emptyLandUseCounts()
  const assignments: PlotLandUse[] = []
  for (const a of byId.values()) {
    assignments.push(a)
    counts[a.use] += 1
  }
  assignments.sort((a, b) => a.plotId - b.plotId)

  const pct = (c: number) => `${((100 * c) / total).toFixed(1)}%`
  const summary = [
    `[land] park ${counts.park} (${pct(counts.park)})`,
    `farm ${counts.farm} (${pct(counts.farm)})`,
    `industry ${counts.industry} (${pct(counts.industry)})`,
    `commerce ${counts.commerce} (${pct(counts.commerce)})`,
    `yard ${counts.yard} (${pct(counts.yard)})`,
    `civic ${counts.civic} (${pct(counts.civic)})`,
    `housing ${counts.housing} (${pct(counts.housing)})`,
    `· n=${assignments.length}`,
  ].join(' · ')

  return { assignments, byId, counts, summary }
}

export const LAND_USE_RULE_TEXT: Record<LandUse, string> = {
  park: 'Open plots (existing open rule) → Park',
  farm: 'Flat outer edge → Farm (capped ~5–8%)',
  industry: 'Main roads outside core → Industry (capped ~10–12%)',
  commerce: 'Main + junction near center → Commerce (capped ~8–10%)',
  yard: 'Main-road corridor outside core → Yard (capped ~1–2%)',
  civic: 'Near collectors, spaced → Civic (capped ~2–3%)',
  housing: 'Remainder → Housing (target ~55–60%)',
}
