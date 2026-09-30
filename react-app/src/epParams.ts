export type EpParams = {
  /** Exp2 fog density (neutral gray atmosphere). */
  fogDensity: number
  /** Scales grayscale glitch scan / noise (0–2). */
  glitchIntensity: number
  /** How many bright “sign” voxels to scatter per loaded chunk (approx). */
  neonDensity: number
}

export const defaultEpParams: EpParams = {
  fogDensity: 0.045,
  glitchIntensity: 1,
  neonDensity: 0.35,
}

/** Neutral charcoal fog / clear-color for the experiential playground. */
export const EP_FOG_COLOR = '#1a1a1a'

/** Height colors for EP Interactive mesh only (shared gradient UI stays untouched). */
export const EP_GRAY_GRADIENT = [
  { id: 'ep-low', position: 0, color: '#2a2a2a' },
  { id: 'ep-mid', position: 0.45, color: '#6e6e6e' },
  { id: 'ep-high', position: 1, color: '#d4d4d4' },
] as const
