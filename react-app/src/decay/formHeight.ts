/**
 * Per-form story ranges from the Height field (0–1).
 * stories = round(lerp(min, max, field)). Deterministic. No Math.random.
 */

export type FormHeightRange = { min: number; max: number }

/** Settled ranges — field pushes each form to its own low/high end. */
export const FORM_HEIGHT_RANGES = {
  row: { min: 2, max: 4 },
  walkup: { min: 4, max: 6 },
  tenement: { min: 4, max: 6 },
  cornerShop: { min: 1, max: 2 },
  mainBlock: { min: 2, max: 4 },
  factory: { min: 1, max: 3 },
  warehouse: { min: 1, max: 2 },
  heavy: { min: 2, max: 4 },
  rail: { min: 1, max: 1 },
  civic: { min: 2, max: 4 },
} as const satisfies Record<string, FormHeightRange>

export type FormHeightKind = keyof typeof FORM_HEIGHT_RANGES

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}

/**
 * Soft edge taper on the field — lowers toward the rim without flattening
 * the noise. strength 0 = none; default gentle.
 */
export function taperFieldTowardEdge(
  field: number,
  rim: number,
  strength = 0.28,
): number {
  const t = clamp01(field)
  const edge = clamp01(rim)
  // Multiply by (1 - strength * rim^2) so core keeps field; edge dips a little.
  return clamp01(t * (1 - strength * edge * edge))
}

/** stories = round(lerp(min, max, field01)). */
export function storiesFromField(
  range: FormHeightRange,
  field01: number,
): number {
  const t = clamp01(field01)
  const v = range.min + (range.max - range.min) * t
  return Math.max(range.min, Math.min(range.max, Math.round(v)))
}

export function formHeightRuleLines(): string {
  const parts = (Object.keys(FORM_HEIGHT_RANGES) as FormHeightKind[]).map(
    (k) => {
      const r = FORM_HEIGHT_RANGES[k]
      return `${k} ${r.min}–${r.max}`
    },
  )
  return `[height] form ranges · ${parts.join(' · ')}`
}
