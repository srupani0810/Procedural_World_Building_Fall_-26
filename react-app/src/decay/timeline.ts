/**
 * DECAY Phase 1 timeline — staggered absence clock (no Math.random).
 * Reuses v3 stage names + threshold shape; onset rules are DECAY-specific
 * (rim + slope + small plot → earlier). Independent of weatheringV3 code.
 */

import type { BuildingInstance } from './buildings.ts'

export const INTRO_DURATION = 48
export const INTRO_PLAY_SPEED = 2.75

export type LotStage = 'new' | 'settled' | 'abandoned' | 'reclaimed'

export type AbsenceClockParams = {
  /** Multiplier on age once vacating has started. */
  decaySpeed: number
  /** Age when a building leaves New. */
  settledAt: number
  /** Age when a building leaves Settled. */
  abandonedAt: number
  /** Age when a building leaves Abandoned. */
  reclaimedAt: number
}

export const defaultAbsenceClock: AbsenceClockParams = {
  decaySpeed: 1,
  settledAt: 8,
  abandonedAt: 20,
  reclaimedAt: 40,
}

export type StageThresholds = {
  settled: number
  abandoned: number
  reclaimed: number
}

export type BuildingVacateProfile = {
  plotId: number
  /** Intro-clock delay before vacating starts (earlier = rim / steep / small). */
  delay: number
  rate: number
  /** Readable onset ingredients for the process log. */
  rule: string
  rim: number
  steep: number
  small: number
}

export type StageCounts = Record<LotStage, number>

export const emptyStageCounts: StageCounts = {
  new: 0,
  settled: 0,
  abandoned: 0,
  reclaimed: 0,
}

export function stageMarks(clock: AbsenceClockParams): StageThresholds {
  const settled = Math.max(0.5, clock.settledAt)
  const abandoned = Math.max(settled + 0.5, clock.abandonedAt)
  const reclaimed = Math.max(abandoned + 0.5, clock.reclaimedAt)
  return { settled, abandoned, reclaimed }
}

export function stageFromAge(age: number, marks: StageThresholds): LotStage {
  if (age < marks.settled) return 'new'
  if (age < marks.abandoned) return 'settled'
  if (age < marks.reclaimed) return 'abandoned'
  return 'reclaimed'
}

export function stageIndex(stage: LotStage): number {
  if (stage === 'new') return 0
  if (stage === 'settled') return 1
  if (stage === 'abandoned') return 2
  return 3
}

export function ageAtIntroTime(
  timelineT: number,
  profile: BuildingVacateProfile,
  decaySpeed: number,
): number {
  const t = Math.max(0, Math.min(INTRO_DURATION, timelineT))
  const speed = Math.max(0.05, decaySpeed)
  return Math.max(0, (t - profile.delay) * profile.rate * speed)
}

/**
 * Onset priority: farther from center, steeper, smaller plots vacate earlier.
 * Rank spreads delays so stage flips are staggered (one building at a time in
 * onset order), not a synchronized town-wide switch.
 */
export function buildVacateProfiles(
  buildings: BuildingInstance[],
  halfExtent: number,
): BuildingVacateProfile[] {
  if (buildings.length === 0) return []

  let maxArea = 1
  let maxSlope = 0.01
  for (const b of buildings) {
    if (b.area > maxArea) maxArea = b.area
    if (b.slope > maxSlope) maxSlope = b.slope
  }

  type Ranked = {
    b: BuildingInstance
    rim: number
    steep: number
    small: number
    score: number
  }
  const ranked: Ranked[] = buildings.map((b) => {
    const rim = Math.min(1, Math.hypot(b.x, b.z) / Math.max(1, halfExtent))
    const steep = Math.min(1, b.slope / maxSlope)
    const small = 1 - Math.min(1, b.area / maxArea)
    // Rim leads; steep + small pull onset earlier. Core / flat / large last.
    const score = rim * 0.5 + steep * 0.28 + small * 0.22
    return { b, rim, steep, small, score }
  })

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.b.plotId - b.b.plotId
  })

  const n = ranked.length
  const out: BuildingVacateProfile[] = []
  for (let i = 0; i < n; i++) {
    const r = ranked[i]!
    const rankT = n <= 1 ? 0 : i / (n - 1)
    // Spread starts across most of the intro so flips stay readable one-by-one.
    const delay = rankT * INTRO_DURATION * 0.72
    const rate = 0.5 + (1 - rankT) * 0.75
    const parts: string[] = []
    if (r.rim >= 0.45) parts.push('rim')
    else if (r.rim <= 0.2) parts.push('core')
    if (r.steep >= 0.45) parts.push('steep')
    if (r.small >= 0.45) parts.push('small-plot')
    if (parts.length === 0) parts.push('mid-field')
    out.push({
      plotId: r.b.plotId,
      delay,
      rate,
      rule: parts.join('+'),
      rim: r.rim,
      steep: r.steep,
      small: r.small,
    })
  }
  return out
}

export function profileMap(
  profiles: BuildingVacateProfile[],
): Map<number, BuildingVacateProfile> {
  const m = new Map<number, BuildingVacateProfile>()
  for (const p of profiles) m.set(p.plotId, p)
  return m
}

export function stageAtTime(
  plotId: number,
  timelineT: number,
  profiles: Map<number, BuildingVacateProfile>,
  clock: AbsenceClockParams,
): { stage: LotStage; age: number; rule: string } {
  const marks = stageMarks(clock)
  const p = profiles.get(plotId)
  if (!p) return { stage: 'new', age: 0, rule: 'none' }
  const age = ageAtIntroTime(timelineT, p, clock.decaySpeed)
  return { stage: stageFromAge(age, marks), age, rule: p.rule }
}

export function countStages(
  buildings: BuildingInstance[],
  timelineT: number,
  profiles: Map<number, BuildingVacateProfile>,
  clock: AbsenceClockParams,
): StageCounts {
  const counts = { ...emptyStageCounts }
  for (const b of buildings) {
    const { stage } = stageAtTime(b.plotId, timelineT, profiles, clock)
    counts[stage]++
  }
  return counts
}

/** Sample stage counts across the intro for the dock chart. */
export function sampleStageSeries(
  buildings: BuildingInstance[],
  profiles: Map<number, BuildingVacateProfile>,
  clock: AbsenceClockParams,
  samples = 49,
): { t: number; counts: StageCounts }[] {
  const out: { t: number; counts: StageCounts }[] = []
  const n = Math.max(2, samples)
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * INTRO_DURATION
    out.push({ t, counts: countStages(buildings, t, profiles, clock) })
  }
  return out
}

export function formatStageLog(
  plotId: number,
  from: LotStage,
  to: LotStage,
  rule: string,
  t: number,
): string {
  return `[stage] p${plotId} ${from}→${to} · t=${t.toFixed(1)}s · rule ${rule}`
}
