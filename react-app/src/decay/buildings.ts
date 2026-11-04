/**
 * SimCity-style building layer: plain boxes from Height/Size fields + slope rules.
 * Deterministic — no Math.random. No decay / stages / windows.
 */

import type { HeightFn, Vec2 } from './directionField.ts'
import { sampleField, type FieldMaps } from './fields.ts'
import {
  isGroundOnly,
  type LandUse,
  type PlotLandUse,
} from './landUse.ts'
import type { MorphPlot } from './morphology.ts'
import type { BuildingParams, FloorMode } from './params.ts'

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
  sizeField: number
  slopeField: number
  shrink: number
  /** Foundation slabs under the box (terrace may add several). */
  foundations: { y: number; height: number }[]
  landUse?: LandUse
  landUseRule?: string
  /** Main mass vs yard tower / civic fin. */
  part?: 'shell' | 'accent'
}

export type BuildingHoverInfo = {
  plotId: number
  heightField: number
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
  halfExtent: number,
): BuildingInstance[] {
  if (!lu || isGroundOnly(lu.use)) return []
  const out: BuildingInstance[] = []
  const rim = Math.min(1, Math.hypot(inst.x, inst.z) / Math.max(1, halfExtent))
  const base: BuildingInstance = {
    ...inst,
    landUse: lu.use,
    landUseRule: lu.rule,
    part: 'shell',
    foundations: [...inst.foundations],
  }

  if (lu.use === 'industry') {
    // Wide and low mill / plant shell.
    base.width = Math.max(inst.width * 1.45, inst.width + 1.2)
    base.depth = Math.max(inst.depth * 1.25, inst.depth + 0.8)
    base.stories = Math.max(1, Math.min(2, Math.round(inst.stories * 0.45)))
    out.push(base)
    return out
  }

  if (lu.use === 'commerce') {
    // Taller toward the center.
    const boost = 1.15 + (1 - rim) * 1.35
    base.width = inst.width * 0.95
    base.depth = inst.depth * 0.9
    base.stories = Math.max(2, Math.round(inst.stories * boost))
    out.push(base)
    return out
  }

  if (lu.use === 'housing') {
    // Small domestic footprint.
    base.width = Math.max(1.6, inst.width * 0.62)
    base.depth = Math.max(1.6, inst.depth * 0.62)
    base.stories = Math.max(1, Math.min(3, Math.round(inst.stories * 0.7)))
    out.push(base)
    return out
  }

  if (lu.use === 'civic') {
    // Distinct upright bar + shallow plinth (accent).
    base.width = Math.max(1.8, Math.min(inst.width, inst.depth) * 0.55)
    base.depth = base.width
    base.stories = Math.max(3, Math.round(inst.stories * 1.15) + 1)
    out.push(base)
    const plinth: BuildingInstance = {
      ...base,
      part: 'accent',
      width: Math.max(base.width * 1.8, inst.width * 0.85),
      depth: Math.max(base.depth * 1.8, inst.depth * 0.85),
      stories: 0.35,
      foundations: [],
    }
    out.push(plinth)
    return out
  }

  if (lu.use === 'yard') {
    // Flat pad + one tall element.
    base.width = Math.max(inst.width * 1.15, inst.width + 0.5)
    base.depth = Math.max(inst.depth * 1.15, inst.depth + 0.5)
    base.stories = 0.45
    out.push(base)
    const tower: BuildingInstance = {
      ...base,
      part: 'accent',
      x: base.x + Math.cos(base.yaw) * base.width * 0.28,
      z: base.z + Math.sin(base.yaw) * base.width * 0.28,
      width: Math.max(1.2, base.width * 0.22),
      depth: Math.max(1.2, base.depth * 0.22),
      stories: Math.max(4, Math.round(inst.stories) + 2),
      foundations: [],
    }
    out.push(tower)
    return out
  }

  out.push(base)
  return out
}

/** Seed shells — non-open plots with land-use forms. Parks/Farms skipped. */
export function buildBuildings(
  plots: MorphPlot[],
  fields: FieldMaps,
  heightAt: HeightFn,
  params: BuildingParams,
  landUseById?: ReadonlyMap<number, PlotLandUse>,
  halfExtent = 260,
): BuildingInstance[] {
  const out: BuildingInstance[] = []
  for (const plot of plots) {
    if (plot.open) continue
    const lu = landUseById?.get(plot.id)
    if (lu && isGroundOnly(lu.use)) continue
    const inst = instanceFromPlot(plot, fields, heightAt, params)
    if (!inst) continue
    if (landUseById && lu) {
      out.push(...applyLandUseMassing(inst, lu, halfExtent))
    } else {
      out.push(inst)
    }
  }
  return out
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
