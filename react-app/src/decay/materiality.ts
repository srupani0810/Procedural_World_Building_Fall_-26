/**
 * DECAY Materiality — materials + wear preview params.
 * Surface leads; geometry late/sparse/capped. No Math.random.
 */

export type ShellMaterial = 'brick' | 'concrete' | 'plaster' | 'metal'

export type MaterialPick = ShellMaterial | 'mixed'

/** How Mixed assigns a shell material per building (shown in the panel). */
export type MixedAssignRule = 'byHeight' | 'byDistance'

export type WearMode = 'scrub' | 'distance'

export type SurfaceLayer = {
  on: boolean
  strength: number
}

export type MaterialityParams = {
  material: MaterialPick
  mixedRule: MixedAssignRule
  /** Swatch index into MATERIAL_TONES[kind]. */
  toneIndex: Record<ShellMaterial, number>
  /** Global wear scrub 0 (new) → 3 (reclaimed). Used when wearMode = scrub. */
  wear: number
  wearMode: WearMode
  /** Distance mode: world radius where wear reaches 3 (rim first). */
  wearRadius: number
  grime: SurfaceLayer
  rainStreaks: SurfaceLayer
  rust: SurfaceLayer
  chalk: SurfaceLayer
  /** Salt bloom — brick only in the shader. */
  salt: SurfaceLayer
  moss: SurfaceLayer
  /** Geometry — high wear only, one side max, capped. */
  missingPanel: boolean
  debris: boolean
  tarp: boolean
}

export const MATERIAL_LABELS: Record<MaterialPick, string> = {
  brick: 'Brick',
  concrete: 'Concrete',
  plaster: 'Plaster',
  metal: 'Corrugated metal',
  mixed: 'Mixed',
}

export const MIXED_RULE_COPY: Record<MixedAssignRule, string> = {
  byHeight:
    'Mixed rule: taller shells (≥ mid story band) → corrugated metal; mid → concrete; shorter → brick; lowest band → plaster.',
  byDistance:
    'Mixed rule: near center → brick / plaster; mid ring → concrete; rim → corrugated metal (distance from origin).',
}

/** Muted browns / grays / rusts — no bright colors. */
export const MATERIAL_TONES: Record<ShellMaterial, string[]> = {
  brick: ['#6b3f2e', '#5a3428', '#7a4a38', '#4a2e24', '#624034'],
  concrete: ['#6a6660', '#5c5852', '#7a7670', '#4e4a46', '#686460'],
  plaster: ['#8a7e70', '#9a8e80', '#7a6e62', '#6a6054', '#847868'],
  metal: ['#5a524c', '#6b5040', '#4a4440', '#7a5a48', '#524840'],
}

export function defaultSurface(strength = 0.65): SurfaceLayer {
  return { on: true, strength }
}

export function createDefaultMateriality(): MaterialityParams {
  return {
    material: 'brick',
    mixedRule: 'byHeight',
    toneIndex: { brick: 0, concrete: 0, plaster: 0, metal: 0 },
    wear: 0,
    wearMode: 'scrub',
    wearRadius: 220,
    grime: defaultSurface(0.7),
    rainStreaks: defaultSurface(0.55),
    rust: defaultSurface(0.6),
    chalk: defaultSurface(0.65),
    salt: defaultSurface(0.5),
    moss: defaultSurface(0.45),
    missingPanel: true,
    debris: true,
    tarp: true,
  }
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
    missingPanel: base.missingPanel,
    debris: base.debris,
    tarp: base.tarp,
  }
}

export function materialId(kind: ShellMaterial): number {
  if (kind === 'brick') return 0
  if (kind === 'concrete') return 1
  if (kind === 'plaster') return 2
  return 3
}

/**
 * Assign shell material for Mixed — deterministic from stories + distance.
 * Readable rule; no randomness.
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
  // Edges first: rim → high wear, core → low.
  const r = Math.hypot(x, z)
  const t = clamp(r / Math.max(1, mat.wearRadius), 0, 1)
  return t * 3
}

/**
 * Fail / weather side 0..3 in local building frame:
 * 0 = −Z (road front), 1 = +X, 2 = +Z (rear), 3 = −X.
 * Pick the face whose outward normal points most away from town center
 * (most exposed to the rim).
 */
export function exposedFailSide(x: number, z: number, yaw: number): number {
  const fromCenterX = x
  const fromCenterZ = z
  const len = Math.hypot(fromCenterX, fromCenterZ) || 1
  const ox = fromCenterX / len
  const oz = fromCenterZ / len
  // Local face outwards in world (yaw rotates local → world).
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  const faces: [number, number][] = [
    [-sin, -cos], // −Z local
    [cos, -sin], // +X
    [sin, cos], // +Z
    [-cos, sin], // −X
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

export function toneHex(mat: MaterialityParams, kind: ShellMaterial): string {
  const list = MATERIAL_TONES[kind]
  const i = ((mat.toneIndex[kind] % list.length) + list.length) % list.length
  return list[i]!
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ]
}
