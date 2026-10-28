import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  Float32BufferAttribute,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { V2Cell } from './grid.ts'
import { cellHash, neighborFaces, occupiedNeighborCount } from './grid.ts'
import type { ImpactMode, VacateStage } from './stages.ts'
import { STAGE_COLOR } from './stages.ts'

const STORY = 1.15

/** Footprint width as a fraction of cellSize — constrained band. */
const FOOTPRINT_MIN = 0.75
const FOOTPRINT_MAX = 0.95

export { STORY }

type RoofKind = 'pyramid' | 'parapet' | 'setback'

function tintFor(stage: VacateStage, impact: ImpactMode): Color {
  const base = new Color(STAGE_COLOR[stage])
  if (impact === 'paint') base.lerp(new Color('#c4b49a'), 0.35)
  if (impact === 'rust') base.lerp(new Color('#8a3a1c'), 0.45)
  if (impact === 'partial') base.lerp(new Color('#6a6e74'), 0.4)
  return base
}

/**
 * Half-extent of the shell on XZ.
 * Density of occupied ortho neighbors pulls toward a larger “block” footprint;
 * isolation pulls toward a smaller outlying one. Seeded jitter from ix,iz keeps
 * it stable and avoids flat uniform noise (Townscaper-style constrained random).
 */
export function footprintHalf(ix: number, iz: number, cellSize: number, map: Map<string, V2Cell>) {
  const density = occupiedNeighborCount(ix, iz, map) / 4
  const u = cellHash(ix, iz, 11)
  const center = FOOTPRINT_MIN + density * (FOOTPRINT_MAX - FOOTPRINT_MIN)
  const jitter = (u - 0.5) * 0.08
  const frac = Math.min(FOOTPRINT_MAX, Math.max(FOOTPRINT_MIN, center + jitter))
  return (cellSize * frac) * 0.5
}

/** Seeded roof type — stable per cell, not per-frame. */
function roofKindFor(ix: number, iz: number): RoofKind {
  const u = cellHash(ix, iz, 29)
  if (u < 0.34) return 'pyramid'
  if (u < 0.67) return 'parapet'
  return 'setback'
}

type StoryProfile = {
  /** Uniform scale of the story mass (seeded, with height taper). */
  inset: number
  /** Extra X / Z scale so stories are not square clones. */
  scaleX: number
  scaleZ: number
  /** Slight plan shift as height increases. */
  shiftX: number
  shiftZ: number
}

/**
 * Per-story profile from cell seed + story index.
 * Higher stories trend slightly smaller (taper); each floor gets its own inset
 * and a small plan shift so stacks are not identical boxes.
 */
function storyProfile(ix: number, iz: number, story: number, height: number): StoryProfile {
  const uInset = cellHash(ix, iz, 40 + story * 7)
  const uSx = cellHash(ix, iz, 50 + story * 7)
  const uSz = cellHash(ix, iz, 60 + story * 7)
  const uShx = cellHash(ix, iz, 70 + story * 7)
  const uShz = cellHash(ix, iz, 80 + story * 7)
  const t = height <= 1 ? 0 : story / (height - 1)
  // Base inset 0.86–1.0 from seed, then taper up the stack (~8% by the top).
  const inset = (0.86 + uInset * 0.14) * (1 - t * 0.08)
  const scaleX = 0.92 + uSx * 0.12
  const scaleZ = 0.92 + uSz * 0.12
  // Drift grows with height so upper floors read as slightly offset.
  const drift = 0.04 + t * 0.06
  const shiftX = (uShx - 0.5) * 2 * drift
  const shiftZ = (uShz - 0.5) * 2 * drift
  return { inset, scaleX, scaleZ, shiftX, shiftZ }
}

/** Occasional open-face panel skip — seeded, not every open wall. */
function skipOpenPanel(ix: number, iz: number, story: number, faceName: string) {
  const faceSalt = faceName === 'north' ? 1 : faceName === 'east' ? 2 : faceName === 'south' ? 3 : 4
  const u = cellHash(ix, iz, 90 + story * 11 + faceSalt)
  return u > 0.78
}

/**
 * Rule-driven shell: open sides get panels; top story gets a distinct roof;
 * partial impact leaves a missing NE corner with bite debris (shell still stands).
 * Story mass varies by seeded inset / taper / shift — not even/odd clones.
 */
export function buildShellGeometry(
  cell: V2Cell,
  map: Map<string, V2Cell>,
  stage: VacateStage,
  impact: ImpactMode,
  cellSize: number,
): BufferGeometry {
  const faces = neighborFaces(cell, map)
  const color = tintFor(stage, impact)
  const roofColor = color.clone().offsetHSL(0, 0, -0.06)
  const parts: BufferGeometry[] = []
  const half = footprintHalf(cell.ix, cell.iz, cellSize, map)
  const roof = roofKindFor(cell.ix, cell.iz)
  const openCount = faces.filter((f) => f.open).length
  const bitten = impact === 'partial' && openCount >= 2

  for (let story = 0; story < cell.height; story++) {
    const y = story * STORY + STORY * 0.5
    const isTop = story === cell.height - 1
    const profile = storyProfile(cell.ix, cell.iz, story, cell.height)
    let inset = profile.inset
    if (isTop && roof === 'setback') inset *= 0.72

    const coreW = half * 2 * inset * 0.88 * profile.scaleX
    const coreD = half * 2 * inset * 0.88 * profile.scaleZ
    const coreH = STORY * 0.96
    const sx = profile.shiftX * half
    const sz = profile.shiftZ * half

    if (isTop && bitten) {
      // Geometric loss: L-shaped mass, NE corner empty — not a tint-only cue.
      const main = new BoxGeometry(coreW * 0.62, coreH, coreD)
      main.translate(sx - coreW * 0.19, y, sz)
      paintGeo(main, color)
      parts.push(main)
      const wing = new BoxGeometry(coreW * 0.38, coreH, coreD * 0.55)
      wing.translate(sx + coreW * 0.31, y, sz - coreD * 0.225)
      paintGeo(wing, color)
      parts.push(wing)

      const bite = new BoxGeometry(half * 0.7, STORY * 0.42, half * 0.7)
      bite.translate(sx + half * 0.48, y - STORY * 0.18, sz + half * 0.48)
      paintGeo(bite, new Color('#2a2d32'))
      parts.push(bite)
      const slab = new BoxGeometry(half * 0.65, 0.12, half * 0.65)
      slab.translate(sx + half * 0.42, y - STORY * 0.42, sz + half * 0.52)
      paintGeo(slab, new Color('#5a4038'))
      parts.push(slab)
    } else {
      const core = new BoxGeometry(coreW, coreH, coreD)
      core.translate(sx, y, sz)
      paintGeo(core, color)
      parts.push(core)
    }

    for (const face of faces) {
      if (!face.open) continue
      if (isTop && bitten && (face.name === 'east' || face.name === 'north')) continue
      if (skipOpenPanel(cell.ix, cell.iz, story, face.name)) continue
      const panelW = face.name === 'east' || face.name === 'west' ? 0.12 : half * 1.6 * inset * profile.scaleX
      const panelD = face.name === 'north' || face.name === 'south' ? 0.12 : half * 1.6 * inset * profile.scaleZ
      const panel = new BoxGeometry(panelW, STORY * 0.7, panelD)
      const ox =
        face.name === 'east'
          ? half * inset * 0.95 * profile.scaleX
          : face.name === 'west'
            ? -half * inset * 0.95 * profile.scaleX
            : 0
      const oz =
        face.name === 'north'
          ? half * inset * 0.95 * profile.scaleZ
          : face.name === 'south'
            ? -half * inset * 0.95 * profile.scaleZ
            : 0
      panel.translate(sx + ox, y, sz + oz)
      paintGeo(panel, color.clone().offsetHSL(0, 0, -0.08))
      parts.push(panel)
    }

    if (isTop) {
      const roofY = y + coreH * 0.5
      if (roof === 'pyramid') {
        const peak = new ConeGeometry(Math.min(coreW, coreD) * 0.55, STORY * 0.55, 4)
        peak.rotateY(Math.PI / 4)
        peak.translate(
          sx + (bitten ? -half * 0.12 : 0),
          roofY + STORY * 0.28,
          sz + (bitten ? -half * 0.08 : 0),
        )
        paintGeo(peak, roofColor)
        parts.push(peak)
      } else if (roof === 'parapet') {
        const ox = sx + (bitten ? -coreW * 0.08 : 0)
        const oz = sz + (bitten ? -coreD * 0.06 : 0)
        const deck = new BoxGeometry(coreW * 0.92, 0.08, coreD * 0.92)
        deck.translate(ox, roofY + 0.04, oz)
        paintGeo(deck, roofColor)
        parts.push(deck)
        const lipH = 0.18
        const lipT = 0.08
        const lipY = roofY + 0.12
        const spanX = coreW * 1.02
        const spanZ = coreD * 1.02
        for (const [dx, dz, sxLip, szLip] of [
          [0, spanZ * 0.5, spanX, lipT],
          [0, -spanZ * 0.5, spanX, lipT],
          [spanX * 0.5, 0, lipT, spanZ],
          [-spanX * 0.5, 0, lipT, spanZ],
        ] as const) {
          const wall = new BoxGeometry(sxLip, lipH, szLip)
          wall.translate(ox + dx, lipY, oz + dz)
          paintGeo(wall, roofColor.clone().offsetHSL(0, 0, -0.04))
          parts.push(wall)
        }
      } else {
        const cap = new BoxGeometry(coreW * 0.9, 0.1, coreD * 0.9)
        cap.translate(
          sx + (bitten ? -coreW * 0.08 : 0),
          roofY + 0.05,
          sz + (bitten ? -coreD * 0.05 : 0),
        )
        paintGeo(cap, roofColor)
        parts.push(cap)
      }
    }
  }

  if (parts.length === 0) {
    const fallback = new BoxGeometry(half * 2, STORY, half * 2)
    paintGeo(fallback, color)
    return fallback
  }

  const merged = mergeGeometries(parts, false)
  for (const part of parts) part.dispose()
  if (!merged) {
    const fallback = new BoxGeometry(half * 2, STORY, half * 2)
    paintGeo(fallback, color)
    return fallback
  }
  return merged
}

function paintGeo(geo: BufferGeometry, color: Color) {
  const count = geo.getAttribute('position').count
  const colors = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3))
}
