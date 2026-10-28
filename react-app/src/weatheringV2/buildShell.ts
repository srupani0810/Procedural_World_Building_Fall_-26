import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  Float32BufferAttribute,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { V2Cell } from './grid.ts'
import { cellHash, neighborFaces, occupiedNeighborCount, type NeighborFace } from './grid.ts'
import {
  resolveProgram,
  type BuildingProgram,
} from './program.ts'
import type { ImpactMode, VacateStage } from './stages.ts'
import { STAGE_COLOR } from './stages.ts'

const STORY = 1.15

/** Footprint width as a fraction of cellSize — constrained band. */
const FOOTPRINT_MIN = 0.75
const FOOTPRINT_MAX = 0.95

export { STORY }

type RoofKind = 'pyramid' | 'parapet' | 'setback' | 'flat'

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

/** Program forces roof family; otherwise seeded fallback for non-program roofs. */
function roofKindFor(program: BuildingProgram, ix: number, iz: number): RoofKind {
  if (program === 'house') return 'pyramid'
  if (program === 'walk-up' || program === 'office-hall' || program === 'utility') return 'flat'
  if (program === 'live-work') return 'setback'
  if (program === 'rowhouse') return 'parapet'
  if (program === 'corner-shop') return 'parapet'
  const u = cellHash(ix, iz, 29)
  if (u < 0.34) return 'pyramid'
  if (u < 0.67) return 'parapet'
  return 'setback'
}

type StoryProfile = {
  inset: number
  scaleX: number
  scaleZ: number
  shiftX: number
  shiftZ: number
}

/**
 * Per-story profile — program rules override massing proportions;
 * residual seeded inset only where program does not specify.
 */
function storyProfile(
  program: BuildingProgram,
  ix: number,
  iz: number,
  story: number,
  height: number,
): StoryProfile {
  const uInset = cellHash(ix, iz, 40 + story * 7)
  const uSx = cellHash(ix, iz, 50 + story * 7)
  const uSz = cellHash(ix, iz, 60 + story * 7)
  const uShx = cellHash(ix, iz, 70 + story * 7)
  const uShz = cellHash(ix, iz, 80 + story * 7)
  const t = height <= 1 ? 0 : story / (height - 1)
  let inset = (0.86 + uInset * 0.14) * (1 - t * 0.08)
  let scaleX = 0.92 + uSx * 0.12
  let scaleZ = 0.92 + uSz * 0.12
  const drift = 0.04 + t * 0.06
  let shiftX = (uShx - 0.5) * 2 * drift
  let shiftZ = (uShz - 0.5) * 2 * drift

  // Program massing rules (no hash): readable secondary proportion.
  if (program === 'live-work') {
    // Wider ground floor, narrower upper floors.
    if (story === 0) {
      inset = 1
      scaleX = 1.08
      scaleZ = 1.02
    } else {
      inset = 0.82 - t * 0.06
      scaleX = 0.88
      scaleZ = 0.9
    }
    shiftX = 0
    shiftZ = 0
  } else if (program === 'rowhouse') {
    // Narrow repeating frontage (compress one plan axis).
    inset = 0.94
    scaleX = 0.78
    scaleZ = 0.96
    shiftX = 0
    shiftZ = 0
  } else if (program === 'walk-up') {
    inset = 0.96
    scaleX = 0.92
    scaleZ = 0.92
    shiftX = 0
    shiftZ = 0
  } else if (program === 'office-hall') {
    inset = 0.98
    scaleX = 1
    scaleZ = 1
    shiftX = 0
    shiftZ = 0
  } else if (program === 'corner-shop') {
    inset = 0.72
    scaleX = 0.85
    scaleZ = 0.85
    shiftX = 0
    shiftZ = 0
  } else if (program === 'utility') {
    // More vertical / slender infrastructure mass.
    inset = 0.7 + story * 0.02
    scaleX = 0.7
    scaleZ = 0.7
    shiftX = 0
    shiftZ = 0
  } else if (program === 'house') {
    inset = 0.9
    scaleX = 0.95
    scaleZ = 0.95
    shiftX = 0
    shiftZ = 0
  }

  return { inset, scaleX, scaleZ, shiftX, shiftZ }
}

/** Open-face panels: program decides density of punching, not a hidden hash. */
function skipOpenPanel(program: BuildingProgram, story: number, faceName: string) {
  if (program === 'office-hall') return true // blank wall faces
  if (program === 'utility') return story > 0 // only sparse ground aperture later via punches
  if (program === 'walk-up') return true // replaced by repeated window punches
  if (program === 'house' || program === 'live-work') return false
  if (program === 'rowhouse') return faceName === 'east' || faceName === 'west'
  if (program === 'corner-shop') return false
  return false
}

function primaryOpenFace(faces: NeighborFace[]): NeighborFace | null {
  const open = faces.filter((f) => f.open)
  if (open.length === 0) return null
  return open.find((f) => f.name === 'south') ?? open[0]!
}

/**
 * Rule-driven shell: neighbor open/shared walls stay the backbone;
 * program adds secondary detail from massing + height only.
 */
export function buildShellGeometry(
  cell: V2Cell,
  map: Map<string, V2Cell>,
  stage: VacateStage,
  impact: ImpactMode,
  cellSize: number,
): BufferGeometry {
  const faces = neighborFaces(cell, map)
  const { program } = resolveProgram(cell.ix, cell.iz, cell.height, map)
  const color = tintFor(stage, impact)
  const roofColor = color.clone().offsetHSL(0, 0, -0.06)
  const detailColor = color.clone().offsetHSL(0, -0.05, -0.12)
  const punchColor = new Color('#1a1c20')
  const parts: BufferGeometry[] = []
  const half = footprintHalf(cell.ix, cell.iz, cellSize, map)
  const roof = roofKindFor(program, cell.ix, cell.iz)
  const openCount = faces.filter((f) => f.open).length
  const bitten = impact === 'partial' && openCount >= 2
  const courtyard = program === 'office-hall' && cell.height >= 3
  const front = primaryOpenFace(faces)

  for (let story = 0; story < cell.height; story++) {
    const y = story * STORY + STORY * 0.5
    const isTop = story === cell.height - 1
    const profile = storyProfile(program, cell.ix, cell.iz, story, cell.height)
    let inset = profile.inset
    if (isTop && roof === 'setback') inset *= 0.72

    const coreW = half * 2 * inset * 0.88 * profile.scaleX
    const coreD = half * 2 * inset * 0.88 * profile.scaleZ
    const coreH = STORY * 0.96
    const sx = profile.shiftX * half
    const sz = profile.shiftZ * half

    if (courtyard) {
      // Ring mass — central void reads as market/office courtyard.
      const t = Math.min(coreW, coreD) * 0.18
      const ring: Array<[number, number, number, number]> = [
        [coreW, t, 0, (coreD - t) * 0.5],
        [coreW, t, 0, -(coreD - t) * 0.5],
        [t, coreD - t * 2, (coreW - t) * 0.5, 0],
        [t, coreD - t * 2, -(coreW - t) * 0.5, 0],
      ]
      for (const [w, d, dx, dz] of ring) {
        const piece = new BoxGeometry(w, coreH, d)
        piece.translate(sx + dx, y, sz + dz)
        paintGeo(piece, color)
        parts.push(piece)
      }
    } else if (isTop && bitten) {
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
    } else if (program === 'corner-shop' && story === 0) {
      // Chamfered entrance: main mass + 45° corner bay on the open corner.
      const core = new BoxGeometry(coreW * 0.85, coreH, coreD * 0.85)
      core.translate(sx - coreW * 0.05, y, sz - coreD * 0.05)
      paintGeo(core, color)
      parts.push(core)
      const chamfer = new BoxGeometry(coreW * 0.42, coreH * 0.92, coreD * 0.42)
      chamfer.rotateY(Math.PI / 4)
      const openE = faces.find((f) => f.name === 'east')?.open
      const openS = faces.find((f) => f.name === 'south')?.open
      const openW = faces.find((f) => f.name === 'west')?.open
      const openN = faces.find((f) => f.name === 'north')?.open
      let cx = sx
      let cz = sz
      if (openE && openS) {
        cx = sx + coreW * 0.28
        cz = sz - coreD * 0.28
      } else if (openE && openN) {
        cx = sx + coreW * 0.28
        cz = sz + coreD * 0.28
      } else if (openW && openS) {
        cx = sx - coreW * 0.28
        cz = sz - coreD * 0.28
      } else if (openW && openN) {
        cx = sx - coreW * 0.28
        cz = sz + coreD * 0.28
      } else if (front) {
        cx =
          front.name === 'east'
            ? sx + coreW * 0.28
            : front.name === 'west'
              ? sx - coreW * 0.28
              : sx
        cz =
          front.name === 'north'
            ? sz + coreD * 0.28
            : front.name === 'south'
              ? sz - coreD * 0.28
              : sz
      }
      chamfer.translate(cx, y, cz)
      paintGeo(chamfer, detailColor)
      parts.push(chamfer)
    } else {
      const core = new BoxGeometry(coreW, coreH, coreD)
      core.translate(sx, y, sz)
      paintGeo(core, color)
      parts.push(core)
    }

    for (const face of faces) {
      if (!face.open) continue
      if (isTop && bitten && (face.name === 'east' || face.name === 'north')) continue
      if (skipOpenPanel(program, story, face.name)) continue
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

    // Walk-up / utility: rule-counted window punches on open faces (story index, not hash).
    if (program === 'walk-up' || program === 'utility') {
      const punches = program === 'walk-up' ? 3 : 1
      for (const face of faces) {
        if (!face.open) continue
        for (let w = 0; w < punches; w++) {
          const u = punches === 1 ? 0.5 : (w + 1) / (punches + 1)
          const along = (u - 0.5) * half * 1.2 * inset
          const pw = 0.22
          const ph = STORY * (program === 'utility' ? 0.45 : 0.32)
          const pd = 0.08
          const win = new BoxGeometry(
            face.name === 'east' || face.name === 'west' ? pd : pw,
            ph,
            face.name === 'north' || face.name === 'south' ? pd : pw,
          )
          const ox =
            face.name === 'east'
              ? half * inset * 0.92 * profile.scaleX
              : face.name === 'west'
                ? -half * inset * 0.92 * profile.scaleX
                : face.name === 'north' || face.name === 'south'
                  ? along * profile.scaleX
                  : 0
          const oz =
            face.name === 'north'
              ? half * inset * 0.92 * profile.scaleZ
              : face.name === 'south'
                ? -half * inset * 0.92 * profile.scaleZ
                : face.name === 'east' || face.name === 'west'
                  ? along * profile.scaleZ
                  : 0
          win.translate(sx + ox, y + (program === 'utility' ? 0.08 : 0), sz + oz)
          paintGeo(win, punchColor)
          parts.push(win)
        }
      }
    }

    if (isTop) {
      const roofY = y + coreH * 0.5
      addRoof(parts, roof, roofColor, coreW, coreD, roofY, sx, sz, bitten)
      if (program === 'house') {
        // Small chimney stub on pitched roof.
        const chim = new BoxGeometry(0.16, STORY * 0.35, 0.16)
        chim.translate(sx + coreW * 0.22, roofY + STORY * 0.45, sz - coreD * 0.15)
        paintGeo(chim, detailColor)
        parts.push(chim)
      }
    }
  }

  // Ground-level secondary detail by program.
  addGroundProgramDetail(parts, program, faces, front, half, color, detailColor)

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

function addRoof(
  parts: BufferGeometry[],
  roof: RoofKind,
  roofColor: Color,
  coreW: number,
  coreD: number,
  roofY: number,
  sx: number,
  sz: number,
  bitten: boolean,
) {
  if (roof === 'pyramid') {
    const peak = new ConeGeometry(Math.min(coreW, coreD) * 0.55, STORY * 0.55, 4)
    peak.rotateY(Math.PI / 4)
    peak.translate(
      sx + (bitten ? -coreW * 0.08 : 0),
      roofY + STORY * 0.28,
      sz + (bitten ? -coreD * 0.06 : 0),
    )
    paintGeo(peak, roofColor)
    parts.push(peak)
    return
  }
  if (roof === 'parapet' || roof === 'flat') {
    const ox = sx + (bitten ? -coreW * 0.08 : 0)
    const oz = sz + (bitten ? -coreD * 0.06 : 0)
    const deck = new BoxGeometry(coreW * 0.92, 0.08, coreD * 0.92)
    deck.translate(ox, roofY + 0.04, oz)
    paintGeo(deck, roofColor)
    parts.push(deck)
    if (roof === 'parapet') {
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
    }
    return
  }
  const cap = new BoxGeometry(coreW * 0.9, 0.1, coreD * 0.9)
  cap.translate(
    sx + (bitten ? -coreW * 0.08 : 0),
    roofY + 0.05,
    sz + (bitten ? -coreD * 0.05 : 0),
  )
  paintGeo(cap, roofColor)
  parts.push(cap)
}

function addGroundProgramDetail(
  parts: BufferGeometry[],
  program: BuildingProgram,
  faces: NeighborFace[],
  front: NeighborFace | null,
  half: number,
  color: Color,
  detailColor: Color,
) {
  if (!front) return
  const ox =
    front.name === 'east' ? half * 0.95 : front.name === 'west' ? -half * 0.95 : 0
  const oz =
    front.name === 'north' ? half * 0.95 : front.name === 'south' ? -half * 0.95 : 0
  const alongX = front.name === 'north' || front.name === 'south'

  if (program === 'house') {
    // Porch panel / slab on primary open face.
    const slab = new BoxGeometry(alongX ? half * 1.1 : 0.55, 0.08, alongX ? 0.55 : half * 1.1)
    slab.translate(ox * 0.7, 0.06, oz * 0.7)
    paintGeo(slab, detailColor)
    parts.push(slab)
    const postH = STORY * 0.55
    for (const side of [-1, 1] as const) {
      const post = new BoxGeometry(0.08, postH, 0.08)
      post.translate(
        ox * 0.85 + (alongX ? side * half * 0.35 : 0),
        postH * 0.5,
        oz * 0.85 + (alongX ? 0 : side * half * 0.35),
      )
      paintGeo(post, color.clone().offsetHSL(0, 0, -0.1))
      parts.push(post)
    }
  }

  if (program === 'rowhouse') {
    // Stoop steps on narrow frontage.
    for (let s = 0; s < 3; s++) {
      const step = new BoxGeometry(
        alongX ? half * 0.55 : 0.35 - s * 0.06,
        0.07,
        alongX ? 0.35 - s * 0.06 : half * 0.55,
      )
      const out = 0.55 + s * 0.12
      step.translate(ox * out, 0.04 + s * 0.07, oz * out)
      paintGeo(step, detailColor)
      parts.push(step)
    }
  }

  if (program === 'live-work' && faces.some((f) => f.open)) {
    // Ground shop band — darker strip on open faces.
    for (const face of faces) {
      if (!face.open) continue
      const band = new BoxGeometry(
        face.name === 'east' || face.name === 'west' ? 0.1 : half * 1.5,
        STORY * 0.35,
        face.name === 'north' || face.name === 'south' ? 0.1 : half * 1.5,
      )
      const bx =
        face.name === 'east' ? half * 0.98 : face.name === 'west' ? -half * 0.98 : 0
      const bz =
        face.name === 'north' ? half * 0.98 : face.name === 'south' ? -half * 0.98 : 0
      band.translate(bx, STORY * 0.35, bz)
      paintGeo(band, detailColor)
      parts.push(band)
    }
  }
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
