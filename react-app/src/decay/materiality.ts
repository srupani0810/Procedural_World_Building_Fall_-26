/**
 * DECAY Materiality — materials + wear preview params.
 * Surface leads; geometry late/sparse/capped. No Math.random.
 * Wall tones use the Before palette (one source of truth with Lab Materiality).
 */

import { HOUSE_AFTER, HOUSE_BEFORE } from './housePalette.ts'

export type ShellMaterial =
  | 'brick'
  | 'concrete'
  | 'plaster'
  | 'metal'
  | 'clapboard'

export type MaterialPick = ShellMaterial | 'mixed'

/** How Mixed assigns a shell material per building (shown in the panel). */
export type MixedAssignRule = 'byHeight' | 'byDistance'

export type WearMode = 'scrub' | 'distance'

/** Lab Materiality compare — texture / geometry / both / side-by-side. */
export type CompareMode = 'texture' | 'geometry' | 'both' | 'sideBySide'

export type SurfaceLayer = {
  on: boolean
  strength: number
}

/**
 * Geometry weathering layer — late, local, capped.
 * startWear is never below 2 (brief: structure after surface).
 */
export type GeoLayer = {
  on: boolean
  strength: number
  /** 0…1 ceiling on effect once past startWear. */
  cap: number
  /** Wear level when this layer may begin (≥ 2). */
  startWear: number
}

export type MaterialityParams = {
  material: MaterialPick
  mixedRule: MixedAssignRule
  /** Swatch index into MATERIAL_TONES[kind] (Before palette). */
  toneIndex: Record<ShellMaterial, number>
  /** Global wear scrub 0 (new) → 3 (reclaimed). Used when wearMode = scrub. */
  wear: number
  wearMode: WearMode
  /** Distance mode: world radius where wear reaches 3 (rim first). */
  wearRadius: number
  /** 0 = Before palette, 1 = After palette. */
  era: number
  compareMode: CompareMode
  grime: SurfaceLayer
  rainStreaks: SurfaceLayer
  rust: SurfaceLayer
  /** Paint fade / chalking. */
  chalk: SurfaceLayer
  /** Salt bloom — brick only in the shader. */
  salt: SurfaceLayer
  moss: SurfaceLayer
  /** Geometry — high wear only, one side max, capped. */
  missingPanel: GeoLayer
  debris: GeoLayer
  tarp: GeoLayer
  brokenPanes: GeoLayer
  gutterDamage: GeoLayer
}

export const MATERIAL_LABELS: Record<MaterialPick, string> = {
  brick: 'Brick',
  concrete: 'Concrete',
  plaster: 'Plaster',
  metal: 'Corrugated metal',
  clapboard: 'Painted clapboard',
  mixed: 'Mixed',
}

export const MIXED_RULE_COPY: Record<MixedAssignRule, string> = {
  byHeight:
    'Mixed rule: taller shells (≥ mid story band) → corrugated metal; mid → concrete; shorter → brick; lowest band → plaster.',
  byDistance:
    'Mixed rule: near center → brick / plaster; mid ring → concrete; rim → corrugated metal (distance from origin).',
}

/** Before palette wall / body tones per material kind — no muted alternate set. */
export const MATERIAL_TONES: Record<ShellMaterial, readonly string[]> = {
  brick: [
    HOUSE_BEFORE.brick,
    HOUSE_BEFORE.walkupBodies[0]!,
    HOUSE_BEFORE.walkupBodies[1]!,
    HOUSE_BEFORE.walkupBodies[3]!,
    HOUSE_BEFORE.chimney,
  ],
  concrete: [
    HOUSE_BEFORE.concrete,
    HOUSE_BEFORE.stone,
    HOUSE_BEFORE.parapet,
    HOUSE_BEFORE.stoop,
    '#b0b0b0',
  ],
  plaster: [
    HOUSE_BEFORE.plaster,
    HOUSE_BEFORE.walkupBodies[2]!,
    HOUSE_BEFORE.cornice,
    '#d8d0c4',
    '#cfc6b8',
  ],
  metal: [
    HOUSE_BEFORE.roof,
    '#3a342e',
    '#5a5048',
    '#2a2826',
    HOUSE_BEFORE.fence,
  ],
  /** Flat painted siding tones — clapboard is not default. */
  clapboard: [
    HOUSE_BEFORE.plaster,
    '#d2c4b0',
    '#c4b8a4',
    '#b8a890',
    HOUSE_BEFORE.walkupBodies[2]!,
  ],
}

export const MATERIAL_TONES_AFTER: Record<ShellMaterial, readonly string[]> = {
  brick: [
    HOUSE_AFTER.brick,
    HOUSE_AFTER.walkupBodies[0]!,
    HOUSE_AFTER.walkupBodies[1]!,
    HOUSE_AFTER.walkupBodies[3]!,
    HOUSE_AFTER.chimney,
  ],
  concrete: [
    HOUSE_AFTER.concrete,
    HOUSE_AFTER.stone,
    HOUSE_AFTER.parapet,
    HOUSE_AFTER.stoop,
    '#8a8680',
  ],
  plaster: [
    HOUSE_AFTER.plaster,
    HOUSE_AFTER.walkupBodies[2]!,
    HOUSE_AFTER.cornice,
    '#a89e90',
    '#9a9084',
  ],
  metal: [
    HOUSE_AFTER.roof,
    '#2e2824',
    '#4a443e',
    '#1e1c1a',
    HOUSE_AFTER.fence,
  ],
  clapboard: [
    HOUSE_AFTER.plaster,
    '#a89888',
    '#968878',
    '#8a7c6c',
    HOUSE_AFTER.walkupBodies[2]!,
  ],
}

export function defaultSurface(strength = 0.65): SurfaceLayer {
  return { on: true, strength }
}

export function defaultGeoLayer(
  strength = 0.7,
  cap = 0.85,
  startWear = 2,
): GeoLayer {
  return {
    on: true,
    strength,
    cap: Math.max(0, Math.min(1, cap)),
    startWear: Math.max(2, startWear),
  }
}

export function createDefaultMateriality(): MaterialityParams {
  return {
    material: 'brick',
    mixedRule: 'byHeight',
    toneIndex: {
      brick: 0,
      concrete: 0,
      plaster: 0,
      metal: 0,
      clapboard: 0,
    },
    wear: 0,
    wearMode: 'scrub',
    wearRadius: 220,
    era: 0,
    compareMode: 'both',
    grime: defaultSurface(0.7),
    rainStreaks: defaultSurface(0.55),
    rust: defaultSurface(0.6),
    chalk: defaultSurface(0.65),
    salt: defaultSurface(0.5),
    moss: defaultSurface(0.45),
    missingPanel: defaultGeoLayer(0.85, 0.9, 2),
    debris: defaultGeoLayer(0.7, 0.8, 2.15),
    tarp: defaultGeoLayer(0.65, 0.75, 2.25),
    brokenPanes: defaultGeoLayer(0.7, 0.85, 2),
    gutterDamage: defaultGeoLayer(0.55, 0.7, 2),
  }
}

/** Clone for Lab draft — no shared refs. */
export function cloneMateriality(m: MaterialityParams): MaterialityParams {
  return {
    ...m,
    toneIndex: { ...m.toneIndex },
    grime: { ...m.grime },
    rainStreaks: { ...m.rainStreaks },
    rust: { ...m.rust },
    chalk: { ...m.chalk },
    salt: { ...m.salt },
    moss: { ...m.moss },
    missingPanel: { ...m.missingPanel },
    debris: { ...m.debris },
    tarp: { ...m.tarp },
    brokenPanes: { ...m.brokenPanes },
    gutterDamage: { ...m.gutterDamage },
  }
}

export function materialityFingerprint(m: MaterialityParams): string {
  return [
    m.material,
    m.mixedRule,
    m.wear,
    m.wearMode,
    m.wearRadius,
    m.era,
    m.compareMode,
    Object.entries(m.toneIndex)
      .map(([k, v]) => `${k}:${v}`)
      .join(','),
    layerFp('g', m.grime),
    layerFp('r', m.rainStreaks),
    layerFp('u', m.rust),
    layerFp('c', m.chalk),
    layerFp('s', m.salt),
    layerFp('m', m.moss),
    geoFp('mp', m.missingPanel),
    geoFp('db', m.debris),
    geoFp('tp', m.tarp),
    geoFp('bp', m.brokenPanes),
    geoFp('gd', m.gutterDamage),
  ].join('|')
}

function layerFp(tag: string, l: SurfaceLayer) {
  return `${tag}:${l.on ? 1 : 0}:${l.strength.toFixed(3)}`
}

function geoFp(tag: string, l: GeoLayer) {
  return `${tag}:${l.on ? 1 : 0}:${l.strength.toFixed(3)}:${l.cap.toFixed(3)}:${l.startWear.toFixed(3)}`
}

/** Reset surface + geometry toggles for one material’s tone row context. */
export function resetMaterialSettings(
  current: MaterialityParams,
  kind: ShellMaterial,
): MaterialityParams {
  const base = createDefaultMateriality()
  return {
    ...current,
    toneIndex: { ...current.toneIndex, [kind]: 0 },
    grime: { ...base.grime },
    rainStreaks: { ...base.rainStreaks },
    rust: { ...base.rust },
    chalk: { ...base.chalk },
    salt: { ...base.salt },
    moss: { ...base.moss },
    missingPanel: { ...base.missingPanel },
    debris: { ...base.debris },
    tarp: { ...base.tarp },
    brokenPanes: { ...base.brokenPanes },
    gutterDamage: { ...base.gutterDamage },
    era: base.era,
    compareMode: base.compareMode,
  }
}

export function materialId(kind: ShellMaterial): number {
  if (kind === 'brick') return 0
  if (kind === 'concrete') return 1
  if (kind === 'plaster') return 2
  if (kind === 'metal') return 3
  return 4 // clapboard
}

/**
 * Assign shell material for Mixed — deterministic from stories + distance.
 * Clapboard is never assigned by Mixed (opt-in only).
 */
export function assignMixedMaterial(
  stories: number,
  maxStories: number,
  x: number,
  z: number,
  halfExtent: number,
  rule: MixedAssignRule,
): ShellMaterial {
  if (rule === 'byHeight') {
    const t = stories / Math.max(1, maxStories)
    if (t >= 0.72) return 'metal'
    if (t >= 0.45) return 'concrete'
    if (t >= 0.22) return 'brick'
    return 'plaster'
  }
  const r = Math.hypot(x, z) / Math.max(1, halfExtent)
  if (r >= 0.72) return 'metal'
  if (r >= 0.42) return 'concrete'
  if (r >= 0.2) return 'brick'
  return 'plaster'
}

/** Wear 0–3 for a building under the active preview mode. */
export function wearForBuilding(
  mat: MaterialityParams,
  x: number,
  z: number,
): number {
  if (mat.wearMode === 'scrub') return clamp(mat.wear, 0, 3)
  const r = Math.hypot(x, z)
  const t = clamp(r / Math.max(1, mat.wearRadius), 0, 1)
  return t * 3
}

/**
 * Fail / weather side 0..3 in local building frame:
 * 0 = −Z (road front), 1 = +X, 2 = +Z (rear), 3 = −X.
 */
export function exposedFailSide(x: number, z: number, yaw: number): number {
  const fromCenterX = x
  const fromCenterZ = z
  const len = Math.hypot(fromCenterX, fromCenterZ) || 1
  const ox = fromCenterX / len
  const oz = fromCenterZ / len
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  const faces: [number, number][] = [
    [-sin, -cos],
    [cos, -sin],
    [sin, cos],
    [-cos, sin],
  ]
  let best = 0
  let bestDot = -2
  for (let i = 0; i < 4; i++) {
    const f = faces[i]!
    const d = f[0]! * ox + f[1]! * oz
    if (d > bestDot) {
      bestDot = d
      best = i
    }
  }
  return best
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v))
}

/** Effective 0…1 geometry amount for a layer at a given wear (0 before startWear). */
export function geoLayerAmount(layer: GeoLayer, wear: number): number {
  if (!layer.on) return 0
  const start = Math.max(2, layer.startWear)
  if (wear < start) return 0
  const span = Math.max(0.05, 3 - start)
  const t = clamp((wear - start) / span, 0, 1)
  return Math.min(layer.cap, t * layer.strength)
}

/**
 * Base tone for a material kind — Before/After by era, swatch by toneIndex.
 */
export function toneHex(mat: MaterialityParams, kind: ShellMaterial): string {
  const before = MATERIAL_TONES[kind]
  const after = MATERIAL_TONES_AFTER[kind]
  const i =
    ((mat.toneIndex[kind] % before.length) + before.length) % before.length
  const a = before[i]!
  const b = after[i]!
  if (mat.era <= 0) return a
  if (mat.era >= 1) return b
  return lerpHex(a, b, mat.era)
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ]
}

function lerpHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  const r = Math.round((ar + (br - ar) * t) * 255)
  const g = Math.round((ag + (bg - ag) * t) * 255)
  const bl = Math.round((ab + (bb - ab) * t) * 255)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`
}

/** Effective materiality for Lab compare modes (city Apply keeps full params). */
export function materialityForCompare(mat: MaterialityParams): MaterialityParams {
  if (mat.compareMode === 'texture') {
    return {
      ...mat,
      missingPanel: { ...mat.missingPanel, on: false },
      debris: { ...mat.debris, on: false },
      tarp: { ...mat.tarp, on: false },
      brokenPanes: { ...mat.brokenPanes, on: false },
      gutterDamage: { ...mat.gutterDamage, on: false },
    }
  }
  if (mat.compareMode === 'geometry') {
    return {
      ...mat,
      grime: { ...mat.grime, on: false },
      rainStreaks: { ...mat.rainStreaks, on: false },
      rust: { ...mat.rust, on: false },
      chalk: { ...mat.chalk, on: false },
      salt: { ...mat.salt, on: false },
      moss: { ...mat.moss, on: false },
    }
  }
  return mat
}
