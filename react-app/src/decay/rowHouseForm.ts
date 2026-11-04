/**
 * DECAY row house — parts kit merged into one mesh per archetype.
 * Unit footprint space; instance scales to plot width / depth / story height.
 * Variation from block position only (no Math.random).
 * Optional `params` overrides the shared table (Lab draft); city omits it.
 */

import { BufferGeometry } from 'three'
import {
  getBuildingType,
  type BuildingTypeParams,
  type WindowLayoutId,
} from './buildingTypeTable.ts'
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
export type RowWindowLayout = WindowLayoutId

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

function typeOr(params?: BuildingTypeParams): BuildingTypeParams {
  return params ?? getBuildingType('row')
}

/** Deterministic variant from plot / unit index along the block (table variation rule). */
export function rowVariantFromSeed(
  plotId: number,
  unitIndex: number,
  unitCount: number,
  baseStories: number,
  isCornerPlot: boolean,
  params?: BuildingTypeParams,
): RowVariant {
  const t = typeOr(params)
  const seed = plotId * 17 + unitIndex * 31
  const end = unitIndex === 0 || unitIndex === unitCount - 1
  const corner = isCornerPlot || end
  // Height field already chose story band; clamp to table range.
  const stories = (
    baseStories >= t.size.storyMax
      ? t.size.storyMax
      : baseStories >= 3
        ? 3
        : t.size.storyMin
  ) as 2 | 3 | 4
  const roofStep: 0 | 1 = 0
  const roof: RowRoof =
    t.roof.kind === 'gable'
      ? 'gable'
      : t.roof.kind === 'flatCornice'
        ? 'flat'
        : pickIndex(seed + 5, 2) === 0
          ? 'gable'
          : 'flat'
  const doorSide: -1 | 1 = pickIndex(seed + 7, 2) === 0 ? -1 : 1
  const doorColorIndex = pickIndex(
    seed + 11,
    Math.max(1, t.colors.doorTones.length),
  )
  const layouts = t.windows.layouts.length > 0 ? t.windows.layouts : (['even'] as const)
  let windows = layouts[pickIndex(seed + 13, layouts.length)]! as RowWindowLayout
  if (windows === 'bay' && !t.windows.bayAllowed) windows = 'even'
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

export function rowArchetypeKey(v: RowVariant, params?: BuildingTypeParams): string {
  const t = typeOr(params)
  return [
    'row',
    `s${v.stories}`,
    v.roof,
    `d${v.doorSide < 0 ? 'L' : 'R'}`,
    `c${v.doorColorIndex}`,
    v.windows,
    `ch${v.chimneySide < 0 ? 'L' : 'R'}`,
    v.corner ? 'corner' : 'mid',
    // Lab draft fingerprint so cached geos don't stick across edits.
    params
      ? [
          t.roof.kind,
          t.roof.pitch,
          t.roof.overhang,
          t.roof.parapetHeight,
          t.windows.columns,
          t.windows.rows,
          t.windows.sizeW,
          t.windows.sizeH,
          t.windows.frameDepth,
          t.windows.sillDepth,
          t.windows.lintel ? 1 : 0,
          t.windows.bayAllowed ? 1 : 0,
          t.entrance.stoopSteps,
          t.entrance.chimneyCount,
          t.entrance.porchRoof ? 1 : 0,
          t.entrance.doorOffset,
          t.colors.wall,
          t.colors.trim,
          t.colors.roof,
        ].join(':')
      : 'city',
  ].join('|')
}

function frontWindows(
  v: RowVariant,
  stories: number,
  t: BuildingTypeParams,
): BufferGeometry[] {
  const out: BufferGeometry[] = []
  const doorX = v.doorSide * t.entrance.doorOffset
  const cols = Math.max(1, Math.min(4, Math.floor(t.windows.columns)))
  const winOpts = {
    trimHex: t.colors.trim,
    frameDepth: t.windows.frameDepth,
    sillDepth: t.windows.sillDepth,
    lintel: t.windows.lintel,
  }
  const w = t.windows.sizeW > 0 ? t.windows.sizeW : 0.14
  const h = t.windows.sizeH > 0 ? t.windows.sizeH : 0.22
  const xsFor = (n: number): number[] => {
    if (n <= 1) return [0]
    if (n === 2) return [-0.28, 0.28]
    if (n === 3) return [-0.32, 0, 0.32]
    return [-0.34, -0.12, 0.12, 0.34]
  }
  // City: rows default tracks stories. Lab can lower rows without shrinking mass.
  const rowBands =
    t.windows.rows > 0 ? Math.min(stories, Math.max(1, Math.floor(t.windows.rows))) : stories
  for (let s = 1; s <= rowBands; s++) {
    const y = s - 0.45
    if (v.windows === 'bay' && s === 1 && t.windows.bayAllowed) {
      out.push(...partBayWindow(-doorX * 0.8, y))
      out.push(...partWindow(doorX * 0.15, y, w, h, winOpts))
      continue
    }
    if (v.windows === 'paired') {
      out.push(...partWindow(-0.28, y, w, h, winOpts))
      out.push(...partWindow(0.28, y, w, h, winOpts))
      continue
    }
    // even grid: skip door column on ground
    if (s === 1) {
      out.push(...partWindow(-doorX * 0.85, y, w, h, winOpts))
    } else {
      for (const x of xsFor(cols)) {
        out.push(...partWindow(x, y, w, h, winOpts))
      }
    }
  }
  return out
}

/** Build merged row-house geometry in unit space. */
export function buildRowHouseGeometry(
  v: RowVariant,
  params?: BuildingTypeParams,
): BufferGeometry {
  const parts: BufferGeometry[] = []
  const t = typeOr(params)
  const stories = v.stories
  const doorX = v.doorSide * t.entrance.doorOffset
  const doorHex = t.colors.doorTones[v.doorColorIndex] ?? t.colors.doorTones[0]!

  parts.push(partWallMass(stories, t.colors.wall))
  if (v.roof === 'gable') {
    parts.push(
      ...partPitchedGable(
        stories,
        t.roof.overhang,
        t.colors.roof,
        t.colors.wall,
        t.roof.pitch > 0 ? t.roof.pitch + 0.07 : 0.42,
      ),
    )
  } else {
    parts.push(
      ...partFlatRoofCornice(
        stories,
        t.roof.parapetHeight,
        t.colors.trim,
        t.colors.trim,
      ),
    )
  }

  const chimneys = Math.max(0, Math.min(2, Math.floor(t.entrance.chimneyCount)))
  if (chimneys >= 1) parts.push(partChimney(stories, v.chimneySide))
  if (chimneys >= 2) parts.push(partChimney(stories, (v.chimneySide * -1) as -1 | 1))

  if (t.entrance.stoopSteps > 0) {
    parts.push(...partStoop(doorX, t.entrance.stoopSteps))
  }
  parts.push(...partDoorWithTransom(doorX, doorHex, t.colors.trim))
  if (t.entrance.porchRoof) parts.push(partPorchRoof(doorX, t.colors.roof))
  if (t.windows.implemented) parts.push(...frontWindows(v, stories, t))
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

export function rowHouseGeometryCached(
  v: RowVariant,
  params?: BuildingTypeParams,
): BufferGeometry {
  const key = rowArchetypeKey(v, params)
  let g = geoCache.get(key)
  if (!g) {
    g = buildRowHouseGeometry(v, params)
    geoCache.set(key, g)
  }
  return g
}

/** Lab: always fresh geometry from draft (no shared city cache pollution). */
export function buildLabRowHouseGeometry(
  v: RowVariant,
  params: BuildingTypeParams,
): BufferGeometry {
  return buildRowHouseGeometry(v, params)
}
