import type { GradientStop } from './heightGradient.ts'

export type EpParams = {
  /** Soft mist fog density (Voxel Cloud depth). */
  fogDensity: number
  /** Filigree / porous grain on the soft town shader (0–2). */
  glitchIntensity: number
}

export const defaultEpParams: EpParams = {
  fogDensity: 0.04,
  glitchIntensity: 0.65,
}

/** Dark mist / clear-color — Voxel Cloud atmosphere. */
export const EP_FOG_COLOR = '#14161a'

/** Near-black sky behind the mist. */
export const EP_SKY_COLOR = '#0c0d10'

/** Dark water under the blocky islands. */
export const EP_WATER_COLOR = '#1a1e24'

/**
 * Height colors for EP Interactive mesh only — charcoal → slate → pale stone.
 * Shared Height gradient UI stays untouched.
 */
export const EP_TOWN_GRADIENT: GradientStop[] = [
  { id: 'ep-deep', position: 0, color: '#1a1c20' },
  { id: 'ep-low', position: 0.28, color: '#2c3038' },
  { id: 'ep-mid', position: 0.55, color: '#4a505a' },
  { id: 'ep-high', position: 0.78, color: '#6e7682' },
  { id: 'ep-crest', position: 1, color: '#9aa1ab' },
]

/** Fixed scaffold-link density for pale filigree spans (no colored accents). */
export const EP_SCAFFOLD_DENSITY = 0.38
