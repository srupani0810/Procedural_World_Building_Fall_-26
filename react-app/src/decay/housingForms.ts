/**
 * DECAY housing massing — peak-city forms, rule-based (no Math.random).
 * - row: narrow units on the street edge, gaps, yard at back
 * - walkup: 4–5 story apartment on the sidewalk wall
 * - tenement: deeper block near Industry
 *
 * Mix target: row ~60% · walk-up ~20% · tenement ~20% (plot shells).
 * Geometry forms are owned by the parts-kit layers — this file only picks + masses.
 */

import type { BuildingInstance } from './buildings.ts'
import { getBuildingType } from './buildingTypeTable.ts'
import { storiesFromField } from './formHeight.ts'
import type { PlotLandUse } from './landUse.ts'

export type HousingKind = 'row' | 'walkup' | 'tenement'

export type HousingCounts = Record<HousingKind, number>

export const emptyHousingCounts = (): HousingCounts => ({
  row: 0,
  walkup: 0,
  tenement: 0,
})

/** Target share of housing plot shells. */
export const HOUSING_TARGETS = {
  row: 0.6,
  walkup: 0.2,
  tenement: 0.2,
} as const

export type HousingSite = {
  plotId: number
  x: number
  z: number
  area: number
  width: number
  heightField: number
  distMain: number
  nearMain: boolean
}

export type HousingContext = {
  halfExtent: number
  /** World xz of Industry plot centers (for tenement proximity). */
  industryPts: { x: number; z: number }[]
  /** Plot id → corner flag from morphology. */
  cornerById?: ReadonlyMap<number, boolean>
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v))
}

function rimOf(x: number, z: number, half: number) {
  return Math.min(1, Math.hypot(x, z) / Math.max(1, half))
}

function distToIndustry(x: number, z: number, pts: { x: number; z: number }[]) {
  let best = Infinity
  for (const p of pts) {
    const d = Math.hypot(x - p.x, z - p.z)
    if (d < best) best = d
  }
  return best
}

/**
 * Quota assign across housing shells: tenement ~20% nearest Industry,
 * walk-up ~20% denser lots near center + main roads, row ~60% remainder.
 */
export function assignHousingKinds(
  sites: HousingSite[],
  ctx: HousingContext,
): { byId: Map<number, HousingKind>; counts: HousingCounts; summary: string } {
  const n = sites.length
  const byId = new Map<number, HousingKind>()
  const counts = emptyHousingCounts()
  if (n === 0) {
    return {
      byId,
      counts,
      summary: '[housing] row 0 · walkup 0 · tenement 0 · n=0',
    }
  }

  const tenementCap = Math.max(0, Math.round(n * HOUSING_TARGETS.tenement))
  const walkupCap = Math.max(0, Math.round(n * HOUSING_TARGETS.walkup))

  const tenementRanked = [...sites].sort((a, b) => {
    const da = distToIndustry(a.x, a.z, ctx.industryPts)
    const db = distToIndustry(b.x, b.z, ctx.industryPts)
    if (da !== db) return da - db
    return a.plotId - b.plotId
  })
  const taken = new Set<number>()
  for (let i = 0; i < tenementCap && i < tenementRanked.length; i++) {
    const s = tenementRanked[i]!
    byId.set(s.plotId, 'tenement')
    counts.tenement += 1
    taken.add(s.plotId)
  }

  const remaining = sites.filter((s) => !taken.has(s.plotId))
  const walkupRanked = [...remaining].sort((a, b) => {
    const sa = walkupScore(a, ctx.halfExtent)
    const sb = walkupScore(b, ctx.halfExtent)
    if (sb !== sa) return sb - sa
    return a.plotId - b.plotId
  })
  for (let i = 0; i < walkupCap && i < walkupRanked.length; i++) {
    const s = walkupRanked[i]!
    byId.set(s.plotId, 'walkup')
    counts.walkup += 1
    taken.add(s.plotId)
  }

  for (const s of sites) {
    if (taken.has(s.plotId)) continue
    byId.set(s.plotId, 'row')
    counts.row += 1
  }

  const pct = (c: number) => `${((100 * c) / Math.max(1, n)).toFixed(1)}%`
  const summary = [
    `[housing] row ${counts.row} (${pct(counts.row)})`,
    `walkup ${counts.walkup} (${pct(counts.walkup)})`,
    `tenement ${counts.tenement} (${pct(counts.tenement)})`,
    `· target 60/20/20 · walk-ups = denser near center+main · n=${n}`,
  ].join(' · ')

  return { byId, counts, summary }
}

/** Higher = better walk-up candidate (dense, core, main-road). */
function walkupScore(s: HousingSite, halfExtent: number): number {
  const rim = rimOf(s.x, s.z, halfExtent)
  const core = 1 - rim
  const main = s.nearMain ? 2.2 : Math.max(0, 1.2 - s.distMain / 28)
  const dense =
    s.heightField * 1.4 + Math.min(1.5, s.width / 10) + Math.min(1.2, s.area / 90)
  return core * 3.2 + main + dense
}

/** Local offset → world (matches R3F Y-rotation used on instances). */
function localToWorld(
  cx: number,
  cz: number,
  yaw: number,
  lx: number,
  lz: number,
) {
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  return {
    x: cx + lx * c + lz * s,
    z: cz - lx * s + lz * c,
  }
}

function cloneShell(
  inst: BuildingInstance,
  patch: Partial<BuildingInstance>,
): BuildingInstance {
  return {
    ...inst,
    foundations: patch.foundations ?? [...inst.foundations],
    ...patch,
  }
}

/** Row houses: several narrow units on the street edge; back of lot stays open yard. */
function massRow(
  inst: BuildingInstance,
  rule: string,
  cornerPlot: boolean,
  halfExtent: number,
): BuildingInstance[] {
  const t = getBuildingType('row')
  const unitMin = t.size.unitMin ?? 2.15
  const unitMax = t.size.unitMax ?? 3.4
  const gap = t.size.unitGap ?? 0.38
  const yardFrac = t.size.yardFrac ?? 0.38
  const shiftFrac = t.size.frontShiftFrac ?? 0.5
  const frontW = Math.max(unitMin * 2, inst.width)
  const unitW = clamp(frontW / 4.2, unitMin, unitMax)
  const n = Math.max(2, Math.min(6, Math.floor((frontW + gap) / (unitW + gap))))
  const span = n * unitW + (n - 1) * gap
  const depth = Math.max(t.size.minDepth, inst.depth * (1 - yardFrac))
  const frontShift = (inst.depth - depth) * shiftFrac
  void halfExtent
  const stories = storiesFromField(
    { min: t.size.storyMin, max: t.size.storyMax },
    inst.heightField,
  )
  const out: BuildingInstance[] = []
  for (let i = 0; i < n; i++) {
    const lx = -span * 0.5 + unitW * 0.5 + i * (unitW + gap)
    const p = localToWorld(inst.x, inst.z, inst.yaw, lx, -frontShift)
    const end = i === 0 || i === n - 1
    out.push(
      cloneShell(inst, {
        x: p.x,
        z: p.z,
        width: unitW,
        depth,
        stories,
        landUse: 'housing',
        landUseRule: `${rule}·row`,
        housingKind: 'row',
        unitIndex: i,
        unitCount: n,
        housingCorner: cornerPlot || end,
        part: i === 0 ? 'shell' : 'unit',
        foundations: i === 0 ? [...inst.foundations] : [],
      }),
    )
  }
  return out
}

/** Walk-up apartment: sidewalk wall; stories from Height field in 4–6. */
function massWalkup(
  inst: BuildingInstance,
  rule: string,
  halfExtent: number,
  cornerPlot: boolean,
): BuildingInstance[] {
  void halfExtent
  const t = getBuildingType('walkup')
  const stories = storiesFromField(
    { min: t.size.storyMin, max: t.size.storyMax },
    inst.heightField,
  )
  const width = Math.max(t.size.minWidth, inst.width * t.size.widthMult)
  const depth = Math.max(t.size.minDepth, inst.depth * t.size.depthMult)
  const frontShift = (inst.depth - depth) * (t.size.frontShiftFrac ?? 0.5)
  const p = localToWorld(inst.x, inst.z, inst.yaw, 0, -frontShift)
  return [
    cloneShell(inst, {
      x: p.x,
      z: p.z,
      width,
      depth,
      stories,
      landUse: 'housing',
      landUseRule: `${rule}·walkup`,
      housingKind: 'walkup',
      housingCorner: cornerPlot,
      part: 'shell',
    }),
  ]
}

/** Tenement near factories; stories from Height field in 4–6. */
function massTenement(
  inst: BuildingInstance,
  rule: string,
  halfExtent: number,
): BuildingInstance[] {
  void halfExtent
  const t = getBuildingType('tenement')
  const stories = storiesFromField(
    { min: t.size.storyMin, max: t.size.storyMax },
    inst.heightField,
  )
  const width = Math.max(t.size.minWidth, inst.width * t.size.widthMult)
  const depth = Math.max(t.size.minDepth, inst.depth * t.size.depthMult)
  const frontShift = (inst.depth - depth) * (t.size.frontShiftFrac ?? 0.25)
  const p = localToWorld(inst.x, inst.z, inst.yaw, 0, -frontShift)
  return [
    cloneShell(inst, {
      x: p.x,
      z: p.z,
      width,
      depth,
      stories,
      landUse: 'housing',
      landUseRule: `${rule}·tenement`,
      housingKind: 'tenement',
      part: 'shell',
    }),
  ]
}

export function massHousing(
  inst: BuildingInstance,
  lu: PlotLandUse,
  ctx: HousingContext,
  kind: HousingKind,
): BuildingInstance[] {
  const corner = ctx.cornerById?.get(inst.plotId) ?? false
  if (kind === 'tenement') return massTenement(inst, lu.rule, ctx.halfExtent)
  if (kind === 'walkup') return massWalkup(inst, lu.rule, ctx.halfExtent, corner)
  return massRow(inst, lu.rule, corner, ctx.halfExtent)
}
