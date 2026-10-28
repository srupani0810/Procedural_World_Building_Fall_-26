/**
 * Legible settlement rules for Weathering v3 building generation.
 * Every massing / claim decision maps to something a viewer can see
 * (neighbors, height, distance/density, stage) — no per-cell hash rolls.
 */
import {
  GRID_ORTHO,
  gridKey,
  type GridCell,
} from './epGrid.ts'

/** City footprint radius in cells (hard disk — visible radius). */
export const SEED_CITY_RADIUS = 5

/**
 * Same spatial signals as vacate clocks: rim (0 at origin → 1 at disk edge),
 * west (1 on the west side → 0 on the east), north (0 south → 1 north).
 * Streets and vacating share this math so both read as one settlement logic.
 */
export function settlementSpatial(ix: number, iz: number) {
  const r = Math.sqrt(ix * ix + iz * iz)
  const rim = Math.min(1, r / Math.max(1, SEED_CITY_RADIUS))
  const west = Math.max(0, Math.min(1, (-ix + SEED_CITY_RADIUS) / (SEED_CITY_RADIUS * 2)))
  const north = Math.max(0, Math.min(1, (iz + SEED_CITY_RADIUS) / (SEED_CITY_RADIUS * 2)))
  return { r, rim, west, north }
}

export const SIDE_NAMES = ['south', 'east', 'north', 'west'] as const
export type SideName = (typeof SIDE_NAMES)[number]

export type CardinalNeighbors = {
  south: GridCell | null
  east: GridCell | null
  north: GridCell | null
  west: GridCell | null
}

export type RoofKind = 'court' | 'shed' | 'flat'

/** Open = no neighbor, or neighbor shorter than this story (same as storyFaceOpen at iy). */
export function openSidesForHeight(
  neighbors: CardinalNeighbors,
  storyIndex: number,
): boolean[] {
  return [
    !neighbors.south || storyIndex >= neighbors.south.height,
    !neighbors.east || storyIndex >= neighbors.east.height,
    !neighbors.north || storyIndex >= neighbors.north.height,
    !neighbors.west || storyIndex >= neighbors.west.height,
  ]
}

/** Ground-story open faces (no abutting neighbor). */
export function openSidesAtLot(neighbors: CardinalNeighbors): boolean[] {
  return [
    !neighbors.south,
    !neighbors.east,
    !neighbors.north,
    !neighbors.west,
  ]
}

export function countTrue(flags: boolean[]) {
  let n = 0
  for (const f of flags) if (f) n += 1
  return n
}

/**
 * Roof from how many ground faces are open — readable from the street.
 * 0 open → enclosed court deck; 4 open → freestanding flat roof; else shed toward closed sides.
 */
export function roofKindFromOpenCount(openCount: number): RoofKind {
  if (openCount <= 0) return 'court'
  if (openCount >= 4) return 'flat'
  return 'shed'
}

export function describeRoof(kind: RoofKind, openCount: number) {
  if (kind === 'court') return `court deck (${openCount} open sides)`
  if (kind === 'flat') return `flat roof (${openCount} open sides)`
  return `shed roof (${openCount} open sides → slopes to closed)`
}

/** Hard disk — town edge is the visible radius, not salted bites. */
export function inSeedCityDisk(ix: number, iz: number, rad = SEED_CITY_RADIUS) {
  return ix * ix + iz * iz <= rad * rad
}

function floorMod(n: number, period: number) {
  return ((n % period) + period) % period
}

/**
 * Corridor spacing from rim: tight near the core (period 3), looser at the rim (5).
 * Same rim signal as cellVacateProfile — not a fixed graph-paper modulo.
 */
export function streetPeriodFromRim(rim: number) {
  return 3 + Math.floor(Math.min(1, Math.max(0, rim)) * 2)
}

function spacingPhrase(rim: number) {
  if (rim < 0.35) return 'spacing tightened near core'
  if (rim > 0.7) return 'spacing loosened at rim'
  return 'mid-ring spacing'
}

/**
 * N–S corridor: whole column empty when that column’s residue hits the west-biased phase.
 * Evaluated on (ix, 0) so the line is coherent; west bias matches vacate.
 */
function northSouthStreetNote(ix: number): string | null {
  const { rim, west } = settlementSpatial(ix, 0)
  const period = streetPeriodFromRim(rim)
  const offset = Math.floor(west * Math.max(0, period - 1) + 1e-9)
  if (floorMod(ix - offset, period) !== 0) return null
  const bias = west > 0.55 ? 'west bias' : west < 0.45 ? 'eastward shift' : 'central west/east balance'
  return `${spacingPhrase(rim)} + ${bias}`
}

/**
 * E–W corridor: whole row empty when that row’s residue hits the north-biased phase.
 * Evaluated on (0, iz); north is the orthogonal twin of vacate’s west axis.
 */
function eastWestStreetNote(iz: number): string | null {
  const { rim, north } = settlementSpatial(0, iz)
  const period = streetPeriodFromRim(rim)
  const offset = Math.floor(north * Math.max(0, period - 1) + 1e-9)
  if (floorMod(iz - offset, period) !== 0) return null
  const bias = north > 0.55 ? 'north bias' : north < 0.45 ? 'southward shift' : 'central north/south balance'
  return `${spacingPhrase(rim)} + ${bias}`
}

/**
 * Max unbroken claimed run (axis-aligned) before a floor corridor is forced.
 * Keeps fused pockets from exceeding roughly 3×3 after bias tightening.
 */
export const SEED_MAX_CLAIMED_RUN = 3

function streetKey(ix: number, iz: number) {
  return `${ix},${iz}`
}

/**
 * Full street plan: bias-driven corridors first, then max-block floor.
 * Floor opens the midpoint of any claimed run longer than SEED_MAX_CLAIMED_RUN
 * (iterated until every axis-aligned run is ≤ that length).
 */
export function buildSeedStreetPlan(rad = SEED_CITY_RADIUS): Map<string, string> {
  const streets = new Map<string, string>()

  for (let iz = -rad; iz <= rad; iz++) {
    for (let ix = -rad; ix <= rad; ix++) {
      if (!inSeedCityDisk(ix, iz, rad)) continue
      const ns = northSouthStreetNote(ix)
      const ew = eastWestStreetNote(iz)
      if (!ns && !ew) continue
      const why = [ns, ew].filter(Boolean).join('; ')
      streets.set(
        streetKey(ix, iz),
        `[rule] ${ix},${iz} left empty: street corridor, ${why}`,
      )
    }
  }

  let guard = 0
  while (guard++ < 64) {
    let added = false

    const openMid = (ix: number, iz: number) => {
      const k = streetKey(ix, iz)
      if (streets.has(k)) return
      streets.set(k, `[rule] ${ix},${iz} left empty: street corridor, max-block floor`)
      added = true
    }

    for (let iz = -rad; iz <= rad; iz++) {
      let run: number[] = []
      const flush = () => {
        if (run.length > SEED_MAX_CLAIMED_RUN) {
          openMid(run[Math.floor(run.length / 2)]!, iz)
        }
        run = []
      }
      for (let ix = -rad; ix <= rad; ix++) {
        if (!inSeedCityDisk(ix, iz, rad) || streets.has(streetKey(ix, iz))) {
          flush()
          continue
        }
        if (run.length > 0 && run[run.length - 1] !== ix - 1) flush()
        run.push(ix)
      }
      flush()
    }

    for (let ix = -rad; ix <= rad; ix++) {
      let run: number[] = []
      const flush = () => {
        if (run.length > SEED_MAX_CLAIMED_RUN) {
          openMid(ix, run[Math.floor(run.length / 2)]!)
        }
        run = []
      }
      for (let iz = -rad; iz <= rad; iz++) {
        if (!inSeedCityDisk(ix, iz, rad) || streets.has(streetKey(ix, iz))) {
          flush()
          continue
        }
        if (run.length > 0 && run[run.length - 1] !== iz - 1) flush()
        run.push(iz)
      }
      flush()
    }

    if (!added) break
  }

  return streets
}

let cachedStreetPlan: Map<string, string> | null = null
let cachedStreetRad = Number.NaN

export function seedStreetPlan(rad = SEED_CITY_RADIUS) {
  if (cachedStreetPlan && cachedStreetRad === rad) return cachedStreetPlan
  cachedStreetPlan = buildSeedStreetPlan(rad)
  cachedStreetRad = rad
  return cachedStreetPlan
}

/** True when this lot is a bias or max-block street vacancy. */
export function isSeedStreetCorridor(ix: number, iz: number) {
  return seedStreetPlan().has(streetKey(ix, iz))
}

/**
 * Why a disk cell stays unclaimed at seed — null means the lot is claimed.
 * Outside the city disk is not a seed vacancy (no log).
 */
export function seedCellVacancyReason(ix: number, iz: number): string | null {
  if (!inSeedCityDisk(ix, iz)) return null
  return seedStreetPlan().get(streetKey(ix, iz)) ?? null
}

/** Phase 1 claims this lot if it sits in the disk and is not a street vacancy. */
export function shouldSeedClaim(ix: number, iz: number) {
  return inSeedCityDisk(ix, iz) && seedCellVacancyReason(ix, iz) === null
}

/** All in-disk vacancies for the process log (sorted). */
export function listSeedVacancies(rad = SEED_CITY_RADIUS) {
  return [...seedStreetPlan(rad).values()].sort((a, b) => a.localeCompare(b))
}

/** Bulk mill ceiling (wide 2–5 story band). Panel maxStories only caps this. */
export function millTopStories(maxStories: number) {
  const cap = Math.max(2, Math.min(8, Math.floor(maxStories)))
  return Math.min(5, cap)
}

/**
 * Mild accent above mills — one story over mill top, never the full panel max.
 * Keeps skyline gentle instead of a single dominating tower.
 */
export function accentStories(maxStories: number) {
  const cap = Math.max(2, Math.min(8, Math.floor(maxStories)))
  return Math.min(cap, millTopStories(maxStories) + 1)
}

/**
 * Bulk settlement = wide 2–5 story mills by rim distance.
 * At most two mild accents (origin + east neighbor) sit one story above mills —
 * not a core disk of maxStories spikes.
 */
export function heightFromCenterDistance(ix: number, iz: number, maxStories: number) {
  const millTop = millTopStories(maxStories)
  const accent = accentStories(maxStories)
  if ((ix === 0 && iz === 0) || (ix === 1 && iz === 0)) return accent
  const r = Math.sqrt(ix * ix + iz * iz)
  const t = Math.max(0, 1 - r / Math.max(1, SEED_CITY_RADIUS))
  const span = Math.max(0, millTop - 2)
  return 2 + Math.floor(t * span)
}

/** Mild accent shells — metal landmark type, not brick mills. */
export function isLandmarkLot(ix: number, iz: number, height: number, maxStories: number) {
  if (height < accentStories(maxStories)) return false
  return (ix === 0 && iz === 0) || (ix === 1 && iz === 0)
}

/**
 * Color cycles by distance ring from origin — same ring, same swatch band.
 * Index stays in 0..3 (four swatches).
 */
export function colorFromDistanceRing(ix: number, iz: number) {
  const ring = Math.floor(Math.sqrt(ix * ix + iz * iz))
  return ring % 4
}

/**
 * Fresh claim height from abutting neighbors’ heights (mean, rounded).
 * Isolated claim → 1 story. Cap by maxStories.
 */
export function heightFromNeighbors(
  neighbors: Array<GridCell | null | undefined>,
  maxStories: number,
) {
  const cap = Math.max(1, Math.floor(maxStories))
  const heights: number[] = []
  for (const n of neighbors) {
    if (n && n.height > 0) heights.push(n.height)
  }
  if (heights.length === 0) return 1
  const mean = heights.reduce((a, b) => a + b, 0) / heights.length
  return Math.min(cap, Math.max(1, Math.round(mean)))
}

/** Majority neighbor swatch; ties → lowest index. No neighbors → fallback. */
export function colorFromNeighborMajority(
  neighborColors: number[],
  fallback = 0,
) {
  if (neighborColors.length === 0) return fallback
  const counts = new Map<number, number>()
  for (const c of neighborColors) {
    counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  let best = fallback
  let bestN = -1
  for (const [c, n] of counts) {
    if (n > bestN || (n === bestN && c < best)) {
      best = c
      bestN = n
    }
  }
  return best
}

/**
 * Presence lamps on the most central lots up to `chance` share.
 * Central = closer to origin; ties by iz then ix. Explainable: core stays lit first.
 */
export function assignInhabitedByCentrality(
  cells: Iterable<GridCell>,
  chance: number,
) {
  const list = [...cells]
  for (const cell of list) cell.inhabited = false
  if (list.length === 0) return
  const share = Math.min(1, Math.max(0, chance))
  const want = Math.floor(list.length * share + 1e-9)
  list.sort((a, b) => {
    const ra = a.ix * a.ix + a.iz * a.iz
    const rb = b.ix * b.ix + b.iz * b.iz
    return ra - rb || a.iz - b.iz || a.ix - b.ix
  })
  for (let i = 0; i < want; i++) list[i]!.inhabited = true
}

/**
 * On a new claim: inhabit if current inhabited share is still below the panel chance.
 * Prefer denser lots (more neighbors) when deciding — same “core presence” idea.
 */
export function shouldClaimInhabited(
  map: ReadonlyMap<string, GridCell>,
  ix: number,
  iz: number,
  chance: number,
) {
  const share = Math.min(1, Math.max(0, chance))
  if (share <= 0) return false
  if (map.size === 0) return share >= 0.5
  let inhabited = 0
  for (const cell of map.values()) if (cell.inhabited) inhabited += 1
  if (inhabited / map.size >= share) return false
  // Fill toward denser edge first: more neighbors → more likely still under share.
  let neighbors = 0
  for (const dir of Object.values(GRID_ORTHO)) {
    if (map.has(gridKey(ix + dir.dix, iz + dir.diz))) neighbors += 1
  }
  return neighbors >= 1 || inhabited / Math.max(1, map.size) < share * 0.5
}

/**
 * Idle growth: unclaimed edge cell with the most claimed neighbors.
 * Ties: lowest iz, then ix. No Math.random.
 */
export function pickGrowthCellByDensity(cells: ReadonlyMap<string, GridCell>) {
  if (cells.size === 0) return { ix: 0, iz: 0 }
  const options: { ix: number; iz: number; weight: number }[] = []
  const seen = new Set<string>()
  for (const cell of cells.values()) {
    for (const dir of Object.values(GRID_ORTHO)) {
      const ix = cell.ix + dir.dix
      const iz = cell.iz + dir.diz
      const key = gridKey(ix, iz)
      if (cells.has(key) || seen.has(key)) continue
      seen.add(key)
      let weight = 0
      for (const around of Object.values(GRID_ORTHO)) {
        if (cells.has(gridKey(ix + around.dix, iz + around.diz))) weight += 1
      }
      if (weight > 0) options.push({ ix, iz, weight })
    }
  }
  if (options.length === 0) return null
  options.sort((a, b) => b.weight - a.weight || a.iz - b.iz || a.ix - b.ix)
  const best = options[0]!
  return { ix: best.ix, iz: best.iz }
}

/**
 * Small deferred-maintenance patches on the most-exposed open sides.
 * Patch-sized (not full-edge capes). Hang is in *local* Y before buildingScale,
 * so world hang stays ~0.45–0.55 regardless of story count / scale.
 */
export function tarpPlan(
  height: number,
  openAtGround: boolean[],
  cellSize = 1.85,
  buildingScale = 3,
) {
  const openIdx: number[] = []
  for (let i = 0; i < 4; i++) if (openAtGround[i]) openIdx.push(i)
  const sheetsWanted = height >= 4 ? 2 : height >= 2 ? 1 : 0
  const sides = openIdx.slice(0, sheetsWanted)
  const scale = Math.max(0.5, buildingScale)
  // Target ~half a story of world hang after Y scale.
  const hang = Math.min(0.22, 0.5 / scale)
  const flare = Math.min(0.1, cellSize * 0.06)
  const droop = Math.min(0.06, hang * 0.35)
  // Fraction of the open edge the patch covers (centered) — not the full roof line.
  const edgeSpan = 0.28
  return {
    sides,
    hang,
    flare,
    droop,
    edgeSpan,
    reason:
      sides.length === 0
        ? height < 2
          ? 'no tarp (under 2 stories)'
          : 'no tarp (no open sides)'
        : `tarp×${sides.length} patch on open ${sides.map((s) => SIDE_NAMES[s]).join('+')}`,
  }
}

/**
 * Localized failure bay = first open ground side (most exposed).
 * Enclosed court → south bay. Roof/window strength from height / exposure.
 */
export function failFromExposure(openAtGround: boolean[], height: number, maxStories: number) {
  let failSide = 0
  for (let i = 0; i < 4; i++) {
    if (openAtGround[i]) {
      failSide = i
      break
    }
  }
  const cap = Math.max(1, maxStories)
  const roofSeed = 0.25 + 0.75 * Math.min(1, height / cap)
  const windowSeed = countTrue(openAtGround) / 4
  return { failSide, roofSeed, windowSeed }
}

/** Cardinal distance from fail side: 0 = fail face, 1 = adjacent, 2 = opposite. */
export function sideDistFromFail(side: number, failSide: number) {
  const d = Math.abs(side - failSide) % 4
  return Math.min(d, 4 - d)
}

/**
 * Wear threshold when a pane first cracks (legible glass damage).
 * Held/new (wear < 1) stays fully intact. Fail-bay / lower stories crack first.
 */
export function glassCrackWear(order: number, sideDist: number) {
  if (sideDist >= 2) return 1.85 + order * 0.1
  if (sideDist === 1) return 1.25 + order * 0.16
  return 1.0 + order * 0.14
}

/**
 * Wear threshold for fully broken / gone glass.
 * Opposite face never fully breaks (returns a value above max wear).
 */
export function glassBreakWear(order: number, sideDist: number) {
  if (sideDist >= 2) return 9
  if (sideDist === 1) return 2.55 + order * 0.12
  return 1.45 + order * 0.18
}

export function glassStateAtWear(wear: number, order: number, sideDist: number): 'intact' | 'cracked' | 'broken' {
  if (wear >= glassBreakWear(order, sideDist)) return 'broken'
  if (wear >= glassCrackWear(order, sideDist)) return 'cracked'
  return 'intact'
}

/** Lean outward on the fail bay (toward the open street). */
export function tiltFromFailSide(failSide: number, amount = 0.22) {
  // 0 south −Z, 1 east +X, 2 north +Z, 3 west −X
  if (failSide === 0) return { tiltX: 0, tiltZ: -amount }
  if (failSide === 1) return { tiltX: amount, tiltZ: 0 }
  if (failSide === 2) return { tiltX: 0, tiltZ: amount }
  return { tiltX: -amount, tiltZ: 0 }
}

export function describeLotMassing(
  cell: GridCell,
  neighbors: CardinalNeighbors,
  maxStories = 8,
) {
  const open = openSidesAtLot(neighbors)
  const openCount = countTrue(open)
  const kind = roofKindFromOpenCount(openCount)
  const openNames = SIDE_NAMES.filter((_, i) => open[i]).join('+') || 'none'
  const tarp = tarpPlan(cell.height, open)
  const landmark = isLandmarkLot(cell.ix, cell.iz, cell.height, maxStories)
  return [
    `${cell.height} stories`,
    landmark ? 'metal landmark (mild accent)' : 'brick mill',
    describeRoof(kind, openCount),
    `open ${openNames}`,
    tarp.reason,
    cell.inhabited ? 'inhabited' : 'vacated tag',
  ].join(' · ')
}

export function describeClaimDecision(args: {
  ix: number
  iz: number
  height: number
  colorLabel: string
  heightReason: string
  colorReason: string
  inhabited: boolean
  inhabitedReason: string
  neighbors: CardinalNeighbors
}) {
  const open = openSidesAtLot(args.neighbors)
  const openCount = countTrue(open)
  const kind = roofKindFromOpenCount(openCount)
  return [
    `${args.ix},${args.iz} claim`,
    `${args.height} stories (${args.heightReason})`,
    `${args.colorLabel} (${args.colorReason})`,
    describeRoof(kind, openCount),
    args.inhabited ? `inhabited (${args.inhabitedReason})` : `no lamp (${args.inhabitedReason})`,
  ].join(' · ')
}
