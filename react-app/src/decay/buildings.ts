/**
 * SimCity-style building layer: plain boxes from Height/Size fields + slope rules.
 * Deterministic — no Math.random. No decay / stages / windows.
 */

import type { HeightFn, Vec2 } from './directionField.ts'
import { sampleField, type FieldMaps } from './fields.ts'
import {
  assignHousingKinds,
  massHousing,
  type HousingContext,
  type HousingCounts,
  type HousingSite,
  emptyHousingCounts,
} from './housingForms.ts'
import {
  assignCommerceKinds,
  massCommerce,
  type CommerceCounts,
  type CommerceKind,
  emptyCommerceCounts,
} from './commerceForms.ts'
import { FORM_HEIGHT_RANGES, storiesFromField } from './formHeight.ts'
import {
  assignIndustryKinds,
  massIndustry,
  type IndustryCounts,
  type IndustryKind,
  type IndustrySite,
  emptyIndustryCounts,
} from './industryForms.ts'
import {
  isGroundOnly,
  plotMainProximity,
  type LandUse,
  type PlotLandUse,
  type PlotMainProximity,
} from './landUse.ts'
import type { MorphPlot } from './morphology.ts'
import type { BuildingParams, FloorMode } from './params.ts'
import type { RoadGraph } from './roadGraph.ts'

export type BuildingInstance = {
  plotId: number
  /** Footprint center xz. */
  x: number
  z: number
  /** Yaw so +Z faces the road edge. */
  yaw: number
  /** Footprint width along road (local X). */
  width: number
  /** Footprint depth into lot (local Z). */
  depth: number
  /** Top of foundation / building floor. */
  floorY: number
  /** Stories counted from floorY. */
  stories: number
  storyHeight: number
  /** Plot ring area (for onset / small-plot rule). */
  area: number
  /** maxCornerH - minCornerH under footprint. */
  slopeRise: number
  /** Geometric rise/run. */
  slope: number
  heightField: number
  /** District layer sample (pre-mix / pre-blend). */
  districtField?: number
  /** Plot layer sample (pre-mix / pre-blend). */
  plotField?: number
  sizeField: number
  slopeField: number
  shrink: number
  /** Foundation slabs under the box (terrace may add several). */
  foundations: { y: number; height: number }[]
  landUse?: LandUse
  landUseRule?: string
  /** Main mass vs yard/civic accent vs row-house secondary unit. */
  part?: 'shell' | 'accent' | 'unit'
  /** Housing subtype when landUse is housing. */
  housingKind?: 'row' | 'walkup' | 'tenement'
  /** Industry / yard subtype. */
  industryKind?: IndustryKind
  /** Commerce low-rise subtype. */
  commerceKind?: CommerceKind
  /** Row unit index / count for variant + detail mesh. */
  unitIndex?: number
  unitCount?: number
  /** Corner end-unit or corner plot — side door / windows. */
  housingCorner?: boolean
}

export type BuildingFormCensus = {
  housing: HousingCounts
  industry: IndustryCounts
  commerce: CommerceCounts
  housingSummary: string
  industrySummary: string
  commerceSummary: string
}

export type BuildingHoverInfo = {
  plotId: number
  heightField: number
  districtField?: number
  plotField?: number
  sizeField: number
  slope: number
  floorY: number
  foundationHeight: number
  shrink: number
  stories: number
  x: number
  z: number
  stage?: string
  age?: number
  landUse?: LandUse
  landUseRule?: string
}

const MIN_FOOT = 1.4
const MAX_TERRACE = 10

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v))
}

function ringCentroid(ring: Vec2[]): Vec2 {
  let x = 0
  let z = 0
  for (const p of ring) {
    x += p.x
    z += p.z
  }
  const n = Math.max(1, ring.length)
  return { x: x / n, z: z / n }
}

/** Scale ring toward centroid by fill (0–1). */
function scaleRing(ring: Vec2[], fill: number): Vec2[] {
  const c = ringCentroid(ring)
  const f = clamp(fill, 0.05, 1)
  return ring.map((p) => ({
    x: c.x + (p.x - c.x) * f,
    z: c.z + (p.z - c.z) * f,
  }))
}

function floorFromCorners(hs: number[], mode: FloorMode): number {
  if (hs.length === 0) return 0
  if (mode === 'lowest') {
    let m = hs[0]!
    for (const h of hs) if (h < m) m = h
    return m
  }
  if (mode === 'highest') {
    let m = hs[0]!
    for (const h of hs) if (h > m) m = h
    return m
  }
  let s = 0
  for (const h of hs) s += h
  return s / hs.length
}

/**
 * Oriented footprint from building line.
 * Ring convention: [p0,p1,p2,p3] with p0→p1 along the road (front).
 */
function orientedFootprint(bl: Vec2[], fill: number) {
  const ring = scaleRing(bl, fill)
  if (ring.length < 4) {
    const c = ringCentroid(bl)
    return {
      cx: c.x,
      cz: c.z,
      yaw: 0,
      width: MIN_FOOT,
      depth: MIN_FOOT,
      corners: [
        { x: c.x - 0.7, z: c.z - 0.7 },
        { x: c.x + 0.7, z: c.z - 0.7 },
        { x: c.x + 0.7, z: c.z + 0.7 },
        { x: c.x - 0.7, z: c.z + 0.7 },
      ] as Vec2[],
    }
  }
  const p0 = ring[0]!
  const p1 = ring[1]!
  const p2 = ring[2]!
  const p3 = ring[3]!
  const fx = p1.x - p0.x
  const fz = p1.z - p0.z
  const frontLen = Math.hypot(fx, fz) || 1
  const ux = fx / frontLen
  const uz = fz / frontLen
  // Inward = average of side edges, preferred over cross product flip.
  const midF = { x: (p0.x + p1.x) * 0.5, z: (p0.z + p1.z) * 0.5 }
  const midB = { x: (p2.x + p3.x) * 0.5, z: (p2.z + p3.z) * 0.5 }
  const dx = midB.x - midF.x
  const dz = midB.z - midF.z
  const depthLen = Math.hypot(dx, dz) || 1
  const cx = (p0.x + p1.x + p2.x + p3.x) * 0.25
  const cz = (p0.z + p1.z + p2.z + p3.z) * 0.25
  // Local +Z points into the lot (away from the road front).
  const yawIn = Math.atan2(dx, dz)
  void ux
  void uz
  return {
    cx,
    cz,
    yaw: yawIn,
    width: Math.max(MIN_FOOT, frontLen),
    depth: Math.max(MIN_FOOT, depthLen),
    corners: [p0, p1, p2, p3],
  }
}

function foundationSlabs(
  floorY: number,
  minTerrain: number,
  terrace: boolean,
  step: number,
): { y: number; height: number }[] {
  const rise = Math.max(0.05, floorY - minTerrain)
  if (!terrace) {
    return [{ y: minTerrain + rise * 0.5, height: rise }]
  }
  const s = Math.max(0.25, step)
  const n = Math.max(1, Math.min(MAX_TERRACE, Math.ceil(rise / s)))
  const slabs: { y: number; height: number }[] = []
  let y0 = minTerrain
  for (let i = 0; i < n; i++) {
    const remaining = floorY - y0
    const h = i === n - 1 ? remaining : Math.min(s, remaining)
    if (h <= 1e-4) break
    slabs.push({ y: y0 + h * 0.5, height: h })
    y0 += h
  }
  if (slabs.length === 0) slabs.push({ y: minTerrain + rise * 0.5, height: rise })
  return slabs
}

/** One shell from a plot’s building line. Optional storyOverride for player claims. */
export function instanceFromPlot(
  plot: MorphPlot,
  fields: FieldMaps,
  heightAt: HeightFn,
  params: BuildingParams,
  storyOverride?: number,
): BuildingInstance | null {
  const bl = plot.buildingLine
  if (!bl || bl.length < 3) return null

  const storyH = Math.max(1.5, params.storyHeight)
  const minS = Math.max(1, Math.round(params.minStories))
  const maxS = Math.max(minS, Math.round(params.maxStories))

  const c = ringCentroid(bl)
  const hField = sampleField(fields.height, fields.res, c.x, c.z)
  const dField = sampleField(fields.heightDistrict, fields.res, c.x, c.z)
  const pField = sampleField(fields.heightPlot, fields.res, c.x, c.z)
  const sField = sampleField(fields.size, fields.res, c.x, c.z)
  const slField = sampleField(fields.slope, fields.res, c.x, c.z)

  // First pass footprint at size fill (before shrink) to measure slope.
  const fill0 =
    params.minSizeFill + (params.maxSizeFill - params.minSizeFill) * sField
  const foot0 = orientedFootprint(bl, fill0)
  const samplePts: Vec2[] = [
    ...foot0.corners,
    { x: foot0.cx, z: foot0.cz },
  ]
  const hs = samplePts.map((p) => heightAt(p.x, p.z))
  let minH = hs[0]!
  let maxH = hs[0]!
  for (const h of hs) {
    if (h < minH) minH = h
    if (h > maxH) maxH = h
  }
  const diag = Math.hypot(foot0.width, foot0.depth) || 1
  const slopeRise = maxH - minH
  const geoSlope = slopeRise / diag
  // Slope field modulates steepness for shrink (0 = ignore geometry less, 1 = full).
  const steepness = geoSlope * (0.35 + 0.65 * slField) + geoSlope * 0.25
  const shrink = 1 / (1 + Math.max(0, params.steepShrink) * steepness * 10)

  const fill = clamp(fill0 * shrink, params.minSizeFill * 0.5, params.maxSizeFill)
  const foot = orientedFootprint(bl, fill)
  const corners = foot.corners
  const cornerHs = corners.map((p) => heightAt(p.x, p.z))
  const centerH = heightAt(foot.cx, foot.cz)
  let minC = cornerHs[0]!
  let maxC = cornerHs[0]!
  for (const h of cornerHs) {
    if (h < minC) minC = h
    if (h > maxC) maxC = h
  }
  // Floor from sampled corners + center. Foundation fills down to the lowest corner
  // so the box never floats; stories count from this pad, not from raw ground.
  const floorY = Math.max(minC, floorFromCorners([...cornerHs, centerH], params.floorMode))
  const foundations = foundationSlabs(
    floorY,
    minC,
    params.terrace,
    params.terraceStep,
  )

  const storiesRaw = minS + (maxS - minS) * hField
  const stories =
    storyOverride != null
      ? Math.max(1, Math.round(storyOverride))
      : Math.max(1, Math.round(storiesRaw * shrink))

  return {
    plotId: plot.id,
    x: foot.cx,
    z: foot.cz,
    yaw: foot.yaw,
    width: foot.width,
    depth: foot.depth,
    floorY,
    stories,
    storyHeight: storyH,
    area: plot.area,
    slopeRise: maxC - minC,
    slope: (maxC - minC) / (Math.hypot(foot.width, foot.depth) || 1),
    heightField: hField,
    districtField: dField,
    plotField: pField,
    sizeField: sField,
    slopeField: slField,
    shrink,
    foundations,
  }
}

/**
 * Per-type massing — replaces one generic box with readable land-use forms.
 * Parks/Farms never reach here (ground-only).
 */
export function applyLandUseMassing(
  inst: BuildingInstance,
  lu: PlotLandUse | undefined,
  ctx: HousingContext,
  housingKind?: HousingKindFromMap,
  industryKind?: IndustryKind,
): BuildingInstance[] {
  if (!lu || isGroundOnly(lu.use)) return []
  const out: BuildingInstance[] = []
  const base: BuildingInstance = {
    ...inst,
    landUse: lu.use,
    landUseRule: lu.rule,
    part: 'shell',
    foundations: [...inst.foundations],
  }

  if (lu.use === 'housing') {
    return massHousing(inst, lu, ctx, housingKind ?? 'row')
  }

  if (lu.use === 'industry' || lu.use === 'yard') {
    const kind =
      industryKind ?? (lu.use === 'yard' ? 'rail' : 'factory')
    return massIndustry(inst, lu.rule, kind, ctx.halfExtent)
  }

  if (lu.use === 'commerce') {
    const corner = ctx.cornerById?.get(inst.plotId) ?? false
    return massCommerce(inst, lu.rule, ctx.halfExtent, corner)
  }

  if (lu.use === 'civic') {
    // No tall tower — mid block from Height field (2–4).
    base.width = Math.max(4, inst.width * 0.88)
    base.depth = Math.max(3.5, inst.depth * 0.85)
    base.stories = storiesFromField(FORM_HEIGHT_RANGES.civic, inst.heightField)
    out.push(base)
    return out
  }

  out.push(base)
  return out
}

type HousingKindFromMap = 'row' | 'walkup' | 'tenement'

export const emptyBuildingFormCensus = (): BuildingFormCensus => ({
  housing: emptyHousingCounts(),
  industry: emptyIndustryCounts(),
  commerce: emptyCommerceCounts(),
  housingSummary: '[housing] —',
  industrySummary: '[industry] —',
  commerceSummary: '[commerce] —',
})

/** Seed shells — non-open plots with land-use forms. Parks/Farms skipped. */
export function buildBuildings(
  plots: MorphPlot[],
  fields: FieldMaps,
  heightAt: HeightFn,
  params: BuildingParams,
  landUseById?: ReadonlyMap<number, PlotLandUse>,
  halfExtent = 260,
  graph?: RoadGraph,
): { instances: BuildingInstance[]; formCensus: BuildingFormCensus } {
  type Raw = { inst: BuildingInstance; lu: PlotLandUse | undefined; plot: MorphPlot }
  const raw: Raw[] = []
  const industryPts: { x: number; z: number }[] = []
  const housingPts: { x: number; z: number }[] = []
  const cornerById = new Map<number, boolean>()
  const proximity: Map<number, PlotMainProximity> = graph
    ? plotMainProximity(plots, graph)
    : new Map()

  for (const plot of plots) {
    cornerById.set(plot.id, plot.corner)
    if (plot.open) continue
    const lu = landUseById?.get(plot.id)
    if (lu && isGroundOnly(lu.use)) continue
    const inst = instanceFromPlot(plot, fields, heightAt, params)
    if (!inst) continue
    if (lu?.use === 'industry') industryPts.push({ x: inst.x, z: inst.z })
    if (lu?.use === 'housing') housingPts.push({ x: inst.x, z: inst.z })
    raw.push({ inst, lu, plot })
  }

  const ctx: HousingContext = { halfExtent, industryPts, cornerById }

  const housingSites: HousingSite[] = []
  const industrySites: IndustrySite[] = []
  for (const r of raw) {
    if (!r.lu) continue
    const prox = proximity.get(r.plot.id)
    const distMain = prox?.distMain ?? 999
    const nearMain = prox?.nearMain ?? false
    if (r.lu.use === 'housing') {
      housingSites.push({
        plotId: r.plot.id,
        x: r.inst.x,
        z: r.inst.z,
        area: r.inst.area,
        width: r.inst.width,
        heightField: r.inst.heightField,
        distMain,
        nearMain,
      })
    }
    if (r.lu.use === 'industry' || r.lu.use === 'yard') {
      industrySites.push({
        plotId: r.plot.id,
        x: r.inst.x,
        z: r.inst.z,
        area: r.plot.area,
        steep: r.plot.steep,
        distMain,
        nearMain,
        isYard: r.lu.use === 'yard',
      })
    }
  }

  const housingAssign = assignHousingKinds(housingSites, ctx)
  const industryAssign = assignIndustryKinds(industrySites, { housingPts })
  const commerceSites = raw
    .filter((r) => r.lu?.use === 'commerce')
    .map((r) => ({
      plotId: r.plot.id,
      corner: cornerById.get(r.plot.id) ?? false,
    }))
  const commerceAssign = assignCommerceKinds(commerceSites)

  const out: BuildingInstance[] = []
  for (const r of raw) {
    if (landUseById && r.lu) {
      out.push(
        ...applyLandUseMassing(
          r.inst,
          r.lu,
          ctx,
          housingAssign.byId.get(r.plot.id),
          industryAssign.byId.get(r.plot.id),
        ),
      )
    } else {
      out.push(r.inst)
    }
  }

  return {
    instances: out,
    formCensus: {
      housing: housingAssign.counts,
      industry: industryAssign.counts,
      commerce: commerceAssign.counts,
      housingSummary: housingAssign.summary,
      industrySummary: industryAssign.summary,
      commerceSummary: commerceAssign.summary,
    },
  }
}

/** Player-claimed open plots only (Phase 2 add-only). */
export function buildClaimedBuildings(
  plots: MorphPlot[],
  fields: FieldMaps,
  heightAt: HeightFn,
  params: BuildingParams,
  claims: ReadonlyMap<number, { stories: number }>,
): BuildingInstance[] {
  if (claims.size === 0) return []
  const byId = new Map<number, MorphPlot>()
  for (const p of plots) byId.set(p.id, p)
  const out: BuildingInstance[] = []
  for (const [plotId, claim] of claims) {
    const plot = byId.get(plotId)
    if (!plot || !plot.open) continue
    const inst = instanceFromPlot(plot, fields, heightAt, params, claim.stories)
    if (inst) out.push(inst)
  }
  return out
}

/** Uniform grid for O(1) hover lookup by world xz. */
export function buildHoverIndex(
  buildings: BuildingInstance[],
  cellSize = 12,
): {
  cellSize: number
  map: Map<string, number[]>
  buildings: BuildingInstance[]
} {
  const map = new Map<string, number[]>()
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i]!
    const cx = Math.floor(b.x / cellSize)
    const cz = Math.floor(b.z / cellSize)
    const key = `${cx},${cz}`
    const list = map.get(key)
    if (list) list.push(i)
    else map.set(key, [i])
  }
  return { cellSize, map, buildings }
}

export function lookupHover(
  index: ReturnType<typeof buildHoverIndex>,
  x: number,
  z: number,
): BuildingHoverInfo | null {
  const { cellSize, map, buildings } = index
  const cx = Math.floor(x / cellSize)
  const cz = Math.floor(z / cellSize)
  let best: { i: number; d: number } | null = null
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const list = map.get(`${cx + dx},${cz + dz}`)
      if (!list) continue
      for (const i of list) {
        const b = buildings[i]!
        // Point-in-oriented AABB (local frame).
        const cos = Math.cos(-b.yaw)
        const sin = Math.sin(-b.yaw)
        const lx = (x - b.x) * cos - (z - b.z) * sin
        const lz = (x - b.x) * sin + (z - b.z) * cos
        const hw = b.width * 0.5
        const hd = b.depth * 0.5
        if (Math.abs(lx) <= hw && Math.abs(lz) <= hd) {
          const d = Math.hypot(x - b.x, z - b.z)
          if (!best || d < best.d) best = { i, d }
        }
      }
    }
  }
  if (!best) return null
  const b = buildings[best.i]!
  let foundationHeight = 0
  for (const f of b.foundations) foundationHeight += f.height
  return {
    plotId: b.plotId,
    heightField: b.heightField,
    districtField: b.districtField,
    plotField: b.plotField,
    sizeField: b.sizeField,
    slope: b.slope,
    floorY: b.floorY,
    foundationHeight,
    shrink: b.shrink,
    stories: b.stories,
    x: b.x,
    z: b.z,
    landUse: b.landUse,
    landUseRule: b.landUseRule,
  }
}
