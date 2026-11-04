/**
 * Building Lab draft state — local only until Apply writes buildingTypeTable.
 */

import {
  BUILDING_TYPE_DEFAULTS,
  buildingTypeFingerprint,
  cloneBuildingType,
  getBuildingType,
  type BuildingFormId,
  type BuildingTypeParams,
} from '../buildingTypeTable.ts'
import { rowVariantFromSeed, type RowVariant } from '../rowHouseForm.ts'

export type LabPreview = {
  stories: 2 | 3 | 4
  doorSide: -1 | 1
  doorColorIndex: number
  windows: RowVariant['windows']
  corner: boolean
  chimneySide: -1 | 1
  /** 0…5 — position along a 6-unit block (variant strip). */
  lotPosition: number
}

export const LAB_VARIANT_COUNT = 6
/** Stable plot id for Lab strip seeds (block-position rule only). */
export const LAB_STRIP_PLOT_ID = 17

export function defaultLabDraft(id: BuildingFormId = 'row'): BuildingTypeParams {
  return cloneBuildingType(BUILDING_TYPE_DEFAULTS[id])
}

/** Draft seeded from the live city table (Revert draft). */
export function draftFromLiveTable(id: BuildingFormId = 'row'): BuildingTypeParams {
  return cloneBuildingType(getBuildingType(id))
}

export function defaultLabPreview(draft: BuildingTypeParams): LabPreview {
  return previewFromLotPosition(draft, 0)
}

export function previewFromVariant(
  draft: BuildingTypeParams,
  v: RowVariant,
  lotPosition: number,
): LabPreview {
  return {
    stories: v.stories,
    doorSide: v.doorSide,
    doorColorIndex: v.doorColorIndex,
    windows: v.windows,
    corner: v.corner,
    chimneySide: v.chimneySide,
    lotPosition: Math.max(0, Math.min(LAB_VARIANT_COUNT - 1, Math.floor(lotPosition))),
  }
}

/** Deterministic variant from lot position along a 6-unit block. */
export function labVariantAt(
  draft: BuildingTypeParams,
  lotPosition: number,
): RowVariant {
  const i = Math.max(0, Math.min(LAB_VARIANT_COUNT - 1, Math.floor(lotPosition)))
  const baseStories = (
    draft.size.storyMin >= 4 ? 4 : draft.size.storyMin >= 3 ? 3 : 2
  ) as number
  return rowVariantFromSeed(
    LAB_STRIP_PLOT_ID,
    i,
    LAB_VARIANT_COUNT,
    baseStories,
    i === 0 || i === LAB_VARIANT_COUNT - 1,
    draft,
  )
}

export function previewFromLotPosition(
  draft: BuildingTypeParams,
  lotPosition: number,
): LabPreview {
  const v = labVariantAt(draft, lotPosition)
  return previewFromVariant(draft, v, lotPosition)
}

export function labRowVariant(
  draft: BuildingTypeParams,
  preview: LabPreview,
): RowVariant {
  const stories = (
    preview.stories > draft.size.storyMax
      ? draft.size.storyMax
      : preview.stories < draft.size.storyMin
        ? draft.size.storyMin
        : preview.stories
  ) as 2 | 3 | 4
  const roof: RowVariant['roof'] =
    draft.roof.kind === 'flatCornice'
      ? 'flat'
      : draft.roof.kind === 'gable'
        ? 'gable'
        : labVariantAt(draft, preview.lotPosition).roof
  let windows = preview.windows
  if (windows === 'bay' && !draft.windows.bayAllowed) windows = 'even'
  return {
    stories,
    roof,
    doorSide: preview.doorSide,
    doorColorIndex: preview.doorColorIndex,
    windows,
    corner: preview.corner,
    chimneySide: preview.chimneySide,
    roofStep: 0,
  }
}

export function draftHasChanges(
  draft: BuildingTypeParams,
  id: BuildingFormId = 'row',
): boolean {
  return buildingTypeFingerprint(draft) !== buildingTypeFingerprint(getBuildingType(id))
}

/** Plot mass size matching city row unit (one house). */
export function labPlotMass(
  draft: BuildingTypeParams,
  plotFrontage: number,
  plotDepth: number,
  storyHeight: number,
): { width: number; depth: number; height: number; stories: number } {
  const yard = draft.size.yardFrac ?? 0.38
  const unitMin = draft.size.unitMin ?? draft.size.minWidth
  const unitMax = draft.size.unitMax ?? Math.max(unitMin, plotFrontage * 0.42)
  let width = Math.min(unitMax, Math.max(unitMin, plotFrontage * 0.36))
  width *= draft.size.widthMult
  width = Math.max(draft.size.minWidth, width)
  let depth = plotDepth * (1 - yard) * draft.size.depthMult
  depth = Math.max(draft.size.minDepth, depth)
  return {
    width,
    depth,
    height: storyHeight,
    stories: draft.size.storyMin,
  }
}
