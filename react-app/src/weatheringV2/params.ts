/**
 * Weathering v2 — standalone params.
 * Clarity pass: visible generation + legible gradual vacating (see /decay.md).
 */

export type V2Params = {
  cellSize: number
  /** Seconds of absence before care starts reading as thin. */
  thinningAt: number
  /** Seconds before the lot reads as vacated (use left). */
  vacatedAt: number
  /** Seconds before prolonged absence impacts the shell (shell remains). */
  impactedAt: number
  decaySpeed: number
  autoGrow: boolean
  /** Seconds between autonomous claims. */
  growEvery: number
  maxStories: number
  /** When true, advance one generation step only on button press. */
  steppedGeneration: boolean
}

export const defaultV2Params: V2Params = {
  cellSize: 2.2,
  thinningAt: 6,
  vacatedAt: 14,
  impactedAt: 28,
  decaySpeed: 1,
  /** Off by default so the seeded mixed-program cluster stays inspectable. */
  autoGrow: false,
  growEvery: 4,
  maxStories: 5,
  steppedGeneration: false,
}
