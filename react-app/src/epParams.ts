export type EpParams = {
  /** Exp2 fog density (cool teal atmosphere). */
  fogDensity: number
  /** Scales Glitch shader RGB split / scan / noise (0–2). */
  glitchIntensity: number
  /** How many neon sign voxels to scatter per loaded chunk (approx). */
  neonDensity: number
}

export const defaultEpParams: EpParams = {
  fogDensity: 0.045,
  glitchIntensity: 1,
  neonDensity: 0.35,
}

/** Cool teal / blue-gray fog for the experiential playground. */
export const EP_FOG_COLOR = '#1a3540'
