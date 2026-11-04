/**
 * DECAY commerce low-rise — corner shop + main-street block.
 * Parts kit, Before colors. No department store / bank / tower yet.
 * No Math.random.
 */

import { BufferGeometry } from 'three'
import type { BuildingInstance } from './buildings.ts'
import { COMMERCE_BEFORE } from './commercePalette.ts'
import { FORM_HEIGHT_RANGES, storiesFromField } from './formHeight.ts'
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
  const brickToneIndex = pickIndex(seed + 3, COMMERCE_BEFORE.bricks.length)
  const awningToneIndex = pickIndex(seed + 7, COMMERCE_BEFORE.awnings.length)
  if (corner) {
    const floors = storiesFromField(FORM_HEIGHT_RANGES.cornerShop, heightField)
    return {
      kind: 'cornerShop',
      heightH: floors,
      floors,
      brickToneIndex,
      awningToneIndex,
    }
  }

  const floors = storiesFromField(FORM_HEIGHT_RANGES.mainBlock, heightField)
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
  heightH: number,
  rim: number,
  heightField = 0.5,
): CommerceVariant {
  return commerceVariantFromSeed(plotId, rim, kind === 'cornerShop', heightField)
}

function buildCornerShop(v: CommerceVariant): BufferGeometry {
  const parts: BufferGeometry[] = []
  const brick = COMMERCE_BEFORE.bricks[v.brickToneIndex]!
  const awning = COMMERCE_BEFORE.awnings[v.awningToneIndex]!
  const top = v.heightH
  const doorHex = COMMERCE_BEFORE.awnings[pickIndex(v.brickToneIndex + 11, COMMERCE_BEFORE.awnings.length)]!

  parts.push(comWallMass(0.3, top, brick))
  parts.push(comBaseBand(COMMERCE_BEFORE.base))
  // Shopfront wraps −Z and −X toward the 45° corner.
  const paneH = Math.min(0.55, top - 0.38)
  const paneY = 0.3 + paneH * 0.5 + COM_FLUSH
  parts.push(...comShopfrontPanes('front', paneY, paneH, 3))
  parts.push(...comShopfrontPanes('side', paneY, paneH, 3))
  parts.push(...comCornerEntrance45(doorHex, paneH + 0.1))
  const awningY = 0.3 + paneH + 0.08
  parts.push(comAwning('front', awningY, awning, 0.72))
  parts.push(comAwning('side', awningY, awning, 0.72))
  parts.push(comSignBand('front', awningY + 0.12, 0.8))
  parts.push(comSignBand('side', awningY + 0.12, 0.8))
  parts.push(...comCorniceRoof(top))
  return mergeComParts(parts)
}

function buildMainBlock(v: CommerceVariant): BufferGeometry {
  const parts: BufferGeometry[] = []
  const brick = COMMERCE_BEFORE.bricks[v.brickToneIndex]!
  const awning = COMMERCE_BEFORE.awnings[v.awningToneIndex]!
  const groundTop = 1.3
  const top = v.heightH

  parts.push(comWallMass(0, groundTop, brick))
  parts.push(comBaseBand(COMMERCE_BEFORE.base))
  // Ground shopfronts + awnings
  const paneH = 0.7
  const paneY = 0.3 + paneH * 0.5
  parts.push(...comShopfrontPanes('front', paneY, paneH, 4))
  parts.push(comAwning('front', groundTop - 0.22, awning, 0.88))
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

  parts.push(...comCorniceRoof(top))
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
  const width = Math.max(4.2, inst.width * 0.95)
  const depth = Math.max(3.6, inst.depth * 0.9)
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
