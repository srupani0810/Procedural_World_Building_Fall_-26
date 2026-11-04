/**
 * Per-form story ranges from the Height field (0–1).
 * stories = round(lerp(min, max, field)). Deterministic. No Math.random.
 *
 * Ranges live in buildingTypeTable — this module exposes a city-facing view
 * (legacy keys heavy / rail map to heavyPlant / railYard).
 */

import {
  BUILDING_FORM_IDS,
  buildingTypeTable,
  type BuildingFormId,
  typeStoryRange,
} from './buildingTypeTable.ts'

export type FormHeightRange = { min: number; max: number }

/** Legacy city keys — heavy/rail alias table ids heavyPlant/railYard. */
export type FormHeightKind =
  | BuildingFormId
  | 'heavy'
  | 'rail'

function rangeFor(k: FormHeightKind): FormHeightRange {
  if (k === 'heavy') return typeStoryRange('heavyPlant')
  if (k === 'rail') return typeStoryRange('railYard')
  return typeStoryRange(k)
}

/**
 * Live story ranges from the shared type table.
 * Prefer typeStoryRange(formId); kept for older call sites.
 */
export const FORM_HEIGHT_RANGES: Record<FormHeightKind, FormHeightRange> = {
  get row() {
    return rangeFor('row')
  },
  get walkup() {
    return rangeFor('walkup')
  },
  get tenement() {
    return rangeFor('tenement')
  },
  get cornerShop() {
    return rangeFor('cornerShop')
  },
  get mainBlock() {
    return rangeFor('mainBlock')
  },
  get factory() {
    return rangeFor('factory')
  },
  get warehouse() {
    return rangeFor('warehouse')
  },
  get heavyPlant() {
    return rangeFor('heavyPlant')
  },
  get railYard() {
    return rangeFor('railYard')
  },
  get civic() {
    return rangeFor('civic')
  },
  get heavy() {
    return rangeFor('heavy')
  },
  get rail() {
    return rangeFor('rail')
  },
}

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
  const parts = BUILDING_FORM_IDS.map((k) => {
    const r = typeStoryRange(k)
    const t = buildingTypeTable[k]
    return `${t.label} ${r.min}–${r.max}`
  })
  return `[height] form ranges · ${parts.join(' · ')}`
}
