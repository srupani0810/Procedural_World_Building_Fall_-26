/**
 * Phase 1 timeline intro for Weathering v3.
 * Per-cell stagger models uneven automation adoption — not a synchronized ruin countdown.
 * Stage labels stay new → settled → abandoned → reclaimed (existing decay logic).
 *
 * Building seed (footprint / height / color / inhabited) uses legible lotRules —
 * not per-cell hash rolls. Vacate delay/rate stays spatially staggered (decay.md).
 */
import {
  cellCentroid,
  gridKey,
  type GridCell,
  type GridLayout,
} from './epGrid.ts'
import {
  assignInhabitedByCentrality,
  colorFromDistanceRing,
  heightFromCenterDistance,
  SEED_CITY_RADIUS,
  settlementSpatial,
  shouldSeedClaim,
} from './lotRules.ts'

export { SEED_CITY_RADIUS }

export type TownPhase = 'intro' | 'ongoing'

/** Simulated absence-seconds spanned by the intro scrubber (not wall-clock). */
export const INTRO_DURATION = 48

/** How many timeline-seconds advance per real second while playing. */
export const INTRO_PLAY_SPEED = 2.75

export type VacateProfile = {
  /** Timeline delay before this lot starts thinning (automation arrives later). */
  delay: number
  /** Age multiplier once vacating has started. */
  rate: number
}

/**
 * Uneven start + rate from visible spatial position (not a hidden hash).
 * Same settlementSpatial as street corridors: west/center start earlier; rim later.
 */
export function cellVacateProfile(ix: number, iz: number): VacateProfile {
  const { rim, west } = settlementSpatial(ix, iz)
  const delayFrac = 0.06 + rim * 0.48 + (1 - west) * 0.12
  const delay = Math.min(INTRO_DURATION * 0.72, delayFrac * INTRO_DURATION)
  const rate = 0.45 + rim * 0.85
  return { delay, rate }
}

/** Age under the intro scrubber. Shells are never removed — age only. */
export function ageAtIntroTime(timelineT: number, profile: VacateProfile) {
  const t = Math.max(0, Math.min(INTRO_DURATION, timelineT))
  return Math.max(0, (t - profile.delay) * profile.rate)
}

export function formatPhaseLabel(phase: TownPhase, timelineT: number) {
  if (phase === 'intro') {
    return `Phase 1 — Timeline intro · ${timelineT.toFixed(1)}s / ${INTRO_DURATION}s`
  }
  return 'Phase 2 — Continuous · claim empty lots only'
}

export function formatPhaseHint(phase: TownPhase) {
  if (phase === 'intro') {
    return 'Watch uneven vacating under staggered automation adoption. Scrub or play — end state is a mix of stages, never total wipe.'
  }
  return 'Ongoing absence clocks. Existing shells cannot be cleared or restored — only new empty lots can be claimed (start held/new).'
}

/**
 * Intact city at age 0 (stage new / held care) with street vacancies.
 * Corridors use rim + west/north bias (same spatial math as vacate) so spacing is
 * uneven — not a fixed every-Nth lattice. Empty lots stay claimable in Phase 2.
 */
export function seedIntactCity(
  cells: Map<string, GridCell>,
  layout: GridLayout,
  heightAt: (x: number, z: number) => number,
  maxStories: number,
  fireBarrelChance: number,
) {
  cells.clear()
  const rad = SEED_CITY_RADIUS
  for (let iz = -rad; iz <= rad; iz++) {
    for (let ix = -rad; ix <= rad; ix++) {
      if (!shouldSeedClaim(ix, iz)) continue
      const [cx, cz] = cellCentroid(ix, iz, layout)
      const profile = cellVacateProfile(ix, iz)
      cells.set(gridKey(ix, iz), {
        ix,
        iz,
        color: colorFromDistanceRing(ix, iz),
        height: heightFromCenterDistance(ix, iz, maxStories),
        baseY: heightAt(cx, cz),
        age: 0,
        inhabited: false,
        vacateRate: profile.rate,
      })
    }
  }
  assignInhabitedByCentrality(cells.values(), fireBarrelChance)
}

/** One-line summary of the seed vacancy pattern for the process log. */
export function seedLayoutRuleSummary() {
  return `seed layout · asymmetric streets (rim + west/north bias) · max-block floor (runs ≤3) · disk r≤${SEED_CITY_RADIUS}`
}

/** Apply intro ages from the scrubber — does not add or remove cells. */
export function applyIntroAges(cells: Iterable<GridCell>, timelineT: number) {
  for (const cell of cells) {
    const profile = cellVacateProfile(cell.ix, cell.iz)
    cell.vacateRate = profile.rate
    cell.age = ageAtIntroTime(timelineT, profile)
  }
}
