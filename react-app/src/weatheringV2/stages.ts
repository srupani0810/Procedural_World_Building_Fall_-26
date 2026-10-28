/**
 * Vacating stages + research-led impact cues.
 * Aligned with decay.md: gradual vacating under automation; shell never deleted;
 * enclosure/surface/material before sparse partial structure.
 */

export type VacateStage = 'held' | 'thinning' | 'vacated' | 'impacted'

/** Visible impact mode — mix over time, not one-channel ruin look. */
export type ImpactMode = 'intact' | 'paint' | 'rust' | 'partial'

export type StageThresholds = {
  thinningAt: number
  vacatedAt: number
  impactedAt: number
}

export function vacateStage(age: number, marks: StageThresholds): VacateStage {
  if (age >= marks.impactedAt) return 'impacted'
  if (age >= marks.vacatedAt) return 'vacated'
  if (age >= marks.thinningAt) return 'thinning'
  return 'held'
}

/**
 * On one cell over time: paint → rust → occasional partial.
 * Across town, different ages still read as a mix.
 */
export function impactMode(age: number, marks: StageThresholds): ImpactMode {
  if (age >= marks.impactedAt) return 'partial'
  if (age >= marks.vacatedAt) return 'rust'
  if (age >= marks.thinningAt) return 'paint'
  return 'intact'
}

export const STAGE_LABEL: Record<VacateStage, string> = {
  held: 'held — still cared for',
  thinning: 'thinning — upkeep withdrawing',
  vacated: 'vacated — use left, shell remains',
  impacted: 'impacted — prolonged absence (shell remains)',
}

export const IMPACT_LABEL: Record<ImpactMode, string> = {
  intact: 'intact enclosure',
  paint: 'paint wear / failed finish',
  rust: 'rust + enclosure failure',
  partial: 'partial structural loss (shell stands)',
}

/** High-contrast stage colors for legibility (not mood fog). */
export const STAGE_COLOR: Record<VacateStage, string> = {
  held: '#5ec8ff',
  thinning: '#e6c35c',
  vacated: '#e07a3a',
  impacted: '#9aa3ad',
}
