/**
 * DECAY row house — parts kit + shared block variation rule.
 * Lab strip and city HousingDetailLayer both call rowVariantFromSeed.
 * No Math.random.
 */

import { BufferGeometry } from 'three'
import {
  getBuildingType,
  type BuildingTypeParams,
  type WindowLayoutId,
} from './buildingTypeTable.ts'
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
export type RowWindowLayout = WindowLayoutId

/** Before palette brick / body tones (red-brown, tan, cream). */
export const ROW_BRICK_TONES: readonly string[] = [
  HOUSE_BEFORE.brick,
  HOUSE_BEFORE.walkupBodies[0]!,
  HOUSE_BEFORE.walkupBodies[1]!,
  HOUSE_BEFORE.walkupBodies[3]!,
  HOUSE_BEFORE.plaster,
  HOUSE_BEFORE.walkupBodies[2]!,
]

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
  /** Wall / brick tone from Before palette. */
  wallHex: string
}

function typeOr(params?: BuildingTypeParams): BuildingTypeParams {
  return params ?? getBuildingType('row')
}

/**
 * Shared row variation — Lab and city.
 * Inputs: unit index along the block + distance to block center.
 * Roof: gable / flatCornice lock; gableOrFlat (Mixed) picks by position.
 * Stories follow the height-field band (baseStories), clamped to the table.
 */
export function rowVariantFromSeed(
  _plotId: number,
  unitIndex: number,
  unitCount: number,
  baseStories: number,
  isCornerPlot: boolean,
  params?: BuildingTypeParams,
): RowVariant {
  const t = typeOr(params)
  const n = Math.max(1, unitCount)
  const i = Math.max(0, Math.min(n - 1, unitIndex))
  const along = n <= 1 ? 0 : i / (n - 1)
  /** 0 at block mid, 1 at either end. */
  const distToCenter = Math.abs(along - 0.5) * 2
  const seed = i * 17 + Math.floor(distToCenter * 10) * 3
  const end = i === 0 || i === n - 1
  const corner = isCornerPlot || end

  const stories = (
    baseStories >= t.size.storyMax
      ? t.size.storyMax
      : baseStories >= 3
        ? 3
        : t.size.storyMin
  ) as 2 | 3 | 4

  let roof: RowRoof
  if (t.roof.kind === 'gable') {
    roof = 'gable'
  } else if (t.roof.kind === 'flatCornice') {
    roof = 'flat'
  } else {
    // Mixed (gableOrFlat): ends prefer gable, mid prefers flat; seed still flips.
    const roofBias = distToCenter >= 0.6 ? 0 : 1
    roof = pickIndex(seed + 5 + roofBias, 2) === 0 ? 'gable' : 'flat'
  }

  const doorSide: -1 | 1 = pickIndex(seed + 7, 2) === 0 ? -1 : 1
  const doorN = Math.max(1, t.colors.doorTones.length)
  const doorColorIndex = pickIndex(seed + 11, doorN)

  const layouts = t.windows.layouts.length > 0 ? t.windows.layouts : (['even'] as const)
  let windows = layouts[pickIndex(seed + 13, layouts.length)]! as RowWindowLayout
  if (windows === 'bay' && !t.windows.bayAllowed) windows = 'even'

  const chimneySide: -1 | 1 = i === 0 ? 1 : i === n - 1 ? -1 : doorSide

  const tones =
    t.colors.wallTones.length > 1 ? t.colors.wallTones : ROW_BRICK_TONES
  const wallHex =
    tones[pickIndex(seed + 19 + Math.floor(distToCenter * 5), tones.length)] ??
    ROW_BRICK_TONES[0]!

  return {
    stories,
    roof,
    doorSide,
    doorColorIndex,
    windows,
    corner,
    chimneySide,
    roofStep: 0,
    wallHex,
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
    v.wallHex,
    // Form-param fingerprint so Lab draft / Apply rebuilds correctly.
    [
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
      t.colors.trim,
      t.colors.roof,
    ].join(':'),
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
  const wallHex = v.wallHex || t.colors.wall

  parts.push(partWallMass(stories, wallHex))
  if (v.roof === 'gable') {
    parts.push(
      ...partPitchedGable(
        stories,
        t.roof.overhang,
        t.colors.roof,
        wallHex,
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
  parts.push(partBackExtension(wallHex))
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

/** Clear city/Lab shared row cache after Lab Apply so meshes rebuild from the table. */
export function clearRowHouseGeoCache(): void {
  for (const g of geoCache.values()) g.dispose()
  geoCache.clear()
}
