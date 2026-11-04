/**
 * DECAY industry / yard forms — rule-picked, parts-kit meshes, Before colors.
 * Does not change housing forms. No Math.random.
 *
 * Pick: Heavy on largest flat farthest from housing (few);
 * Warehouse on main-road plots; Factory for the rest.
 * Rail yard on Yard land-use along the reserved main spine.
 */

import { BufferGeometry } from 'three'
import type { BuildingInstance } from './buildings.ts'
import {
  getBuildingType,
  industryKindToFormId,
} from './buildingTypeTable.ts'
import { storiesFromField } from './formHeight.ts'
import { INDUSTRY_BEFORE } from './industryPalette.ts'
import {
  indEndWindows,
  indLoadingDocks,
  indLoadingYard,
  indPipes,
  indRailPad,
  indSawtoothRoof,
  indShedRoof,
  indStack,
  indTank,
  indTracks,
  indWallMass,
  indWaterTower,
  mergeIndParts,
  pickIndex,
} from './industryParts.ts'

export type IndustryKind = 'factory' | 'warehouse' | 'heavy' | 'rail'

export type IndustrySite = {
  plotId: number
  x: number
  z: number
  area: number
  steep: number
  distMain: number
  nearMain: boolean
  /** Land-use yard corridor → rail. */
  isYard: boolean
}

export type IndustryCounts = Record<IndustryKind, number>

export const emptyIndustryCounts = (): IndustryCounts => ({
  factory: 0,
  warehouse: 0,
  heavy: 0,
  rail: 0,
})

export type IndustryContext = {
  housingPts: { x: number; z: number }[]
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v))
}

function distToPts(x: number, z: number, pts: { x: number; z: number }[]) {
  let best = Infinity
  for (const p of pts) {
    const d = Math.hypot(x - p.x, z - p.z)
    if (d < best) best = d
  }
  return best
}

/**
 * Global industry/yard subtype assignment with quotas.
 * Rail = yard plots. Heavy = few largest flat farthest from housing.
 * Warehouse = remaining main-road plots. Factory = everything else.
 */
export function assignIndustryKinds(
  sites: IndustrySite[],
  ctx: IndustryContext,
): { byId: Map<number, IndustryKind>; counts: IndustryCounts; summary: string } {
  const byId = new Map<number, IndustryKind>()
  const counts = emptyIndustryCounts()

  const yard = sites.filter((s) => s.isYard)
  const industry = sites.filter((s) => !s.isYard)

  for (const s of yard) {
    byId.set(s.plotId, 'rail')
    counts.rail += 1
  }

  // Few heavy plants — ~12% of industry, capped 2–5.
  const heavyCap = clamp(Math.round(industry.length * 0.12), industry.length > 0 ? 1 : 0, 5)
  const heavyRanked = [...industry].sort((a, b) => {
    const da = distToPts(a.x, a.z, ctx.housingPts)
    const db = distToPts(b.x, b.z, ctx.housingPts)
    // Prefer far from housing, large, flatter (low steep).
    if (Math.abs(db - da) > 0.5) return db - da
    if (b.area !== a.area) return b.area - a.area
    if (a.steep !== b.steep) return a.steep - b.steep
    return a.plotId - b.plotId
  })
  const heavyIds = new Set<number>()
  for (let i = 0; i < heavyCap && i < heavyRanked.length; i++) {
    const s = heavyRanked[i]!
    byId.set(s.plotId, 'heavy')
    counts.heavy += 1
    heavyIds.add(s.plotId)
  }

  const rest = industry.filter((s) => !heavyIds.has(s.plotId))
  // Warehouse first on main-road touch (closest mains ranked); factory = remainder.
  // Cap warehouse so main-heavy industry still leaves factories.
  const warehouseCap = Math.max(
    0,
    Math.round(rest.length * 0.45),
  )
  const warehouseRanked = [...rest].sort((a, b) => {
    // Main-touch first, then closest to main.
    if (a.nearMain !== b.nearMain) return a.nearMain ? -1 : 1
    if (a.distMain !== b.distMain) return a.distMain - b.distMain
    return a.plotId - b.plotId
  })
  const warehouseIds = new Set<number>()
  for (let i = 0; i < warehouseCap && i < warehouseRanked.length; i++) {
    const s = warehouseRanked[i]!
    // Prefer main-road; stop once ranked list leaves main-touch and we have some.
    if (!s.nearMain && warehouseIds.size > 0) break
    byId.set(s.plotId, 'warehouse')
    counts.warehouse += 1
    warehouseIds.add(s.plotId)
  }
  for (const s of rest) {
    if (warehouseIds.has(s.plotId)) continue
    byId.set(s.plotId, 'factory')
    counts.factory += 1
  }

  const summary = [
    `[industry] heavy ${counts.heavy} (largest flat farthest from housing)`,
    `warehouse ${counts.warehouse} (main-road plots)`,
    `factory ${counts.factory} (remainder)`,
    `rail ${counts.rail} (yard spine)`,
    `· n=${sites.length}`,
  ].join(' · ')

  return { byId, counts, summary }
}

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

function industryStories(kind: IndustryKind, heightField: number): number {
  const t = getBuildingType(industryKindToFormId(kind))
  return storiesFromField(
    { min: t.size.storyMin, max: t.size.storyMax },
    heightField,
  )
}

/** Massing footprints for industry / rail — Height field → form range. */
export function massIndustry(
  inst: BuildingInstance,
  rule: string,
  kind: IndustryKind,
  halfExtent: number,
): BuildingInstance[] {
  void halfExtent
  const stories = industryStories(kind, inst.heightField)
  const t = getBuildingType(industryKindToFormId(kind))

  if (kind === 'rail') {
    const width = Math.max(inst.width * t.size.widthMult, inst.width + 0.6)
    const depth = Math.max(inst.depth * t.size.depthMult, inst.depth + 0.4)
    return [
      cloneShell(inst, {
        width,
        depth,
        stories,
        landUse: 'yard',
        landUseRule: `${rule}·rail`,
        industryKind: 'rail',
        part: 'shell',
      }),
    ]
  }

  if (kind === 'warehouse') {
    const width = Math.max(t.size.minWidth, inst.width * t.size.widthMult)
    const depth = Math.max(t.size.minDepth, inst.depth * t.size.depthMult)
    const frontShift = (inst.depth - depth) * (t.size.frontShiftFrac ?? 0.45)
    const p = localToWorld(inst.x, inst.z, inst.yaw, 0, -frontShift)
    return [
      cloneShell(inst, {
        x: p.x,
        z: p.z,
        width,
        depth,
        stories,
        landUse: 'industry',
        landUseRule: `${rule}·warehouse`,
        industryKind: 'warehouse',
        part: 'shell',
      }),
    ]
  }

  if (kind === 'heavy') {
    const width = Math.max(t.size.minWidth, inst.width * t.size.widthMult)
    const depth = Math.max(t.size.minDepth, inst.depth * t.size.depthMult)
    return [
      cloneShell(inst, {
        width,
        depth,
        stories,
        landUse: 'industry',
        landUseRule: `${rule}·heavy`,
        industryKind: 'heavy',
        part: 'shell',
      }),
    ]
  }

  // factory
  const width = Math.max(t.size.minWidth, inst.width * t.size.widthMult)
  const depth = Math.max(t.size.minDepth, inst.depth * t.size.depthMult)
  const frontShift = (inst.depth - depth) * (t.size.frontShiftFrac ?? 0.35)
  const p = localToWorld(inst.x, inst.z, inst.yaw, 0, -frontShift)
  return [
    cloneShell(inst, {
      x: p.x,
      z: p.z,
      width,
      depth,
      stories,
      landUse: 'industry',
      landUseRule: `${rule}·factory`,
      industryKind: 'factory',
      part: 'shell',
    }),
  ]
}

export type IndustryVariant = {
  kind: IndustryKind
  bodyToneIndex: number
  stacks: 2 | 3
  stories: number
}

export function industryVariantFromSeed(
  plotId: number,
  kind: IndustryKind,
  stories: number,
): IndustryVariant {
  const seed = plotId * 23
  const t = getBuildingType(industryKindToFormId(kind))
  const tones = t.colors.wallTones.length > 0 ? t.colors.wallTones : INDUSTRY_BEFORE.bodies
  const stackMax = Math.max(2, Math.min(3, t.entrance.chimneyCount || 2))
  return {
    kind,
    bodyToneIndex: pickIndex(seed + 3, tones.length),
    stacks: (pickIndex(seed + 7, 2) === 0 ? 2 : Math.min(3, stackMax)) as 2 | 3,
    stories: Math.max(1, stories),
  }
}

export function industryArchetypeKey(v: IndustryVariant): string {
  return `ind|${v.kind}|b${v.bodyToneIndex}|st${v.stacks}|h${v.stories}`
}

export function buildIndustryGeometry(v: IndustryVariant): BufferGeometry {
  const parts: BufferGeometry[] = []
  const t = getBuildingType(industryKindToFormId(v.kind))
  const body = t.colors.wallTones[v.bodyToneIndex] ?? t.colors.wall
  const stories = v.stories

  if (v.kind === 'rail') {
    parts.push(indRailPad())
    parts.push(...indTracks(4))
    if (t.entrance.waterTank) parts.push(...indWaterTower())
    return mergeIndParts(parts)
  }

  if (v.kind === 'warehouse') {
    parts.push(indWallMass(stories, body))
    if (t.roof.kind === 'shed') parts.push(indShedRoof(stories))
    parts.push(...indLoadingDocks(4))
    if (t.windows.implemented) parts.push(...indEndWindows(stories))
    return mergeIndParts(parts)
  }

  if (v.kind === 'heavy') {
    parts.push(indWallMass(stories, body))
    if (t.roof.kind === 'shed') parts.push(indShedRoof(stories))
    const stackXs = v.stacks === 3 ? [-0.35, 0, 0.35] : [-0.28, 0.28]
    for (const x of stackXs) parts.push(indStack(stories, x, 0.3, 3.2))
    parts.push(...indPipes(stories))
    if (t.entrance.waterTank) parts.push(indTank(stories))
    return mergeIndParts(parts)
  }

  // factory
  parts.push(indWallMass(stories, body))
  if (t.roof.kind === 'sawtooth') parts.push(...indSawtoothRoof(stories, 4))
  if (t.entrance.chimneyCount > 0) parts.push(indStack(stories, 0.4, 0.22, 3.4))
  parts.push(...indLoadingYard())
  return mergeIndParts(parts)
}

const geoCache = new Map<string, BufferGeometry>()

export function industryGeometryCached(v: IndustryVariant): BufferGeometry {
  const key = industryArchetypeKey(v)
  let g = geoCache.get(key)
  if (!g) {
    g = buildIndustryGeometry(v)
    geoCache.set(key, g)
  }
  return g
}
