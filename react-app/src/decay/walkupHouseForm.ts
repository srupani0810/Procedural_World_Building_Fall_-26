/**
 * DECAY walk-up apartment — parts kit merged into one mesh per archetype.
 * 4–5 stories, flat roof, centered entrance. Variation by plot id + rim.
 * Does not touch row-house forms. No Math.random.
 */

import { BufferGeometry } from 'three'
import { getBuildingType } from './buildingTypeTable.ts'
import { HOUSE_BEFORE } from './housePalette.ts'
import {
  mergeParts,
  partBaseBand,
  partBayWindow,
  partChimney,
  partDoorWithTransom,
  partEntranceCanopy,
  partFlatRoofCornice,
  partSideDoor,
  partSideWindow,
  partStairBulkhead,
  partStoop,
  partWallMass,
  partWindow,
  pickIndex,
} from './houseParts.ts'

export type WalkupVariant = {
  stories: 4 | 5 | 6
  bodyToneIndex: number
  doorColorIndex: number
  /** Stacked bay windows on the front. */
  hasBay: boolean
  /** Chimney on roof. */
  hasChimney: boolean
  corner: boolean
  /** Side for corner openings. */
  cornerSide: -1 | 1
}

/**
 * Deterministic walk-up variant.
 * Stories / bay lean taller and more bays toward the center (low rim).
 * Position along the block = plotId; distance to center = rim.
 */
export function walkupVariantFromSeed(
  plotId: number,
  rim: number,
  corner: boolean,
  baseStories: number,
): WalkupVariant {
  const t = getBuildingType('walkup')
  const seed = plotId * 19 + Math.floor(rim * 100)
  // Prefer massing stories from Height field, clamped to table.
  const stories = (
    baseStories >= t.size.storyMax
      ? t.size.storyMax
      : baseStories >= 5
        ? 5
        : t.size.storyMin
  ) as 4 | 5 | 6
  const bodyToneIndex = pickIndex(
    seed + 3,
    Math.max(1, t.colors.wallTones.length),
  )
  const doorColorIndex = pickIndex(
    seed + 7,
    Math.max(1, t.colors.doorTones.length),
  )
  // Bays by plot position + more common near center (distanceToCenter + block).
  const bayChance = rim < 0.35 ? 2 : rim < 0.5 ? 3 : 5
  const hasBay =
    t.windows.bayAllowed &&
    pickIndex(seed + 11 + (plotId % 5), bayChance) === 0
  const hasChimney =
    t.entrance.chimneyCount > 0 && pickIndex(seed + 13, 3) !== 0
  const cornerSide: -1 | 1 = pickIndex(seed + 17, 2) === 0 ? -1 : 1
  return {
    stories,
    bodyToneIndex,
    doorColorIndex,
    hasBay,
    hasChimney,
    corner,
    cornerSide,
  }
}

export function walkupArchetypeKey(v: WalkupVariant): string {
  return [
    'walkup',
    `s${v.stories}`,
    `b${v.bodyToneIndex}`,
    `d${v.doorColorIndex}`,
    v.hasBay ? 'bay' : 'flat',
    v.hasChimney ? 'ch' : 'noch',
    v.corner ? `corner${v.cornerSide < 0 ? 'L' : 'R'}` : 'mid',
  ].join('|')
}

function evenWindowGrid(stories: number, hasBay: boolean): BufferGeometry[] {
  const out: BufferGeometry[] = []
  const cols = [-0.32, 0, 0.32]
  const bayCol = cols[0]!
  for (let s = 1; s <= stories; s++) {
    const y = s - 0.42
    // Ground floor: skip center for door.
    if (s === 1) {
      out.push(...partWindow(cols[0]!, y))
      out.push(...partWindow(cols[2]!, y))
      if (hasBay) out.push(...partBayWindow(bayCol, y + 0.05))
      continue
    }
    // Stacked bay column on upper floors when selected.
    if (hasBay) {
      out.push(...partBayWindow(bayCol, y))
      out.push(...partWindow(cols[1]!, y))
      out.push(...partWindow(cols[2]!, y))
      continue
    }
    for (const x of cols) out.push(...partWindow(x, y))
  }
  return out
}

/** Build merged walk-up geometry in unit space. */
export function buildWalkupHouseGeometry(v: WalkupVariant): BufferGeometry {
  const parts: BufferGeometry[] = []
  const t = getBuildingType('walkup')
  const stories = v.stories
  const body = t.colors.wallTones[v.bodyToneIndex] ?? t.colors.wall
  const doorHex = t.colors.doorTones[v.doorColorIndex] ?? t.colors.doorTones[0]!

  parts.push(partWallMass(stories, body))
  parts.push(partBaseBand(HOUSE_BEFORE.stone))
  if (t.roof.kind === 'flatCornice') parts.push(...partFlatRoofCornice(stories))
  parts.push(...partStairBulkhead(stories))
  if (v.hasChimney) parts.push(partChimney(stories, 1))

  // Centered entrance on the street (−Z).
  if (t.entrance.stoopSteps > 0) parts.push(...partStoop(t.entrance.doorOffset))
  parts.push(...partDoorWithTransom(t.entrance.doorOffset, doorHex))
  parts.push(partEntranceCanopy())

  if (t.windows.implemented) parts.push(...evenWindowGrid(stories, v.hasBay))

  if (v.corner) {
    const side = v.cornerSide
    parts.push(...partSideDoor(side, doorHex))
    for (let s = 1; s <= stories; s++) {
      parts.push(...partSideWindow(side, s - 0.4, -0.2))
      parts.push(...partSideWindow(side, s - 0.4, 0.15))
    }
  }

  return mergeParts(parts)
}

const geoCache = new Map<string, BufferGeometry>()

export function walkupHouseGeometryCached(v: WalkupVariant): BufferGeometry {
  const key = walkupArchetypeKey(v)
  let g = geoCache.get(key)
  if (!g) {
    g = buildWalkupHouseGeometry(v)
    geoCache.set(key, g)
  }
  return g
}
