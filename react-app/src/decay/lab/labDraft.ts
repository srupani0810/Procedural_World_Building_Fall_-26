/**
 * Building Lab draft state — local only; never writes buildingTypeTable (city).
 */

import {
  BUILDING_TYPE_DEFAULTS,
  cloneBuildingType,
  type BuildingFormId,
  type BuildingTypeParams,
} from '../buildingTypeTable.ts'
import type { RowVariant } from '../rowHouseForm.ts'

export type LabPreview = {
  stories: 2 | 3 | 4
  doorSide: -1 | 1
  doorColorIndex: number
  windows: RowVariant['windows']
  corner: boolean
  chimneySide: -1 | 1
}

export function defaultLabDraft(id: BuildingFormId = 'row'): BuildingTypeParams {
  return cloneBuildingType(BUILDING_TYPE_DEFAULTS[id])
}

export function defaultLabPreview(draft: BuildingTypeParams): LabPreview {
  const stories = (
    draft.size.storyMin >= 4 ? 4 : draft.size.storyMin >= 3 ? 3 : 2
  ) as 2 | 3 | 4
  return {
    stories,
    doorSide: -1,
    doorColorIndex: 0,
    windows: draft.windows.layouts[0] ?? 'even',
    corner: false,
    chimneySide: 1,
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
  const roof: RowVariant['roof'] =
    draft.roof.kind === 'flatCornice'
      ? 'flat'
      : draft.roof.kind === 'gable'
        ? 'gable'
        : 'gable'
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
