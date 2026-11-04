/**
 * DECAY house parts kit — small colored boxes in unit footprint space.
 * Local: X = street width (−0.5…0.5), Z = depth (−0.5 street … +0.5 back),
 * Y = up from floor (0 = floor, 1 = one story). Merge with mergeGeometries.
 * Deterministic. No Math.random.
 */

import {
  BoxGeometry,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Matrix4,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { HOUSE_BEFORE } from './housePalette.ts'

const _m = new Matrix4()
const _c = new Color()

function paint(geo: BufferGeometry, hex: string) {
  const n = geo.getAttribute('position').count
  const col = new Float32BufferAttribute(n * 3, 3)
  _c.set(hex)
  for (let i = 0; i < n; i++) {
    col.setXYZ(i, _c.r, _c.g, _c.b)
  }
  geo.setAttribute('color', col)
  return geo
}

/** Box centered at origin, then transformed. */
export function partBox(
  sx: number,
  sy: number,
  sz: number,
  hex: string,
  tx: number,
  ty: number,
  tz: number,
): BufferGeometry {
  const g = new BoxGeometry(sx, sy, sz)
  _m.makeTranslation(tx, ty, tz)
  g.applyMatrix4(_m)
  return paint(g, hex)
}

/** Wall mass: full footprint × stories (unit: story height = 1). */
export function partWallMass(
  stories: number,
  hex: string = HOUSE_BEFORE.brick,
): BufferGeometry {
  return partBox(1, stories, 1, hex, 0, stories * 0.5, 0)
}

/** Pitched gable roof with overhang (ridge along X). */
export function partPitchedGable(
  stories: number,
  overhang = 0.06,
  roofHex: string = HOUSE_BEFORE.roof,
  wallHex: string = HOUSE_BEFORE.brick,
  pitch = 0.42,
): BufferGeometry[] {
  const y0 = stories
  const rise = Math.max(0.12, pitch)
  const w = 1 + overhang * 2
  const slabL = new BoxGeometry(w, 0.07, 0.62)
  paint(slabL, roofHex)
  slabL.applyMatrix4(
    new Matrix4()
      .makeTranslation(0, y0 + rise * 0.52, -0.22)
      .multiply(new Matrix4().makeRotationX(0.48)),
  )
  const slabR = new BoxGeometry(w, 0.07, 0.62)
  paint(slabR, roofHex)
  slabR.applyMatrix4(
    new Matrix4()
      .makeTranslation(0, y0 + rise * 0.52, 0.22)
      .multiply(new Matrix4().makeRotationX(-0.48)),
  )
  const gableF = partBox(0.06, rise, 0.95, wallHex, 0.47, y0 + rise * 0.45, 0)
  const gableB = partBox(0.06, rise, 0.95, wallHex, -0.47, y0 + rise * 0.45, 0)
  return [slabL, slabR, gableF, gableB]
}

/** Flat roof with cornice ring + parapet. */
export function partFlatRoofCornice(
  stories: number,
  parapetHeight = 0.18,
  corniceHex: string = HOUSE_BEFORE.cornice,
  parapetHex: string = HOUSE_BEFORE.parapet,
): BufferGeometry[] {
  const y = stories
  const ph = Math.max(0.06, parapetHeight)
  const deck = partBox(1.02, 0.06, 1.02, HOUSE_BEFORE.concrete, 0, y + 0.03, 0)
  const cornice = partBox(1.12, 0.08, 1.12, corniceHex, 0, y + 0.1, 0)
  const parapetN = partBox(1.08, ph, 0.06, parapetHex, 0, y + 0.1 + ph * 0.5, -0.51)
  const parapetS = partBox(1.08, ph, 0.06, parapetHex, 0, y + 0.1 + ph * 0.5, 0.51)
  const parapetE = partBox(0.06, ph, 0.96, parapetHex, 0.51, y + 0.1 + ph * 0.5, 0)
  const parapetW = partBox(0.06, ph, 0.96, parapetHex, -0.51, y + 0.1 + ph * 0.5, 0)
  return [deck, cornice, parapetN, parapetS, parapetE, parapetW]
}

/** Chimney on a shared side wall (sx = −1 left / +1 right). */
export function partChimney(stories: number, side: -1 | 1): BufferGeometry {
  return partBox(
    0.12,
    0.55,
    0.12,
    HOUSE_BEFORE.chimney,
    side * 0.42,
    stories + 0.55,
    0.15,
  )
}

/**
 * Stoop collision (unit space) — covers the three step boxes below.
 * Keep sx/sz in sync with partStoop.
 */
export const STOOP_COLLISION = {
  sx: 0.36,
  /** Depth spanning step 0…2 centers ± half step depth. */
  sz: 0.14 + 2 * 0.1,
  lz: -0.52 - 0.1,
} as const

/** Porch roof / canopy footprint — matches partPorchRoof xz. */
export const PORCH_COLLISION = {
  sx: 0.42,
  sz: 0.28,
  lz: -0.62,
} as const

/** Low back fence — matches partLowFence. */
export const FENCE_COLLISION = {
  lx: 0,
  lz: 0.72,
  sx: 0.92,
  sz: 0.04,
} as const

/**
 * Fire-escape collision placeholders.
 * Exterior fire-escape silhouette is paused in the brief — no parts yet.
 * When parts return, list unit-space boxes here so Jump In stays in sync.
 */
export function fireEscapeUnitSolids(): {
  lx: number
  lz: number
  sx: number
  sz: number
}[] {
  return []
}

/** Stoop with N steps toward street (−Z). Default 3 matches city collision. */
export function partStoop(doorX: number, stepCount = 3): BufferGeometry[] {
  const steps: BufferGeometry[] = []
  const n = Math.max(0, Math.min(5, Math.floor(stepCount)))
  const stepW = STOOP_COLLISION.sx
  const stepD = 0.14
  for (let i = 0; i < n; i++) {
    steps.push(
      partBox(
        stepW,
        0.08,
        stepD,
        HOUSE_BEFORE.stoop,
        doorX,
        0.04 + i * 0.08,
        -0.52 - i * 0.1,
      ),
    )
  }
  return steps
}

/** Door + small window above (accent door color). */
export function partDoorWithTransom(
  doorX: number,
  doorHex: string,
  trimHex: string = HOUSE_BEFORE.trim,
): BufferGeometry[] {
  const door = partBox(0.2, 0.55, 0.04, doorHex, doorX, 0.35, -0.51)
  const transom = partBox(0.16, 0.12, 0.03, HOUSE_BEFORE.glassAmber, doorX, 0.72, -0.51)
  const frame = partBox(0.24, 0.72, 0.02, trimHex, doorX, 0.4, -0.505)
  return [frame, door, transom]
}

/** Single window: glass + frame + sill + lintel on front (−Z). */
export function partWindow(
  x: number,
  y: number,
  w = 0.16,
  h = 0.22,
  opts?: {
    trimHex?: string
    frameDepth?: number
    sillDepth?: number
    lintel?: boolean
  },
): BufferGeometry[] {
  const trimHex = opts?.trimHex ?? HOUSE_BEFORE.trim
  const frameD = opts?.frameDepth ?? 0.02
  const sillD = opts?.sillDepth ?? 0.05
  const withLintel = opts?.lintel !== false
  const glass = partBox(w, h, 0.03, HOUSE_BEFORE.glassAmber, x, y, -0.51)
  const frame = partBox(w + 0.04, h + 0.04, frameD, trimHex, x, y, -0.505)
  const sill = partBox(
    w + 0.06,
    0.03,
    Math.max(0.02, sillD),
    HOUSE_BEFORE.concrete,
    x,
    y - h * 0.5 - 0.02,
    -0.52,
  )
  const out = [frame, glass, sill]
  if (withLintel) {
    out.push(
      partBox(w + 0.06, 0.03, 0.04, HOUSE_BEFORE.cornice, x, y + h * 0.5 + 0.02, -0.515),
    )
  }
  return out
}

/** Bay window — shallow protruding box on front. */
export function partBayWindow(x: number, y: number): BufferGeometry[] {
  const bay = partBox(0.28, 0.4, 0.14, HOUSE_BEFORE.plaster, x, y, -0.57)
  const glass = partBox(0.22, 0.28, 0.03, HOUSE_BEFORE.glassAmber, x, y, -0.64)
  return [bay, glass]
}

/** Small porch roof over stoop. */
export function partPorchRoof(
  doorX: number,
  roofHex: string = HOUSE_BEFORE.roof,
): BufferGeometry {
  return partBox(
    PORCH_COLLISION.sx,
    0.05,
    PORCH_COLLISION.sz,
    roofHex,
    doorX,
    0.95,
    PORCH_COLLISION.lz,
  )
}

/** Low fence along back yard edge (+Z). */
export function partLowFence(): BufferGeometry {
  return partBox(
    FENCE_COLLISION.sx,
    0.22,
    FENCE_COLLISION.sz,
    HOUSE_BEFORE.fence,
    FENCE_COLLISION.lx,
    0.14,
    FENCE_COLLISION.lz,
  )
}

/** Back extension (1 story, rear of footprint). */
export function partBackExtension(): BufferGeometry {
  return partBox(0.7, 0.85, 0.35, HOUSE_BEFORE.brick, 0, 0.45, 0.55)
}

/** Rooftop water tank (tenement). */
export function partWaterTank(stories: number): BufferGeometry[] {
  const y = stories + 0.35
  const tank = partBox(0.28, 0.35, 0.28, HOUSE_BEFORE.waterTank, 0.15, y, 0.1)
  const leg = partBox(0.06, 0.25, 0.06, HOUSE_BEFORE.trim, 0.15, stories + 0.12, 0.1)
  return [leg, tank]
}

/** Side-face window (corner houses). side −1/+1 on X. */
export function partSideWindow(
  side: -1 | 1,
  y: number,
  z: number,
): BufferGeometry[] {
  const x = side * 0.51
  const glass = partBox(0.03, 0.2, 0.14, HOUSE_BEFORE.glassAmber, x, y, z)
  const frame = partBox(0.02, 0.24, 0.18, HOUSE_BEFORE.trim, x * 0.99, y, z)
  return [frame, glass]
}

/** Side door for corner houses. */
export function partSideDoor(side: -1 | 1, doorHex: string): BufferGeometry[] {
  const x = side * 0.51
  const door = partBox(0.03, 0.5, 0.18, doorHex, x, 0.35, -0.15)
  return [door]
}

/** Stone / concrete base band (walk-up). */
export function partBaseBand(hex: string = HOUSE_BEFORE.stone): BufferGeometry {
  return partBox(1.04, 0.35, 1.04, hex, 0, 0.175, 0)
}

/** Roof stair-access bulkhead (walk-up). */
export function partStairBulkhead(stories: number): BufferGeometry[] {
  const y = stories + 0.28
  const box = partBox(0.28, 0.42, 0.36, HOUSE_BEFORE.plaster, -0.22, y, 0.12)
  const lid = partBox(0.32, 0.05, 0.4, HOUSE_BEFORE.roof, -0.22, y + 0.24, 0.12)
  return [box, lid]
}

/** Centered canopy over walk-up entrance. */
export function partEntranceCanopy(): BufferGeometry {
  return partBox(0.48, 0.06, 0.32, HOUSE_BEFORE.roof, 0, 1.05, PORCH_COLLISION.lz)
}

export function mergeParts(parts: BufferGeometry[]): BufferGeometry {
  const usable = parts.filter((p) => p !== null)
  const merged = mergeGeometries(usable, true)
  for (const p of usable) p.dispose()
  if (!merged) {
    return paint(new BoxGeometry(1, 1, 1), HOUSE_BEFORE.brick)
  }
  return merged
}

/** Stable 0…n-1 pick from integers (no Math.random). */
export function pickIndex(seed: number, n: number): number {
  const m = Math.max(1, n)
  let s = seed | 0
  if (s < 0) s = -s
  return s % m
}
