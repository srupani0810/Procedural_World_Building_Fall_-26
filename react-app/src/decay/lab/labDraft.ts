/**
 * Building Lab draft — uses shared rowVariantFromSeed (same as the city).
 */

import {
  BUILDING_TYPE_DEFAULTS,
  buildingTypeFingerprint,
  cloneBuildingType,
  getBuildingType,
  type BuildingFormId,
  type BuildingTypeParams,
} from '../buildingTypeTable.ts'
import {
  rowVariantFromSeed,
  type RowVariant,
} from '../rowHouseForm.ts'

export type LabPreview = {
  stories: 2 | 3 | 4
  doorSide: -1 | 1
  doorColorIndex: number
  windows: RowVariant['windows']
  corner: boolean
  chimneySide: -1 | 1
  /** 0…5 — position along a 6-unit block (variant strip). */
  lotPosition: number
  roof: RowVariant['roof']
  wallHex: string
}

export const LAB_VARIANT_COUNT = 6
/** Stable plot id for Lab strip seeds (appearance uses unit index + dist-to-center only). */
export const LAB_STRIP_PLOT_ID = 17

/** Lab strip / viewer — same shared rule as city HousingDetailLayer. */
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

export function defaultLabDraft(id: BuildingFormId = 'row'): BuildingTypeParams {
  return cloneBuildingType(BUILDING_TYPE_DEFAULTS[id])
}

export function draftFromLiveTable(id: BuildingFormId = 'row'): BuildingTypeParams {
  return cloneBuildingType(getBuildingType(id))
}

export function defaultLabPreview(draft: BuildingTypeParams): LabPreview {
  return previewFromLotPosition(draft, 0)
}

export function previewFromLotPosition(
  draft: BuildingTypeParams,
  lotPosition: number,
): LabPreview {
  const v = labVariantAt(draft, lotPosition)
  return {
    stories: v.stories,
    doorSide: v.doorSide,
    doorColorIndex: v.doorColorIndex,
    windows: v.windows,
    corner: v.corner,
    chimneySide: v.chimneySide,
    lotPosition: Math.max(0, Math.min(LAB_VARIANT_COUNT - 1, Math.floor(lotPosition))),
    roof: v.roof,
    wallHex: v.wallHex,
  }
}

/** Draft + wall tone for Lab mesh (roof kind stays Mixed/Gable/Flat from draft). */
export function labBuildParams(
  draft: BuildingTypeParams,
  preview: LabPreview,
): BuildingTypeParams {
  return {
    ...draft,
    colors: { ...draft.colors, wall: preview.wallHex },
  }
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
  let windows = preview.windows
  if (windows === 'bay' && !draft.windows.bayAllowed) windows = 'even'
  return {
    stories,
    roof: preview.roof,
    doorSide: preview.doorSide,
    doorColorIndex: preview.doorColorIndex,
    windows,
    corner: preview.corner,
    chimneySide: preview.chimneySide,
    roofStep: 0,
    wallHex: preview.wallHex,
  }
}

export function draftHasChanges(
  draft: BuildingTypeParams,
  id: BuildingFormId = 'row',
): boolean {
  return buildingTypeFingerprint(draft) !== buildingTypeFingerprint(getBuildingType(id))
}

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

export function labThumbCameraPose(
  width: number,
  depth: number,
  storyHeight: number,
  storyMax: number,
): { position: [number, number, number]; lookAt: [number, number, number]; fov: number } {
  const h = storyHeight * Math.max(2, storyMax)
  const span = Math.max(h, depth, width)
  const fov = 36
  const vFov = (fov * Math.PI) / 180
  const fill = 0.78
  const dist = span / (2 * Math.tan(vFov * 0.5) * fill)
  const yaw = 0.52
  const lookY = h * 0.42
  return {
    fov,
    lookAt: [0, lookY, 0],
    position: [Math.sin(yaw) * dist, lookY + span * 0.18, Math.cos(yaw) * dist],
  }
}
