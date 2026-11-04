/**
 * DECAY row house — parts kit merged into one mesh per archetype.
 * Unit footprint space; instance scales to plot width / depth / story height.
 * Variation from block position only (no Math.random).
 */

import { BufferGeometry } from 'three'
import { HOUSE_BEFORE } from './housePalette.ts'
import {
  mergeParts,
  partBackExtension,
  partBayWindow,
  partChimney,
  partDoorWithTransom,
  partFlatRoofCornice,
  partLowFence,
  partPitchedGable,
  partPorchRoof,
  partSideDoor,
  partSideWindow,
  partStoop,
  partWallMass,
  partWindow,
  pickIndex,
} from './houseParts.ts'

export type RowRoof = 'gable' | 'flat'
export type RowWindowLayout = 'even' | 'paired' | 'bay'

export type RowVariant = {
  stories: 2 | 3 | 4
  roof: RowRoof
  /** Door offset sign on front: −1 left, +1 right (off-center). */
  doorSide: -1 | 1
  doorColorIndex: number
  windows: RowWindowLayout
  corner: boolean
  /** Chimney on shared wall: −1 / +1. */
  chimneySide: -1 | 1
  /** Roofline step in stories relative to a 2-story base (0 or 1). */
  roofStep: 0 | 1
}

/** Deterministic variant from plot / unit index along the block. */
export function rowVariantFromSeed(
  plotId: number,
  unitIndex: number,
  unitCount: number,
  baseStories: number,
  isCornerPlot: boolean,
): RowVariant {
  const seed = plotId * 17 + unitIndex * 31
  const end = unitIndex === 0 || unitIndex === unitCount - 1
  const corner = isCornerPlot || end
  // Height field already chose 2–4; keep unit on that band.
  const stories = (
    baseStories >= 4 ? 4 : baseStories >= 3 ? 3 : 2
  ) as 2 | 3 | 4
  const roofStep: 0 | 1 = 0
  const roof: RowRoof = pickIndex(seed + 5, 2) === 0 ? 'gable' : 'flat'
  const doorSide: -1 | 1 = pickIndex(seed + 7, 2) === 0 ? -1 : 1
  const doorColorIndex = pickIndex(seed + 11, HOUSE_BEFORE.doors.length)
  const windows = (['even', 'paired', 'bay'] as const)[pickIndex(seed + 13, 3)]!
  const chimneySide: -1 | 1 =
    unitIndex === 0 ? 1 : unitIndex === unitCount - 1 ? -1 : doorSide
  return {
    stories,
    roof,
    doorSide,
    doorColorIndex,
    windows,
    corner,
    chimneySide,
    roofStep,
  }
}

export function rowArchetypeKey(v: RowVariant): string {
  return [
    'row',
    `s${v.stories}`,
    v.roof,
    `d${v.doorSide < 0 ? 'L' : 'R'}`,
    `c${v.doorColorIndex}`,
    v.windows,
    `ch${v.chimneySide < 0 ? 'L' : 'R'}`,
    v.corner ? 'corner' : 'mid',
  ].join('|')
}

function frontWindows(v: RowVariant, stories: number): BufferGeometry[] {
  const out: BufferGeometry[] = []
  const doorX = v.doorSide * 0.22
  for (let s = 1; s <= stories; s++) {
    const y = s - 0.45
    if (v.windows === 'bay' && s === 1) {
      out.push(...partBayWindow(-doorX * 0.8, y))
      out.push(...partWindow(doorX * 0.15, y))
      continue
    }
    if (v.windows === 'paired') {
      out.push(...partWindow(-0.28, y))
      out.push(...partWindow(0.28, y))
      continue
    }
    // even grid: skip door column on ground
    if (s === 1) {
      out.push(...partWindow(-doorX * 0.85, y))
    } else {
      out.push(...partWindow(-0.28, y))
      out.push(...partWindow(0.28, y))
    }
  }
  return out
}

/** Build merged row-house geometry in unit space. */
export function buildRowHouseGeometry(v: RowVariant): BufferGeometry {
  const parts: BufferGeometry[] = []
  const stories = v.stories
  const doorX = v.doorSide * 0.22
  const doorHex = HOUSE_BEFORE.doors[v.doorColorIndex]!

  parts.push(partWallMass(stories, HOUSE_BEFORE.brick))
  if (v.roof === 'gable') parts.push(...partPitchedGable(stories))
  else parts.push(...partFlatRoofCornice(stories))

  parts.push(partChimney(stories, v.chimneySide))
  parts.push(...partStoop(doorX))
  parts.push(...partDoorWithTransom(doorX, doorHex))
  parts.push(partPorchRoof(doorX))
  parts.push(...frontWindows(v, stories))
  parts.push(partBackExtension())
  parts.push(partLowFence())

  if (v.corner) {
    parts.push(...partSideDoor(v.doorSide, doorHex))
    for (let s = 1; s <= stories; s++) {
      parts.push(...partSideWindow(v.doorSide, s - 0.4, -0.05))
      parts.push(...partSideWindow(v.doorSide, s - 0.4, 0.25))
    }
  }

  return mergeParts(parts)
}

const geoCache = new Map<string, BufferGeometry>()

export function rowHouseGeometryCached(v: RowVariant): BufferGeometry {
  const key = rowArchetypeKey(v)
  let g = geoCache.get(key)
  if (!g) {
    g = buildRowHouseGeometry(v)
    geoCache.set(key, g)
  }
  return g
}
