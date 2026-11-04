/**
 * DECAY commerce parts — unit footprint; Y in story heights (H = 1).
 * Min thickness 0.03H. Flush faces offset 0.01H. Parts must touch.
 * No Math.random.
 */

import {
  BoxGeometry,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Matrix4,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { COMMERCE_BEFORE } from './commercePalette.ts'

/** Minimum part thickness (H). */
export const COM_MIN = 0.03
/** Flush-face offset (H). */
export const COM_FLUSH = 0.01

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

export function comBox(
  sx: number,
  sy: number,
  sz: number,
  hex: string,
  tx: number,
  ty: number,
  tz: number,
): BufferGeometry {
  const g = new BoxGeometry(
    Math.max(COM_MIN, sx),
    Math.max(COM_MIN, sy),
    Math.max(COM_MIN, sz),
  )
  _m.makeTranslation(tx, ty, tz)
  g.applyMatrix4(_m)
  return paint(g, hex)
}

/** Low solid base band (0.3H). */
export function comBaseBand(hex: string = COMMERCE_BEFORE.base): BufferGeometry {
  return comBox(1.02, 0.3, 1.02, hex, 0, 0.15, 0)
}

/** Flat roof deck + projecting cornice at top of mass. */
export function comCorniceRoof(topY: number): BufferGeometry[] {
  const deck = comBox(1.02, COM_MIN, 1.02, COMMERCE_BEFORE.roof, 0, topY + COM_MIN * 0.5, 0)
  const cornice = comBox(
    1.1,
    Math.max(COM_MIN, 0.08),
    1.1,
    COMMERCE_BEFORE.cornice,
    0,
    topY + 0.08 + COM_FLUSH,
    0,
  )
  return [deck, cornice]
}

/** Stone band between ground and upper floors. */
export function comStoneBand(y: number): BufferGeometry {
  return comBox(1.04, Math.max(COM_MIN, 0.08), 1.04, COMMERCE_BEFORE.stone, 0, y, 0)
}

/** Colored awning slab proud of a face. face: 'front' (−Z) | 'side' (−X). */
export function comAwning(
  face: 'front' | 'side',
  y: number,
  hex: string,
  span = 0.7,
): BufferGeometry {
  if (face === 'front') {
    return comBox(span, Math.max(COM_MIN, 0.05), 0.22, hex, 0, y, -0.55)
  }
  return comBox(0.22, Math.max(COM_MIN, 0.05), span, hex, -0.55, y, 0)
}

/** Cream sign band above awning / shopfront. */
export function comSignBand(
  face: 'front' | 'side',
  y: number,
  span = 0.85,
): BufferGeometry {
  if (face === 'front') {
    return comBox(span, Math.max(COM_MIN, 0.12), COM_MIN + COM_FLUSH, COMMERCE_BEFORE.cream, 0, y, -0.51 - COM_FLUSH)
  }
  return comBox(COM_MIN + COM_FLUSH, Math.max(COM_MIN, 0.12), span, COMMERCE_BEFORE.cream, -0.51 - COM_FLUSH, y, 0)
}

/**
 * Shopfront glass panes with thin dividers on one face.
 * Pane depth ≥ 0.03H; dividers ≥ 0.03H.
 */
export function comShopfrontPanes(
  face: 'front' | 'side',
  yCenter: number,
  height: number,
  cols = 3,
): BufferGeometry[] {
  const out: BufferGeometry[] = []
  const h = Math.max(COM_MIN, height)
  const paneW = 0.22
  const gap = 0.04
  const total = cols * paneW + (cols - 1) * gap
  const start = -total * 0.5 + paneW * 0.5
  for (let i = 0; i < cols; i++) {
    const o = start + i * (paneW + gap)
    if (face === 'front') {
      out.push(
        comBox(paneW, h, COM_MIN, COMMERCE_BEFORE.glassBright, o, yCenter, -0.51 - COM_FLUSH),
      )
      if (i < cols - 1) {
        out.push(
          comBox(COM_MIN, h, COM_MIN, COMMERCE_BEFORE.trim, o + paneW * 0.5 + gap * 0.5, yCenter, -0.51 - COM_FLUSH),
        )
      }
    } else {
      out.push(
        comBox(COM_MIN, h, paneW, COMMERCE_BEFORE.glassBright, -0.51 - COM_FLUSH, yCenter, o),
      )
      if (i < cols - 1) {
        out.push(
          comBox(COM_MIN, h, COM_MIN, COMMERCE_BEFORE.trim, -0.51 - COM_FLUSH, yCenter, o + paneW * 0.5 + gap * 0.5),
        )
      }
    }
  }
  // Frame touching panes
  if (face === 'front') {
    out.push(comBox(total + 0.06, COM_MIN, COM_MIN, COMMERCE_BEFORE.trim, 0, yCenter + h * 0.5 + COM_MIN * 0.5, -0.51 - COM_FLUSH))
    out.push(comBox(total + 0.06, COM_MIN, COM_MIN, COMMERCE_BEFORE.trim, 0, yCenter - h * 0.5 - COM_MIN * 0.5, -0.51 - COM_FLUSH))
  } else {
    out.push(comBox(COM_MIN, COM_MIN, total + 0.06, COMMERCE_BEFORE.trim, -0.51 - COM_FLUSH, yCenter + h * 0.5 + COM_MIN * 0.5, 0))
    out.push(comBox(COM_MIN, COM_MIN, total + 0.06, COMMERCE_BEFORE.trim, -0.51 - COM_FLUSH, yCenter - h * 0.5 - COM_MIN * 0.5, 0))
  }
  return out
}

/**
 * 45° corner entrance vestibule at (−X, −Z) street corner.
 * Touches both shopfront faces.
 */
export function comCornerEntrance45(
  doorHex: string,
  height: number,
): BufferGeometry[] {
  const h = Math.max(0.55, height)
  const vestibule = new BoxGeometry(0.28, h, 0.28)
  paint(vestibule, COMMERCE_BEFORE.cream)
  vestibule.applyMatrix4(
    new Matrix4()
      .makeTranslation(-0.42, 0.3 + h * 0.35, -0.42)
      .multiply(new Matrix4().makeRotationY(Math.PI / 4)),
  )
  const glass = new BoxGeometry(0.18, h * 0.7, COM_MIN)
  paint(glass, COMMERCE_BEFORE.glassBright)
  glass.applyMatrix4(
    new Matrix4()
      .makeTranslation(-0.5, 0.35 + h * 0.35, -0.5)
      .multiply(new Matrix4().makeRotationY(Math.PI / 4)),
  )
  const door = new BoxGeometry(0.14, h * 0.55, COM_MIN)
  paint(door, doorHex)
  door.applyMatrix4(
    new Matrix4()
      .makeTranslation(-0.52, 0.28 + h * 0.28, -0.52)
      .multiply(new Matrix4().makeRotationY(Math.PI / 4)),
  )
  return [vestibule, glass, door]
}

/** Tall upper window with lintel on front (−Z). */
export function comUpperWindow(x: number, y: number): BufferGeometry[] {
  const w = 0.14
  const h = 0.32
  const glass = comBox(w, h, COM_MIN, COMMERCE_BEFORE.glass, x, y, -0.51 - COM_FLUSH)
  const frame = comBox(w + 0.04, h + 0.04, COM_MIN, COMMERCE_BEFORE.trim, x, y, -0.505)
  const lintel = comBox(
    w + 0.08,
    Math.max(COM_MIN, 0.04),
    0.05,
    COMMERCE_BEFORE.stone,
    x,
    y + h * 0.5 + 0.03,
    -0.52,
  )
  const sill = comBox(w + 0.06, COM_MIN, 0.04, COMMERCE_BEFORE.stone, x, y - h * 0.5 - 0.02, -0.52)
  return [frame, glass, lintel, sill]
}

/** Main wall mass from y0 to y1 (inclusive height). */
export function comWallMass(
  y0: number,
  y1: number,
  hex: string,
  inset = 0,
): BufferGeometry {
  const h = Math.max(COM_MIN, y1 - y0)
  const s = 1 - inset * 2
  return comBox(s, h, s, hex, 0, y0 + h * 0.5, 0)
}

export function mergeComParts(parts: BufferGeometry[]): BufferGeometry {
  const usable = parts.filter(Boolean)
  const merged = mergeGeometries(usable, true)
  for (const p of usable) p.dispose()
  if (!merged) return paint(new BoxGeometry(1, 1, 1), COMMERCE_BEFORE.brickTan)
  return merged
}

export function pickIndex(seed: number, n: number): number {
  const m = Math.max(1, n)
  let s = seed | 0
  if (s < 0) s = -s
  return s % m
}
