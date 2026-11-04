/**
 * DECAY industry / yard parts kit — unit footprint space (same as house parts).
 * X = width, Z = depth (−Z street), Y = stories. No Math.random.
 */

import {
  BoxGeometry,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Matrix4,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { INDUSTRY_BEFORE } from './industryPalette.ts'

const _m = new Matrix4()
const _c = new Color()

function paint(geo: BufferGeometry, hex: string) {
  const n = geo.getAttribute('position').count
  const col = new Float32BufferAttribute(n * 3, 3)
  _c.set(hex)
  for (let i = 0; i < n; i++) col.setXYZ(i, _c.r, _c.g, _c.b)
  geo.setAttribute('color', col)
  return geo
}

export function indBox(
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

export function indWallMass(stories: number, hex: string): BufferGeometry {
  return indBox(1, stories, 0.72, hex, 0, stories * 0.5, -0.05)
}

/** Saw-tooth roof bays along X (factory). */
export function indSawtoothRoof(stories: number, bays = 4): BufferGeometry[] {
  const out: BufferGeometry[] = []
  const bayW = 1 / bays
  const y0 = stories
  for (let i = 0; i < bays; i++) {
    const x = -0.5 + bayW * (i + 0.5)
    const slab = new BoxGeometry(bayW * 0.98, 0.06, 0.78)
    paint(slab, INDUSTRY_BEFORE.roof)
    slab.applyMatrix4(
      new Matrix4()
        .makeTranslation(x, y0 + 0.18, -0.05)
        .multiply(new Matrix4().makeRotationZ(0.42)),
    )
    out.push(slab)
    out.push(indBox(0.04, 0.28, 0.7, INDUSTRY_BEFORE.sawtooth, x - bayW * 0.35, y0 + 0.2, -0.05))
  }
  return out
}

/** Plain shed roof (warehouse). */
export function indShedRoof(stories: number): BufferGeometry {
  return indBox(1.04, 0.08, 0.78, INDUSTRY_BEFORE.roof, 0, stories + 0.04, -0.05)
}

/** Tall brick stack. */
export function indStack(
  stories: number,
  x: number,
  z: number,
  height = 2.8,
): BufferGeometry {
  return indBox(0.12, height, 0.12, INDUSTRY_BEFORE.brick, x, stories + height * 0.5, z)
}

/** Yard fence collision — matches the three fence boxes in indLoadingYard. */
export const INDUSTRY_YARD_FENCE = [
  { lx: 0, lz: 0.85, sx: 0.92, sz: 0.04 },
  { lx: -0.46, lz: 0.58, sx: 0.04, sz: 0.5 },
  { lx: 0.46, lz: 0.58, sx: 0.04, sz: 0.5 },
] as const

export function industryYardFenceSolids(): {
  lx: number
  lz: number
  sx: number
  sz: number
}[] {
  return INDUSTRY_YARD_FENCE.map((f) => ({ lx: f.lx, lz: f.lz, sx: f.sx, sz: f.sz }))
}

/** Fenced loading yard behind the hall (+Z). */
export function indLoadingYard(): BufferGeometry[] {
  const y = 0.12
  const fenceH = 0.28
  const [back, left, right] = INDUSTRY_YARD_FENCE
  const posts: BufferGeometry[] = [
    indBox(0.95, 0.04, 0.95, INDUSTRY_BEFORE.ballast, 0, 0.02, 0.42),
    indBox(back!.sx, fenceH, back!.sz, INDUSTRY_BEFORE.fence, back!.lx, y + fenceH * 0.5, back!.lz),
    indBox(left!.sx, fenceH, left!.sz, INDUSTRY_BEFORE.fence, left!.lx, y + fenceH * 0.5, left!.lz),
    indBox(right!.sx, fenceH, right!.sz, INDUSTRY_BEFORE.fence, right!.lx, y + fenceH * 0.5, right!.lz),
  ]
  return posts
}

/** Loading docks along one long side (−Z street face). */
export function indLoadingDocks(count = 3): BufferGeometry[] {
  const out: BufferGeometry[] = []
  const span = 0.85
  const step = span / Math.max(1, count)
  for (let i = 0; i < count; i++) {
    const x = -span * 0.5 + step * (i + 0.5)
    out.push(indBox(0.22, 0.18, 0.12, INDUSTRY_BEFORE.dock, x, 0.12, -0.48))
    out.push(indBox(0.16, 0.22, 0.04, INDUSTRY_BEFORE.trim, x, 0.28, -0.42))
  }
  return out
}

/** Horizontal / vertical pipes (heavy plant). */
export function indPipes(stories: number): BufferGeometry[] {
  return [
    indBox(0.7, 0.06, 0.06, INDUSTRY_BEFORE.pipe, 0.05, stories * 0.55, 0.28),
    indBox(0.06, stories * 0.7, 0.06, INDUSTRY_BEFORE.pipe, 0.35, stories * 0.4, 0.28),
    indBox(0.5, 0.05, 0.05, INDUSTRY_BEFORE.pipe, -0.1, stories * 0.75, 0.22),
  ]
}

/** Process tank. */
export function indTank(stories: number): BufferGeometry {
  return indBox(0.32, 0.45, 0.32, INDUSTRY_BEFORE.tank, -0.28, stories * 0.35, 0.32)
}

/** Flat rail pad. */
export function indRailPad(): BufferGeometry {
  return indBox(1.1, 0.08, 1.05, INDUSTRY_BEFORE.ballast, 0, 0.04, 0)
}

/** Parallel tracks along X. */
export function indTracks(n = 4): BufferGeometry[] {
  const out: BufferGeometry[] = []
  const span = 0.72
  const step = span / Math.max(1, n - 1)
  for (let i = 0; i < n; i++) {
    const z = -span * 0.5 + i * step
    out.push(indBox(1.05, 0.03, 0.06, INDUSTRY_BEFORE.track, 0, 0.1, z))
    out.push(indBox(1.05, 0.02, 0.02, INDUSTRY_BEFORE.metalDark, 0, 0.12, z - 0.02))
    out.push(indBox(1.05, 0.02, 0.02, INDUSTRY_BEFORE.metalDark, 0, 0.12, z + 0.02))
  }
  return out
}

/** Water tower for rail yard. */
export function indWaterTower(): BufferGeometry[] {
  const leg = indBox(0.08, 0.7, 0.08, INDUSTRY_BEFORE.metalDark, 0.32, 0.4, 0.28)
  const tank = indBox(0.36, 0.32, 0.36, INDUSTRY_BEFORE.waterTower, 0.32, 0.9, 0.28)
  const cap = indBox(0.4, 0.05, 0.4, INDUSTRY_BEFORE.roof, 0.32, 1.08, 0.28)
  return [leg, tank, cap]
}

/** Sparse end-wall windows only (warehouse — no long-side windows). */
export function indEndWindows(stories: number): BufferGeometry[] {
  const out: BufferGeometry[] = []
  const y = stories * 0.45
  out.push(indBox(0.03, 0.18, 0.14, INDUSTRY_BEFORE.glass, -0.51, y, -0.1))
  out.push(indBox(0.03, 0.18, 0.14, INDUSTRY_BEFORE.glass, 0.51, y, -0.1))
  return out
}

export function mergeIndParts(parts: BufferGeometry[]): BufferGeometry {
  const usable = parts.filter(Boolean)
  const merged = mergeGeometries(usable, true)
  for (const p of usable) p.dispose()
  if (!merged) return paint(new BoxGeometry(1, 1, 1), INDUSTRY_BEFORE.brick)
  return merged
}

export function pickIndex(seed: number, n: number): number {
  const m = Math.max(1, n)
  let s = seed | 0
  if (s < 0) s = -s
  return s % m
}
