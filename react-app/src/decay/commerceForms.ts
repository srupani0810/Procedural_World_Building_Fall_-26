/**
 * DECAY commerce low-rise — corner shop + main-street block.
 * Parts kit, Before colors. No department store / bank / tower yet.
 * No Math.random.
 */

import { BufferGeometry } from 'three'
import type { BuildingInstance } from './buildings.ts'
import { getBuildingType } from './buildingTypeTable.ts'
import { COMMERCE_BEFORE } from './commercePalette.ts'
import { storiesFromField } from './formHeight.ts'
import {
  COM_FLUSH,
  comAwning,
  comBaseBand,
  comCornerEntrance45,
  comCorniceRoof,
  comShopfrontPanes,
  comSignBand,
  comStoneBand,
  comUpperWindow,
  comWallMass,
  mergeComParts,
  pickIndex,
} from './commerceParts.ts'

export type CommerceKind = 'cornerShop' | 'mainBlock'

export type CommerceCounts = Record<CommerceKind, number>

export const emptyCommerceCounts = (): CommerceCounts => ({
  cornerShop: 0,
  mainBlock: 0,
})

export type CommerceVariant = {
  kind: CommerceKind
  /** Total mass height in H (stories field / scale.y). */
  heightH: number
  /** Floors for main block (3|4) or corner (1|2). */
  floors: number
  brickToneIndex: number
  awningToneIndex: number
}

/**
 * Corner plot → corner shop (1–2). Else → main-street block (2–4).
 * Floors from Height field (soft edge taper); brick/awning by plot id.
 */
export function commerceVariantFromSeed(
  plotId: number,
  rim: number,
  corner: boolean,
  heightField: number,
): CommerceVariant {
  const seed = plotId * 29 + Math.floor(rim * 80)
  const typeId = corner ? 'cornerShop' : 'mainBlock'
  const t = getBuildingType(typeId)
  const brickToneIndex = pickIndex(seed + 3, t.colors.wallTones.length)
  const awningToneIndex = pickIndex(
    seed + 7,
    Math.max(1, t.colors.awningTones.length),
  )
  if (corner) {
    const floors = storiesFromField(
      { min: t.size.storyMin, max: t.size.storyMax },
      heightField,
    )
    return {
      kind: 'cornerShop',
      heightH: floors,
      floors,
      brickToneIndex,
      awningToneIndex,
    }
  }

  const floors = storiesFromField(
    { min: t.size.storyMin, max: t.size.storyMax },
    heightField,
  )
  // Ground floor reads 1.3H when floors ≥ 2; single-story block stays 1H.
  const heightH = floors <= 1 ? 1 : 1.3 + (floors - 1)
  return {
    kind: 'mainBlock',
    heightH,
    floors,
    brickToneIndex,
    awningToneIndex,
  }
}

export function commerceArchetypeKey(v: CommerceVariant): string {
  return [
    'com',
    v.kind,
    `f${v.floors}`,
    `b${v.brickToneIndex}`,
    `a${v.awningToneIndex}`,
  ].join('|')
}

/** Rebuild variant from a massed instance (colors by plot id; floors from height). */
export function commerceVariantFromInstance(
  plotId: number,
  kind: CommerceKind,
  _heightH: number,
  rim: number,
  heightField = 0.5,
): CommerceVariant {
  return commerceVariantFromSeed(plotId, rim, kind === 'cornerShop', heightField)
}

function buildCornerShop(v: CommerceVariant): BufferGeometry {
  const parts: BufferGeometry[] = []
  const t = getBuildingType('cornerShop')
  const brick = t.colors.wallTones[v.brickToneIndex] ?? t.colors.wall
  const awning =
    t.colors.awningTones[v.awningToneIndex] ?? t.colors.awningTones[0] ?? brick
  const top = v.heightH
  const doorHex =
    t.colors.doorTones[
      pickIndex(v.brickToneIndex + 11, Math.max(1, t.colors.doorTones.length))
    ] ?? awning

  parts.push(comWallMass(0.3, top, brick))
  parts.push(comBaseBand(COMMERCE_BEFORE.base))
  // Shopfront wraps −Z and −X toward the 45° corner.
  const cols = Math.max(1, t.windows.columns)
  const paneH = Math.min(t.windows.sizeH || 0.55, top - 0.38)
  const paneY = 0.3 + paneH * 0.5 + COM_FLUSH
  parts.push(...comShopfrontPanes('front', paneY, paneH, cols))
  parts.push(...comShopfrontPanes('side', paneY, paneH, cols))
  parts.push(...comCornerEntrance45(doorHex, paneH + 0.1))
  const awningY = 0.3 + paneH + 0.08
  if (t.entrance.awning) {
    parts.push(comAwning('front', awningY, awning, 0.72))
    parts.push(comAwning('side', awningY, awning, 0.72))
  }
  parts.push(comSignBand('front', awningY + 0.12, 0.8))
  parts.push(comSignBand('side', awningY + 0.12, 0.8))
  if (t.roof.kind === 'flatCornice') parts.push(...comCorniceRoof(top))
  return mergeComParts(parts)
}

function buildMainBlock(v: CommerceVariant): BufferGeometry {
  const parts: BufferGeometry[] = []
  const t = getBuildingType('mainBlock')
  const brick = t.colors.wallTones[v.brickToneIndex] ?? t.colors.wall
  const awning =
    t.colors.awningTones[v.awningToneIndex] ?? t.colors.awningTones[0] ?? brick
  const groundTop = 1.3
  const top = v.heightH

  parts.push(comWallMass(0, groundTop, brick))
  parts.push(comBaseBand(COMMERCE_BEFORE.base))
  // Ground shopfronts + awnings
  const paneH = 0.7
  const paneY = 0.3 + paneH * 0.5
  const groundCols = Math.max(1, t.windows.columns)
  parts.push(...comShopfrontPanes('front', paneY, paneH, groundCols))
  if (t.entrance.awning) {
    parts.push(comAwning('front', groundTop - 0.22, awning, 0.88))
  }
  parts.push(comSignBand('front', groundTop - 0.08, 0.92))
  parts.push(comStoneBand(groundTop + 0.04))

  // Upper brick mass
  parts.push(comWallMass(groundTop + 0.08, top, brick, 0))
  // Even grid of tall windows with lintels
  const upperFloors = v.floors - 1
  const cols = [-0.32, -0.1, 0.1, 0.32]
  for (let f = 0; f < upperFloors; f++) {
    const y = groundTop + 0.55 + f * 1.0
    for (const x of cols) parts.push(...comUpperWindow(x, y))
  }

  if (t.roof.kind === 'flatCornice') parts.push(...comCorniceRoof(top))
  return mergeComParts(parts)
}

export function buildCommerceGeometry(v: CommerceVariant): BufferGeometry {
  if (v.kind === 'cornerShop') return buildCornerShop(v)
  return buildMainBlock(v)
}

const geoCache = new Map<string, BufferGeometry>()

export function commerceGeometryCached(v: CommerceVariant): BufferGeometry {
  const key = commerceArchetypeKey(v)
  let g = geoCache.get(key)
  if (!g) {
    g = buildCommerceGeometry(v)
    geoCache.set(key, g)
  }
  return g
}

/** Massing for low-rise commerce — Height field → form range (+ soft edge taper). */
export function massCommerce(
  inst: BuildingInstance,
  rule: string,
  halfExtent: number,
  corner: boolean,
): BuildingInstance[] {
  const rim = Math.min(1, Math.hypot(inst.x, inst.z) / Math.max(1, halfExtent))
  const variant = commerceVariantFromSeed(
    inst.plotId,
    rim,
    corner,
    inst.heightField,
  )
  const t = getBuildingType(variant.kind)
  const width = Math.max(t.size.minWidth, inst.width * t.size.widthMult)
  const depth = Math.max(t.size.minDepth, inst.depth * t.size.depthMult)
  return [
    {
      ...inst,
      foundations: [...inst.foundations],
      width,
      depth,
      stories: variant.heightH,
      landUse: 'commerce',
      landUseRule: `${rule}·${variant.kind}`,
      commerceKind: variant.kind,
      housingCorner: corner,
      part: 'shell',
    },
  ]
}

export function assignCommerceKinds(
  sites: { plotId: number; corner: boolean }[],
): { byId: Map<number, CommerceKind>; counts: CommerceCounts; summary: string } {
  const byId = new Map<number, CommerceKind>()
  const counts = emptyCommerceCounts()
  for (const s of sites) {
    const kind: CommerceKind = s.corner ? 'cornerShop' : 'mainBlock'
    byId.set(s.plotId, kind)
    counts[kind] += 1
  }
  const summary = [
    `[commerce] cornerShop ${counts.cornerShop} (corner plots)`,
    `mainBlock ${counts.mainBlock} (main-road)`,
    `· low-rise only · n=${sites.length}`,
  ].join(' · ')
  return { byId, counts, summary }
}
