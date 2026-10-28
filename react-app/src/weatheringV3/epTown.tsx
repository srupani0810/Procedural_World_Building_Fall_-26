import { memo, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  ShaderMaterial,
} from 'three'
import {
  CELL_STAGE_AT,
  GRID_ORTHO,
  cellCentroid,
  cellCorners,
  cellStage,
  cellWear,
  townDecayShare,
  stageMarks,
  gridKey,
  neighborCell,
  type GridCell,
  type GridLayout,
  type StageThresholds,
  type XZ,
} from './epGrid.ts'
import {
  createDebrisMaterial,
  createGlassMaterial,
  createGlowMaterial,
  createPlasterMaterial,
  createTarpMaterial,
  createWearUniforms,
} from './shiftWear.ts'
import { StageLightBudget } from './shiftLights.tsx'
import type { DecayParams } from './epParams.ts'
import {
  ageAtIntroTime,
  cellVacateProfile,
  seedLayoutRuleSummary,
  type TownPhase,
} from './timeline.ts'
import {
  SIDE_NAMES,
  colorFromNeighborMajority,
  describeClaimDecision,
  describeLotMassing,
  failFromExposure,
  glassBreakWear,
  glassCrackWear,
  glassStateAtWear,
  heightFromNeighbors,
  isLandmarkLot,
  listSeedVacancies,
  openSidesAtLot,
  pickGrowthCellByDensity,
  shouldClaimInhabited,
  sideDistFromFail,
  tarpPlan,
  type CardinalNeighbors,
} from './lotRules.ts'

export const TOWN_STORY = 1.05
/** Corner pier radius — keep small so footprints stay rectilinear, not crystal-chamfered. */
const COLUMN_R = 0.06
const WALL_T = 0.16
/** How far open-corner columns pull inward from the lot corner (0 = flush square). */
const CORNER_INSET = 0.04

/** Claimed settlement cell. Identity and corners live on the grid. */
export type TownCell = GridCell

/** One story of a lot. Height is a stack of these, not a single stretched shell. */
export type StoryVoxel = {
  ix: number
  iz: number
  iy: number
}

export function cellStoryVoxels(cell: { ix: number; iz: number; height: number }): StoryVoxel[] {
  const count = Math.max(0, Math.floor(cell.height))
  const voxels: StoryVoxel[] = []
  for (let iy = 0; iy < count; iy++) voxels.push({ ix: cell.ix, iz: cell.iz, iy })
  return voxels
}

/** A face is open when the adjacent lot has no voxel at this story. */
export function storyFaceOpen(iy: number, neighbor: { height: number } | null) {
  return !neighbor || iy >= neighbor.height
}

/** Brick mill swatches (bulk). Landmarks override to rusted metal via uShell. */
export const TOWN_SWATCHES = [
  { id: 'brick', label: 'Brick', plaster: '#6e3f34', glow: '#d8b878' },
  { id: 'clinker', label: 'Clinker', plaster: '#5a322c', glow: '#d8b878' },
  { id: 'terracotta', label: 'Terracotta', plaster: '#7a4a3a', glow: '#d8b878' },
  { id: 'soot', label: 'Soot brick', plaster: '#3e2a26', glow: '#d8b878' },
] as const
const LANDMARK_METAL = '#5c4034'

type V = [number, number, number]
type RGB = [number, number, number]

const plasterRgb = TOWN_SWATCHES.map((swatch) => {
  const c = new Color(swatch.plaster)
  return [c.r, c.g, c.b] as RGB
})
/** Shared dim amber/incandescent for inhabited window strips — not swatch neon. */
const PRACTICAL_GLOW: RGB = (() => {
  const c = new Color('#d8b878')
  return [c.r * 0.55, c.g * 0.55, c.b * 0.55] as RGB
})()

function pushQuad(
  dst: number[],
  nrm: number[],
  col: number[],
  edge: number[],
  a: V,
  b: V,
  c: V,
  d: V,
  rgb: RGB,
  outwardFrom: V,
  metal = false,
) {
  const ax = b[0] - a[0]
  const ay = b[1] - a[1]
  const az = b[2] - a[2]
  const bx = c[0] - a[0]
  const by = c[1] - a[1]
  const bz = c[2] - a[2]
  let nx = ay * bz - az * by
  let ny = az * bx - ax * bz
  let nz = ax * by - ay * bx
  const len = Math.hypot(nx, ny, nz) || 1
  nx /= len
  ny /= len
  nz /= len
  const toward =
    nx * (a[0] - outwardFrom[0]) + ny * (a[1] - outwardFrom[1]) + nz * (a[2] - outwardFrom[2])
  const flip = toward < 0
  const tris = flip
    ? [
        [a, c, b],
        [a, d, c],
      ]
    : [
        [a, b, c],
        [a, c, d],
      ]
  const fn = flip ? ([-nx, -ny, -nz] as V) : ([nx, ny, nz] as V)
  const mark = metal ? 1 : 0
  for (const [p, q, r] of tris) {
    for (const v of [p, q, r]) {
      dst.push(v[0], v[1], v[2])
      nrm.push(fn[0], fn[1], fn[2])
      col.push(rgb[0], rgb[1], rgb[2])
      edge.push(mark)
    }
  }
}

function toGeo(pos: number[], nrm: number[], col: number[], edge: number[], drape?: number[]) {
  const geo = new BufferGeometry()
  if (pos.length > 0) {
    const count = pos.length / 3
    const noise = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      // Hashed mottling — linear (x,z) fields make parallel "plank" iso-bands on roofs.
      const x = pos[i * 3]!
      const y = pos[i * 3 + 1]!
      const z = pos[i * 3 + 2]!
      const n =
        Math.sin(x * 127.1 + z * 311.7 + y * 74.7) * 43758.5453 +
        Math.sin(x * 269.5 + z * 183.3) * 23421.631
      noise[i] = n - Math.floor(n)
    }
    const edgeData = edge.length === count ? edge : new Float32Array(count)
    const drapeData = drape && drape.length === count * 3 ? drape : new Float32Array(count * 3)
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
    geo.setAttribute('normal', new Float32BufferAttribute(nrm, 3))
    geo.setAttribute('color', new Float32BufferAttribute(col, 3))
    geo.setAttribute('aEdge', new Float32BufferAttribute(edgeData, 1))
    geo.setAttribute('aNoise', new Float32BufferAttribute(noise, 1))
    geo.setAttribute('aDrape', new Float32BufferAttribute(drapeData, 3))
  }
  return geo
}

/** One window opening’s glazing meta — order is fail-bay → adjacent → opposite, then lower story first. */
export type GlassPane = {
  side: number
  story: number
  sideDist: number
  order: number
  crackAt: number
  breakAt: number
}

type GlassDraft = {
  side: number
  story: number
  sideDist: number
  vertStart: number
  vertCount: number
}

function pushGlassQuad(
  dst: number[],
  nrm: number[],
  a: V,
  b: V,
  c: V,
  d: V,
  outwardFrom: V,
) {
  const ax = b[0] - a[0]
  const ay = b[1] - a[1]
  const az = b[2] - a[2]
  const bx = c[0] - a[0]
  const by = c[1] - a[1]
  const bz = c[2] - a[2]
  let nx = ay * bz - az * by
  let ny = az * bx - ax * bz
  let nz = ax * by - ay * bx
  const len = Math.hypot(nx, ny, nz) || 1
  nx /= len
  ny /= len
  nz /= len
  const toward =
    nx * (a[0] - outwardFrom[0]) + ny * (a[1] - outwardFrom[1]) + nz * (a[2] - outwardFrom[2])
  const flip = toward < 0
  const tris = flip
    ? [
        [a, c, b],
        [a, d, c],
      ]
    : [
        [a, b, c],
        [a, c, d],
      ]
  const fn = flip ? ([-nx, -ny, -nz] as V) : ([nx, ny, nz] as V)
  for (const [p, q, r] of tris) {
    for (const v of [p, q, r]) {
      dst.push(v[0], v[1], v[2])
      nrm.push(fn[0], fn[1], fn[2])
    }
  }
  return 6
}

function toGlassGeo(pos: number[], nrm: number[], order: number[], sideDist: number[]) {
  const geo = new BufferGeometry()
  if (pos.length > 0) {
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
    geo.setAttribute('normal', new Float32BufferAttribute(nrm, 3))
    geo.setAttribute('aOrder', new Float32BufferAttribute(order, 1))
    geo.setAttribute('aSideDist', new Float32BufferAttribute(sideDist, 1))
  }
  return geo
}

function faceLetter(side: number) {
  const name = SIDE_NAMES[side] ?? 'south'
  return name.charAt(0).toUpperCase()
}

type Side = { open: boolean; neighbor: TownCell | null; a: XZ; b: XZ; inward: XZ }

function lotSides(
  cell: TownCell,
  around: Array<TownCell | null>,
  layout: GridLayout,
  iy: number,
  corners?: XZ[],
): Side[] {
  const ring = corners ?? cellCorners(cell.ix, cell.iz, layout)
  const [cx, cz] = cellCentroid(cell.ix, cell.iz, layout)
  return ring.map((a, i) => {
    const b = ring[(i + 1) % 4]!
    const mx = (a[0] + b[0]) / 2
    const mz = (a[1] + b[1]) / 2
    const vx = cx - mx
    const vz = cz - mz
    const len = Math.hypot(vx, vz) || 1
    const neighbor = around[i] ?? null
    return {
      open: storyFaceOpen(iy, neighbor),
      neighbor,
      a,
      b,
      inward: [vx / len, vz / len] as XZ,
    }
  })
}

function addColumn(
  pos: number[],
  nrm: number[],
  col: number[],
  edge: number[],
  x: number,
  z: number,
  y0: number,
  y1: number,
  rgb: RGB,
) {
  const steps = 10
  const center: V = [x, (y0 + y1) / 2, z]
  for (let i = 0; i < steps; i++) {
    const a0 = (i / steps) * Math.PI * 2
    const a1 = ((i + 1) / steps) * Math.PI * 2
    const p0: V = [x + Math.cos(a0) * COLUMN_R, y0, z + Math.sin(a0) * COLUMN_R]
    const p1: V = [x + Math.cos(a1) * COLUMN_R, y0, z + Math.sin(a1) * COLUMN_R]
    const p2: V = [p1[0], y1, p1[2]]
    const p3: V = [p0[0], y1, p0[2]]
    pushQuad(pos, nrm, col, edge, p0, p1, p2, p3, rgb, center, true)
  }
  const cap = Array.from({ length: steps }, (_, i) => {
    const a = (i / steps) * Math.PI * 2
    return [x + Math.cos(a) * COLUMN_R, y1, z + Math.sin(a) * COLUMN_R] as V
  })
  for (let i = 1; i < steps - 1; i++) {
    pushQuad(pos, nrm, col, edge, cap[0], cap[i], cap[i + 1], cap[0], rgb, [x, y0, z], true)
  }
}

function addArchWall(
  pos: number[],
  nrm: number[],
  col: number[],
  edge: number[],
  gpos: number[],
  gnrm: number[],
  gcol: number[],
  jpos: number[],
  jnrm: number[],
  drafts: GlassDraft[],
  side: Side,
  sideIndex: number,
  story: number,
  failSide: number,
  y0: number,
  y1: number,
  rgb: RGB,
  glow: RGB,
  withOpening: boolean,
) {
  const span: V = [side.b[0] - side.a[0], 0, side.b[1] - side.a[1]]
  const length = Math.hypot(span[0], span[2]) || 1
  const tx = span[0] / length
  const tz = span[2] / length
  const cut = COLUMN_R * 1.15
  const x0 = side.a[0] + tx * cut
  const z0 = side.a[1] + tz * cut
  const x1 = side.b[0] - tx * cut
  const z1 = side.b[1] - tz * cut
  const inn = side.inward
  const yMid = y0 + (y1 - y0) * 0.62
  const center: V = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]

  const prism = (ax: number, az: number, bx: number, bz: number, ya: number, yb: number, metalTop = false) => {
    const a0: V = [ax, ya, az]
    const b0: V = [bx, ya, bz]
    const a1: V = [ax, yb, az]
    const b1: V = [bx, yb, bz]
    const ai0: V = [ax + inn[0] * WALL_T, ya, az + inn[1] * WALL_T]
    const bi0: V = [bx + inn[0] * WALL_T, ya, bz + inn[1] * WALL_T]
    const ai1: V = [ai0[0], yb, ai0[2]]
    const bi1: V = [bi0[0], yb, bi0[2]]
    pushQuad(pos, nrm, col, edge, a0, b0, b1, a1, rgb, center)
    pushQuad(pos, nrm, col, edge, ai0, ai1, bi1, bi0, rgb, center)
    pushQuad(pos, nrm, col, edge, a1, b1, bi1, ai1, rgb, [center[0], ya - 1, center[2]], metalTop)
    pushQuad(pos, nrm, col, edge, a0, ai0, bi0, b0, rgb, [center[0], yb + 1, center[2]])
  }

  if (!withOpening) {
    prism(x0, z0, x1, z1, y0, y1)
    return
  }

  const leftX = x0 + (x1 - x0) * 0.22
  const leftZ = z0 + (z1 - z0) * 0.22
  const rightX = x0 + (x1 - x0) * 0.78
  const rightZ = z0 + (z1 - z0) * 0.78
  prism(x0, z0, leftX, leftZ, y0, y1)
  prism(rightX, rightZ, x1, z1, y0, y1)
  prism(leftX, leftZ, rightX, rightZ, yMid, y1)

  const archSteps = 8
  for (let i = 0; i < archSteps; i++) {
    const t0 = Math.PI - (i / archSteps) * Math.PI
    const t1 = Math.PI - ((i + 1) / archSteps) * Math.PI
    const u0 = (Math.cos(t0) * -1 + 1) / 2
    const u1 = (Math.cos(t1) * -1 + 1) / 2
    const h0 = Math.sin(t0) * (yMid - y0) * 0.92
    const h1 = Math.sin(t1) * (yMid - y0) * 0.92
    const ax = leftX + (rightX - leftX) * u0
    const az = leftZ + (rightZ - leftZ) * u0
    const bx = leftX + (rightX - leftX) * u1
    const bz = leftZ + (rightZ - leftZ) * u1
    prism(ax, az, bx, bz, y0 + Math.min(h0, h1), y0 + Math.max(h0, h1) + WALL_T, true)
    const slit: V = [ax + inn[0] * (WALL_T + 0.02), y0 + (h0 + h1) / 2, az + inn[1] * (WALL_T + 0.02)]
    const slitB: V = [bx + inn[0] * (WALL_T + 0.02), slit[1], bz + inn[1] * (WALL_T + 0.02)]
    const slitT: V = [slitB[0], slit[1] + 0.05, slitB[2]]
    const slitT0: V = [slit[0], slit[1] + 0.05, slit[2]]
    pushQuad(gpos, gnrm, gcol, [], slit, slitB, slitT, slitT0, glow, [center[0] - inn[0], center[1], center[2] - inn[1]])
  }

  // Doorway cues: threshold + darkened interior plane so the arch reads as an
  // entrance, not a tunnel through an empty shell (common with street-open faces).
  {
    const threshH = 0.055
    const threshD = WALL_T + 0.1
    const t0: V = [leftX, y0, leftZ]
    const t1: V = [rightX, y0, rightZ]
    const t2: V = [rightX + inn[0] * threshD, y0, rightZ + inn[1] * threshD]
    const t3: V = [leftX + inn[0] * threshD, y0, leftZ + inn[1] * threshD]
    pushQuad(pos, nrm, col, edge, t0, t1, t2, t3, rgb, [center[0], y0 + 1, center[2]])
    const t0b: V = [leftX, y0 + threshH, leftZ]
    const t1b: V = [rightX, y0 + threshH, rightZ]
    const t2b: V = [rightX + inn[0] * threshD, y0 + threshH, rightZ + inn[1] * threshD]
    const t3b: V = [leftX + inn[0] * threshD, y0 + threshH, leftZ + inn[1] * threshD]
    pushQuad(pos, nrm, col, edge, t0b, t3b, t2b, t1b, rgb, [center[0], y0 - 1, center[2]])

    const dark: RGB = [0.07, 0.065, 0.06]
    const deep = WALL_T * 2.4
    const d0: V = [leftX + inn[0] * deep, y0 + threshH, leftZ + inn[1] * deep]
    const d1: V = [rightX + inn[0] * deep, y0 + threshH, rightZ + inn[1] * deep]
    const d2: V = [rightX + inn[0] * deep, yMid - 0.02, rightZ + inn[1] * deep]
    const d3: V = [leftX + inn[0] * deep, yMid - 0.02, leftZ + inn[1] * deep]
    pushQuad(pos, nrm, col, edge, d0, d1, d2, d3, dark, center)
  }

  // Thin glazing plane in the ground-story opening (not a dark void at held).
  {
    const inset = WALL_T * 0.55
    const gy0 = y0 + 0.06
    const gy1 = yMid - 0.04
    const ga: V = [leftX + inn[0] * inset, gy0, leftZ + inn[1] * inset]
    const gb: V = [rightX + inn[0] * inset, gy0, rightZ + inn[1] * inset]
    const gc: V = [rightX + inn[0] * inset, gy1, rightZ + inn[1] * inset]
    const gd: V = [leftX + inn[0] * inset, gy1, leftZ + inn[1] * inset]
    const vertStart = jpos.length / 3
    const vertCount = pushGlassQuad(jpos, jnrm, ga, gb, gc, gd, center)
    drafts.push({
      side: sideIndex,
      story,
      sideDist: sideDistFromFail(sideIndex, failSide),
      vertStart,
      vertCount,
    })
  }

  const wx0 = leftX + (rightX - leftX) * 0.35
  const wz0 = leftZ + (rightZ - leftZ) * 0.35
  const wx1 = leftX + (rightX - leftX) * 0.65
  const wz1 = leftZ + (rightZ - leftZ) * 0.65
  const wy = yMid + (y1 - yMid) * 0.45
  const glowY = 0.07
  const face = (y: number, lift: number): [V, V, V, V] => {
    const s = 1 + lift
    const a: V = [wx0 + inn[0] * WALL_T * s, y, wz0 + inn[1] * WALL_T * s]
    const b: V = [wx1 + inn[0] * WALL_T * s, y, wz1 + inn[1] * WALL_T * s]
    return [a, b, [b[0], y + glowY, b[2]], [a[0], y + glowY, a[2]]]
  }
  const core = face(wy, 1.05)
  pushQuad(gpos, gnrm, gcol, [], core[0], core[1], core[2], core[3], glow, center)
  const halo = face(wy - 0.04, 1.8)
  const dim: RGB = [glow[0] * 0.22, glow[1] * 0.22, glow[2] * 0.22]
  pushQuad(gpos, gnrm, gcol, [], halo[0], halo[1], halo[2], halo[3], dim, center)
}

function addWindowWall(
  pos: number[],
  nrm: number[],
  col: number[],
  edge: number[],
  gpos: number[],
  gnrm: number[],
  gcol: number[],
  jpos: number[],
  jnrm: number[],
  drafts: GlassDraft[],
  side: Side,
  sideIndex: number,
  story: number,
  failSide: number,
  y0: number,
  y1: number,
  rgb: RGB,
  glow: RGB,
) {
  const span: V = [side.b[0] - side.a[0], 0, side.b[1] - side.a[1]]
  const length = Math.hypot(span[0], span[2]) || 1
  const tx = span[0] / length
  const tz = span[2] / length
  const cut = COLUMN_R * 1.15
  const x0 = side.a[0] + tx * cut
  const z0 = side.a[1] + tz * cut
  const x1 = side.b[0] - tx * cut
  const z1 = side.b[1] - tz * cut
  const inn = side.inward
  const center: V = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]
  const prism = (ax: number, az: number, bx: number, bz: number, ya: number, yb: number) => {
    const a0: V = [ax, ya, az]
    const b0: V = [bx, ya, bz]
    const a1: V = [ax, yb, az]
    const b1: V = [bx, yb, bz]
    const ai0: V = [ax + inn[0] * WALL_T, ya, az + inn[1] * WALL_T]
    const bi0: V = [bx + inn[0] * WALL_T, ya, bz + inn[1] * WALL_T]
    const ai1: V = [ai0[0], yb, ai0[2]]
    const bi1: V = [bi0[0], yb, bi0[2]]
    pushQuad(pos, nrm, col, edge, a0, b0, b1, a1, rgb, center)
    pushQuad(pos, nrm, col, edge, ai0, ai1, bi1, bi0, rgb, center)
    pushQuad(pos, nrm, col, edge, a1, b1, bi1, ai1, rgb, [center[0], ya - 1, center[2]], true)
    pushQuad(pos, nrm, col, edge, a0, ai0, bi0, b0, rgb, [center[0], yb + 1, center[2]])
  }
  const sill = y0 + (y1 - y0) * 0.38
  const head = y0 + (y1 - y0) * 0.74
  const leftX = x0 + (x1 - x0) * 0.3
  const leftZ = z0 + (z1 - z0) * 0.3
  const rightX = x0 + (x1 - x0) * 0.7
  const rightZ = z0 + (z1 - z0) * 0.7
  prism(x0, z0, x1, z1, y0, sill)
  prism(x0, z0, leftX, leftZ, sill, head)
  prism(rightX, rightZ, x1, z1, sill, head)
  prism(x0, z0, x1, z1, head, y1)

  // Full opening glazing plane — reads as glass at held, not a hole.
  {
    const inset = WALL_T * 0.55
    const gy0 = sill + 0.02
    const gy1 = head - 0.02
    const ga: V = [leftX + inn[0] * inset, gy0, leftZ + inn[1] * inset]
    const gb: V = [rightX + inn[0] * inset, gy0, rightZ + inn[1] * inset]
    const gc: V = [rightX + inn[0] * inset, gy1, rightZ + inn[1] * inset]
    const gd: V = [leftX + inn[0] * inset, gy1, leftZ + inn[1] * inset]
    const vertStart = jpos.length / 3
    const vertCount = pushGlassQuad(jpos, jnrm, ga, gb, gc, gd, center)
    drafts.push({
      side: sideIndex,
      story,
      sideDist: sideDistFromFail(sideIndex, failSide),
      vertStart,
      vertCount,
    })
  }

  const glowY = sill + (head - sill) * 0.35
  const a: V = [leftX + inn[0] * (WALL_T + 0.02), glowY, leftZ + inn[1] * (WALL_T + 0.02)]
  const b: V = [rightX + inn[0] * (WALL_T + 0.02), glowY, rightZ + inn[1] * (WALL_T + 0.02)]
  pushQuad(
    gpos,
    gnrm,
    gcol,
    [],
    a,
    b,
    [b[0], b[1] + 0.08, b[2]],
    [a[0], a[1] + 0.08, a[2]],
    glow,
    center,
  )
}

function addStairs(
  pos: number[],
  nrm: number[],
  col: number[],
  edge: number[],
  side: Side,
  yLow: number,
  yHigh: number,
  rgb: RGB,
) {
  const steps = Math.min(7, Math.max(3, Math.ceil((yHigh - yLow) / 0.24)))
  const [cx, , cz] = [side.inward[0], 0, side.inward[1]]
  const center: V = [(side.a[0] + side.b[0]) / 2, (yLow + yHigh) / 2, (side.a[1] + side.b[1]) / 2]
  for (let s = 0; s < steps; s++) {
    const t0 = s / steps
    const t1 = (s + 1) / steps
    const yA = yLow + (yHigh - yLow) * t0
    const yB = yLow + (yHigh - yLow) * t1
    const d0 = 0.18 + t0 * 0.7
    const d1 = 0.18 + t1 * 0.7
    const a0: V = [side.a[0] + cx * d0, yB, side.a[1] + cz * d0]
    const b0: V = [side.b[0] + cx * d0, yB, side.b[1] + cz * d0]
    const a1: V = [side.a[0] + cx * d1, yB, side.a[1] + cz * d1]
    const b1: V = [side.b[0] + cx * d1, yB, side.b[1] + cz * d1]
    pushQuad(pos, nrm, col, edge, a0, b0, b1, a1, rgb, [center[0], yA - 1, center[2]])
    pushQuad(pos, nrm, col, edge, a0, a1, [a1[0], yA, a1[2]], [a0[0], yA, a0[2]], rgb, center)
  }
}

/** Shrink lot corners toward centroid — landmarks read narrower than mill lots. */
function scaledCorners(ix: number, iz: number, layout: GridLayout, fit: number): XZ[] {
  const [cx, cz] = cellCentroid(ix, iz, layout)
  return cellCorners(ix, iz, layout).map(
    (p) => [cx + (p[0] - cx) * fit, cz + (p[1] - cz) * fit] as XZ,
  )
}

function addRoof(
  pos: number[],
  nrm: number[],
  col: number[],
  edge: number[],
  _gpos: number[],
  _gnrm: number[],
  _gcol: number[],
  cell: TownCell,
  rgb: RGB,
  _glow: RGB,
  showVent: boolean,
  layout: GridLayout,
  landmark: boolean,
  corners: XZ[],
) {
  const [cx, cz] = cellCentroid(cell.ix, cell.iz, layout)
  const y = cell.baseY + cell.height * TOWN_STORY
  // Low parapet flush to the lot edge — boxy warehouse deck, not a beveled crystal crown.
  const outer = corners.map((p) => [p[0] + (cx - p[0]) * 0.02, p[1] + (cz - p[1]) * 0.02] as XZ)
  const inner = outer.map((p) => [p[0] + (cx - p[0]) * 0.06, p[1] + (cz - p[1]) * 0.06] as XZ)
  const thickness = 0.1
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4
    const o0: V = [outer[i][0], y, outer[i][1]]
    const o1: V = [outer[j][0], y, outer[j][1]]
    const i0: V = [inner[i][0], y + thickness, inner[i][1]]
    const i1: V = [inner[j][0], y + thickness, inner[j][1]]
    pushQuad(pos, nrm, col, edge, o0, o1, i1, i0, rgb, [cx, y - 1, cz], false)
  }
  const top = inner.map((p) => [p[0], y + thickness, p[1]] as V)
  pushQuad(pos, nrm, col, edge, top[0], top[1], top[2], top[3], rgb, [cx, y - 1, cz], false)

  if (!showVent) return
  const metal: RGB = [
    Math.min(1, rgb[0] * 0.7 + 0.1),
    Math.min(1, rgb[1] * 0.65 + 0.08),
    Math.min(1, rgb[2] * 0.6 + 0.06),
  ]
  if (landmark) {
    // Smokestack / silo — short industrial accent, not a skyline spike.
    const s = 0.1
    const stackH = 0.42
    const mast: V[] = [
      [cx - s, y + thickness, cz - s],
      [cx + s, y + thickness, cz - s],
      [cx + s, y + thickness + stackH, cz + s],
      [cx - s, y + thickness + stackH, cz - s],
    ]
    pushQuad(pos, nrm, col, edge, mast[0], mast[1], mast[2], mast[3], metal, [cx, y, cz], true)
    const lip = s * 1.35
    const cap: V[] = [
      [cx - lip, y + thickness + stackH, cz - lip],
      [cx + lip, y + thickness + stackH, cz - lip],
      [cx + lip, y + thickness + stackH + 0.06, cz + lip],
      [cx - lip, y + thickness + stackH + 0.06, cz + lip],
    ]
    pushQuad(pos, nrm, col, edge, cap[0], cap[1], cap[2], cap[3], metal, [cx, y, cz], true)
  } else {
    const s = 0.16
    const tankH = 0.14
    const mast: V[] = [
      [cx - s, y + thickness, cz - s],
      [cx + s, y + thickness, cz - s],
      [cx + s, y + thickness + tankH, cz + s],
      [cx - s, y + thickness + tankH, cz - s],
    ]
    pushQuad(pos, nrm, col, edge, mast[0], mast[1], mast[2], mast[3], metal, [cx, y, cz], true)
    const cap: V[] = [
      [cx - s * 1.05, y + thickness + tankH, cz - s * 1.05],
      [cx + s * 1.05, y + thickness + tankH, cz - s * 1.05],
      [cx + s * 1.05, y + thickness + tankH + 0.03, cz + s * 1.05],
      [cx - s * 1.05, y + thickness + tankH + 0.03, cz + s * 1.05],
    ]
    pushQuad(pos, nrm, col, edge, cap[0], cap[1], cap[2], cap[3], metal, [cx, y, cz], true)
  }
}

function addFlatCourt(
  pos: number[],
  nrm: number[],
  col: number[],
  edge: number[],
  cell: TownCell,
  y: number,
  rgb: RGB,
  layout: GridLayout,
) {
  const [cx, cz] = cellCentroid(cell.ix, cell.iz, layout)
  const corners = cellCorners(cell.ix, cell.iz, layout)
  const ring = corners.map((p) => [p[0] + (cx - p[0]) * 0.04, p[1] + (cz - p[1]) * 0.04] as XZ)
  const hole = ring.map((p) => [p[0] + (cx - p[0]) * 0.42, p[1] + (cz - p[1]) * 0.42] as XZ)
  const top = y + 0.08
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4
    const o0: V = [ring[i][0], top, ring[i][1]]
    const o1: V = [ring[j][0], top, ring[j][1]]
    const i0: V = [hole[i][0], top, hole[i][1]]
    const i1: V = [hole[j][0], top, hole[j][1]]
    pushQuad(pos, nrm, col, edge, o0, o1, i1, i0, rgb, [cx, y - 1, cz])
    pushQuad(
      pos,
      nrm,
      col,
      edge,
      [ring[i][0], y, ring[i][1]],
      [ring[j][0], y, ring[j][1]],
      o1,
      o0,
      rgb,
      [cx, y - 1, cz],
    )
  }
}

function addShedRoof(
  pos: number[],
  nrm: number[],
  col: number[],
  edge: number[],
  _gpos: number[],
  _gnrm: number[],
  _gcol: number[],
  cell: TownCell,
  sides: Side[],
  y: number,
  rgb: RGB,
  _glow: RGB,
  layout: GridLayout,
) {
  const [cx, cz] = cellCentroid(cell.ix, cell.iz, layout)
  const corners = cellCorners(cell.ix, cell.iz, layout)
  // Shallow industrial slope (factory/warehouse), not a steep residential gable.
  const yLow = y + 0.04
  const yHigh = y + 0.16
  const heights = corners.map((_, k) => {
    const prevClosed = sides[(k + 3) % 4].open ? 0 : 1
    const nextClosed = sides[k].open ? 0 : 1
    return yLow + (yHigh - yLow) * ((prevClosed + nextClosed) / 2)
  })
  const inset = corners.map((p) => [p[0] + (cx - p[0]) * 0.03, p[1] + (cz - p[1]) * 0.03] as XZ)
  const top = inset.map((p, i) => [p[0], heights[i], p[1]] as V)
  // Shed deck + eaves: same plaster wear as walls (no aEdge metal → no rust-stripe planks).
  pushQuad(pos, nrm, col, edge, top[0], top[1], top[2], top[3], rgb, [cx, y - 1, cz], false)
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4
    const c = corners[i]
    pushQuad(
      pos,
      nrm,
      col,
      edge,
      [c[0], y, c[1]],
      [corners[j][0], y, corners[j][1]],
      [inset[j][0], heights[j], inset[j][1]],
      [inset[i][0], heights[i], inset[i][1]],
      rgb,
      [cx, y - 1, cz],
      false,
    )
  }
  let hi = 0
  for (let i = 1; i < heights.length; i++) if (heights[i] > heights[hi]) hi = i
  const c = inset[hi]
  const s = 0.12
  const base = heights[hi]
  const metal: RGB = [
    Math.min(1, rgb[0] * 0.75 + 0.08),
    Math.min(1, rgb[1] * 0.75 + 0.08),
    Math.min(1, rgb[2] * 0.75 + 0.08),
  ]
  const box: V[] = [
    [c[0] - s, base, c[1] - s],
    [c[0] + s, base, c[1] - s],
    [c[0] + s, base + 0.11, c[1] + s],
    [c[0] - s, base + 0.11, c[1] + s],
  ]
  pushQuad(pos, nrm, col, edge, box[0], box[1], box[2], box[3], metal, [cx, y, cz], true)
}

type LotNeighbors = {
  south: TownCell | null
  east: TownCell | null
  north: TownCell | null
  west: TownCell | null
}

function addTarp(cell: TownCell, layout: GridLayout, neighbors: CardinalNeighbors) {
  const pos: number[] = []
  const nrm: number[] = []
  const col: number[] = []
  const edge: number[] = []
  const drape: number[] = []
  // Worn canvas — lit via material; vertex rgb unused (tarp mat is not vertexColored).
  const rgb: RGB = [0.72, 0.66, 0.52]
  const corners = cellCorners(cell.ix, cell.iz, layout)
  const [cx, cz] = cellCentroid(cell.ix, cell.iz, layout)
  const open = openSidesAtLot(neighbors)
  const plan = tarpPlan(cell.height, open, layout.cellSize, layout.buildingScale ?? 3)
  const y = cell.baseY + cell.height * TOWN_STORY + 0.12
  const span = Math.min(0.4, Math.max(0.18, plan.edgeSpan))

  const sheet = (i: number) => {
    const a = corners[i]!
    const b = corners[(i + 1) % 4]!
    // Centered patch — not the full roof edge.
    const t0 = 0.5 - span * 0.5
    const t1 = 0.5 + span * 0.5
    const pA: XZ = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0]
    const pB: XZ = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1]
    const mx = (pA[0] + pB[0]) / 2
    const mz = (pA[1] + pB[1]) / 2
    let ox = mx - cx
    let oz = mz - cz
    const len = Math.hypot(ox, oz) || 1
    ox /= len
    oz /= len
    const hang = plan.hang
    const flare = plan.flare
    const droop = plan.droop
    const a0: V = [pA[0], y, pA[1]]
    const b0: V = [pB[0], y, pB[1]]
    const mid: V = [mx, y, mz]
    const a1: V = [pA[0] + ox * flare, y - hang, pA[1] + oz * flare]
    const b1: V = [pB[0] + ox * flare * 0.9, y - hang * 0.92, pB[1] + oz * flare * 0.9]
    const low: V = [mx + ox * (flare + 0.04), y - hang - droop, mz + oz * (flare + 0.04)]
    for (const [p, q, r, s] of [
      [a0, mid, low, a1],
      [mid, b0, b1, low],
    ] as Array<[V, V, V, V]>) {
      const before = pos.length
      pushQuad(pos, nrm, col, edge, p, q, r, s, rgb, [cx, y - 1, cz])
      const written = (pos.length - before) / 3
      for (let v = 0; v < written; v++) {
        const px = pos[before + v * 3]!
        const py = pos[before + v * 3 + 1]!
        const pz = pos[before + v * 3 + 2]!
        const roof = py > y - 0.04
        const ax = roof ? px : mx
        const ay = roof ? py : y
        const az = roof ? pz : mz
        drape.push(ax - px, ay - py, az - pz)
      }
    }
  }

  for (const i of plan.sides) sheet(i)
  return toGeo(pos, nrm, col, edge, drape)
}

/** The lot quad itself. Building scale does not widen this, so neighbors cannot occupy the same ground. */
function lotFootprint(ix: number, iz: number, layout: GridLayout): XZ[] {
  return cellCorners(ix, iz, layout)
}

/**
 * Highest terrain sample under the house. The floor sits on that height.
 * The foundation then drops to the slope below it.
 */
export function lotFloor(
  ix: number,
  iz: number,
  layout: GridLayout,
  heightAt: (x: number, z: number) => number,
) {
  const poly = lotFootprint(ix, iz, layout)
  const [cx, cz] = cellCentroid(ix, iz, layout)
  let max = heightAt(cx, cz)
  const consider = (x: number, z: number) => {
    const y = heightAt(x, z)
    if (y > max) max = y
  }
  for (let i = 0; i < 4; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % 4]
    for (let s = 0; s <= 4; s++) {
      const t = s / 4
      consider(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
    }
    consider((a[0] + cx) / 2, (a[1] + cz) / 2)
  }
  return max
}

/** How far the skirt digs under the meshed ground so the chord of a quad cannot show a gap. */
const FOUNDATION_BURY = 0.75

function buildFoundation(
  ix: number,
  iz: number,
  layout: GridLayout,
  floor: number,
  heightAt: (x: number, z: number) => number,
  rgb: RGB,
) {
  const poly = lotFootprint(ix, iz, layout)
  const [cx, cz] = cellCentroid(ix, iz, layout)
  const pos: number[] = []
  const nrm: number[] = []
  const col: number[] = []
  const edge: number[] = []
  const steps = 8
  const ring: Array<[number, number, number]> = []
  for (let i = 0; i < 4; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % 4]
    for (let s = 0; s < steps; s++) {
      const t = s / steps
      const x = a[0] + (b[0] - a[0]) * t
      const z = a[1] + (b[1] - a[1]) * t
      const dx = cx - x
      const dz = cz - z
      const len = Math.hypot(dx, dz) || 1
      ring.push([x + (dx / len) * 0.04, heightAt(x, z), z + (dz / len) * 0.04])
    }
  }
  const top = floor + 0.04
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    const a0: V = [a[0], top, a[2]]
    const b0: V = [b[0], top, b[2]]
    const b1: V = [b[0], b[1] - FOUNDATION_BURY, b[2]]
    const a1: V = [a[0], a[1] - FOUNDATION_BURY, a[2]]
    pushQuad(pos, nrm, col, edge, a0, b0, b1, a1, rgb, [cx, floor, cz])
  }
  return toGeo(pos, nrm, col, edge)
}

/** Sparse scrap piles at the fail-bay footing — process leftovers, not landscaping. */
function addBaseDebris(cell: TownCell, layout: GridLayout, failSide: number) {
  const pos: number[] = []
  const nrm: number[] = []
  const col: number[] = []
  const edge: number[] = []
  const scrap: RGB = [0.38, 0.34, 0.3]
  const corners = cellCorners(cell.ix, cell.iz, layout)
  const [cx, cz] = cellCentroid(cell.ix, cell.iz, layout)
  const a = corners[failSide]!
  const b = corners[(failSide + 1) % 4]!
  const y0 = cell.baseY + 0.02
  const piles = [
    { t: 0.22, s: 0.11, h: 0.07 },
    { t: 0.55, s: 0.14, h: 0.09 },
    { t: 0.78, s: 0.09, h: 0.05 },
  ]
  for (const pile of piles) {
    const px = a[0] + (b[0] - a[0]) * pile.t
    const pz = a[1] + (b[1] - a[1]) * pile.t
    let ox = px - cx
    let oz = pz - cz
    const len = Math.hypot(ox, oz) || 1
    ox = (ox / len) * 0.1
    oz = (oz / len) * 0.1
    const x = px + ox
    const z = pz + oz
    const hs = pile.s * 0.5
    const box: [V, V, V, V] = [
      [x - hs, y0, z - hs],
      [x + hs, y0, z - hs],
      [x + hs, y0 + pile.h, z + hs],
      [x - hs, y0 + pile.h, z + hs],
    ]
    pushQuad(pos, nrm, col, edge, box[0], box[1], box[2], box[3], scrap, [cx, y0, cz])
  }
  return toGeo(pos, nrm, col, edge)
}

export function buildLotGeometry(
  cell: TownCell,
  neighbors: LotNeighbors,
  layout: GridLayout,
  maxStories = 8,
) {
  const pos: number[] = []
  const nrm: number[] = []
  const col: number[] = []
  const edge: number[] = []
  const gpos: number[] = []
  const gnrm: number[] = []
  const gcol: number[] = []
  const jpos: number[] = []
  const jnrm: number[] = []
  const glassDrafts: GlassDraft[] = []
  const landmark = isLandmarkLot(cell.ix, cell.iz, cell.height, maxStories)
  const rgb = landmark
    ? (() => {
        const c = new Color(LANDMARK_METAL)
        return [c.r, c.g, c.b] as RGB
      })()
    : plasterRgb[cell.color] ?? plasterRgb[0]!
  const glow = PRACTICAL_GLOW
  const around = [neighbors.south, neighbors.east, neighbors.north, neighbors.west]
  const cardinal: CardinalNeighbors = neighbors
  const open = openSidesAtLot(cardinal)
  const fail = failFromExposure(open, cell.height, maxStories)
  const voxels = cellStoryVoxels(cell)
  const [cx, cz] = cellCentroid(cell.ix, cell.iz, layout)
  // Landmarks: narrower footprint. Mills: near-full lot (wide mills).
  const corners = scaledCorners(cell.ix, cell.iz, layout, landmark ? 0.78 : 0.96)
  let topSides: Side[] = []

  for (const voxel of voxels) {
    const sides = lotSides(cell, around, layout, voxel.iy, corners)
    const y0 = cell.baseY + voxel.iy * TOWN_STORY
    const y1 = y0 + TOWN_STORY
    topSides = sides

    for (let k = 0; k < 4; k++) {
      const prev = sides[(k + 3) % 4]!
      const next = sides[k]!
      if (prev.open && next.open) {
        const c = corners[k]!
        const insetX = c[0] + (cx - c[0]) * CORNER_INSET
        const insetZ = c[1] + (cz - c[1]) * CORNER_INSET
        addColumn(pos, nrm, col, edge, insetX, insetZ, y0, y1, rgb)
      }
    }

    sides.forEach((side, sideIndex) => {
      if (!side.open) return
      const neighbor = side.neighbor
      if (neighbor && voxel.iy === neighbor.height) {
        const stepLow = neighbor.baseY + neighbor.height * TOWN_STORY
        addStairs(pos, nrm, col, edge, side, stepLow, y1, rgb)
        addArchWall(
          pos, nrm, col, edge, gpos, gnrm, gcol, jpos, jnrm, glassDrafts,
          side, sideIndex, voxel.iy, fail.failSide, stepLow, y1, rgb, glow, false,
        )
        return
      }
      if (voxel.iy === 0) {
        addArchWall(
          pos, nrm, col, edge, gpos, gnrm, gcol, jpos, jnrm, glassDrafts,
          side, sideIndex, voxel.iy, fail.failSide, y0, y1, rgb, glow, true,
        )
        return
      }
      addWindowWall(
        pos, nrm, col, edge, gpos, gnrm, gcol, jpos, jnrm, glassDrafts,
        side, sideIndex, voxel.iy, fail.failSide, y0, y1, rgb, glow,
      )
    })
  }

  const yTop = cell.baseY + cell.height * TOWN_STORY
  const openCount = topSides.filter((side) => side.open).length
  if (openCount === 0) {
    addFlatCourt(pos, nrm, col, edge, cell, yTop, rgb, layout)
  } else if (openCount === 4) {
    addRoof(pos, nrm, col, edge, gpos, gnrm, gcol, cell, rgb, glow, true, layout, landmark, corners)
  } else {
    addShedRoof(pos, nrm, col, edge, gpos, gnrm, gcol, cell, topSides, yTop, rgb, glow, layout)
  }

  // Fail-bay strut/lintel + fire-escape line geometry paused — failSide still drives void + glass order.

  // Fixed break order: fail bay first, then adjacent, then opposite; lower story before higher.
  glassDrafts.sort(
    (a, b) => a.sideDist - b.sideDist || a.story - b.story || a.side - b.side,
  )
  const vertCount = jpos.length / 3
  const orderAttr = new Array(vertCount).fill(0)
  const sideDistAttr = new Array(vertCount).fill(0)
  const panes: GlassPane[] = []
  glassDrafts.forEach((draft, order) => {
    for (let i = 0; i < draft.vertCount; i++) {
      orderAttr[draft.vertStart + i] = order
      sideDistAttr[draft.vertStart + i] = draft.sideDist
    }
    panes.push({
      side: draft.side,
      story: draft.story,
      sideDist: draft.sideDist,
      order,
      crackAt: glassCrackWear(order, draft.sideDist),
      breakAt: glassBreakWear(order, draft.sideDist),
    })
  })

  return {
    plaster: toGeo(pos, nrm, col, edge),
    glow: toGeo(gpos, gnrm, gcol, []),
    glass: toGlassGeo(jpos, jnrm, orderAttr, sideDistAttr),
    panes,
    tarp: addTarp(cell, layout, cardinal),
    debris: addBaseDebris(cell, layout, fail.failSide),
  }
}

const FEED_VERT = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.999, 1.0);
}
`
const FEED_FRAG = /* glsl */ `
uniform float uTime;
uniform float uAmount;
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
void main() {
  vec2 uv = gl_FragCoord.xy;
  float g = hash(floor(uv * 0.45) + floor(uTime * 10.0));
  float edge = smoothstep(48.0, 0.0, min(gl_FragCoord.x, gl_FragCoord.y));
  vec3 col = vec3(g * 0.14 * uAmount);
  col.r += edge * 0.09 * uAmount;
  col.b += edge * 0.04 * uAmount;
  gl_FragColor = vec4(col, 0.42);
}
`

function FeedGrade({ amount }: { amount: number }) {
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
        uniforms: { uTime: { value: 0 }, uAmount: { value: amount } },
        vertexShader: FEED_VERT,
        fragmentShader: FEED_FRAG,
      }),
    [],
  )
  useEffect(() => {
    if (mat.uniforms.uAmount) mat.uniforms.uAmount.value = amount
  }, [mat, amount])
  useEffect(() => () => mat.dispose(), [mat])
  useFrame((_, delta) => {
    if (mat.uniforms.uTime) mat.uniforms.uTime.value += delta
  })
  return (
    <mesh frustumCulled={false} renderOrder={1000} raycast={() => null}>
      <planeGeometry args={[2, 2]} />
      <primitive object={mat} attach="material" />
    </mesh>
  )
}

const LotMesh = memo(function LotMesh({
  cell,
  south,
  east,
  north,
  west,
  cellSize,
  warp,
  buildingScale,
  heightAt,
  decayRef,
  onGlassEvent,
  maxStories = 8,
}: {
  cell: TownCell
  south: TownCell | null
  east: TownCell | null
  north: TownCell | null
  west: TownCell | null
  cellSize: number
  warp: number
  buildingScale: number
  heightAt: (x: number, z: number) => number
  decayRef: { current: DecayParams }
  onGlassEvent?: (line: string) => void
  maxStories?: number
}) {
  const layout = useMemo(
    () => ({ cellSize, warp, buildingScale }),
    [cellSize, warp, buildingScale],
  )
  const floor = useMemo(
    () => lotFloor(cell.ix, cell.iz, layout, heightAt),
    [cell.ix, cell.iz, layout, heightAt],
  )
  const seated = useMemo(() => ({ ...cell, baseY: floor }), [cell, floor])
  const seat = (neighbor: TownCell | null) =>
    neighbor ? { ...neighbor, baseY: lotFloor(neighbor.ix, neighbor.iz, layout, heightAt) } : null
  const built = useMemo(
    () =>
      buildLotGeometry(
        seated,
        { south: seat(south), east: seat(east), north: seat(north), west: seat(west) },
        layout,
        maxStories,
      ),
    [
      seated,
      south,
      east,
      north,
      west,
      layout,
      heightAt,
      floor,
      maxStories,
    ],
  )
  const foundation = useMemo(
    () => buildFoundation(cell.ix, cell.iz, layout, floor, heightAt, plasterRgb[cell.color] ?? plasterRgb[0]),
    [cell.ix, cell.iz, cell.color, layout, floor, heightAt],
  )
  useEffect(() => {
    return () => {
      built.plaster.dispose()
      built.glow.dispose()
      built.glass.dispose()
      built.tarp.dispose()
      built.debris.dispose()
      foundation.dispose()
    }
  }, [built, foundation])

  const wear = useMemo(() => {
    const landmark = isLandmarkLot(cell.ix, cell.iz, cell.height, maxStories)
    const paint = new Color(
      landmark ? LANDMARK_METAL : (TOWN_SWATCHES[cell.color]?.plaster ?? '#6e3f34'),
    )
    const [ox, oz] = cellCentroid(cell.ix, cell.iz, layout)
    const neighbors: CardinalNeighbors = { south, east, north, west }
    const open = openSidesAtLot(neighbors)
    const fail = failFromExposure(open, cell.height, maxStories)
    return createWearUniforms(
      floor,
      0,
      0,
      paint,
      ox,
      oz,
      fail.failSide,
      fail.roofSeed,
      fail.windowSeed,
      landmark ? 1 : 0,
    )
  }, [cell.ix, cell.iz, cell.color, cell.height, floor, layout, south, east, north, west, maxStories])
  const plasterMat = useMemo(() => createPlasterMaterial(wear), [wear])
  const glowMat = useMemo(() => createGlowMaterial(wear), [wear])
  const glassMat = useMemo(() => createGlassMaterial(wear), [wear])
  const tarpMat = useMemo(() => createTarpMaterial(wear), [wear])
  const debrisMat = useMemo(() => createDebrisMaterial(wear), [wear])
  useEffect(() => {
    return () => {
      plasterMat.dispose()
      glowMat.dispose()
      glassMat.dispose()
      tarpMat.dispose()
      debrisMat.dispose()
    }
  }, [plasterMat, glowMat, glassMat, tarpMat, debrisMat])

  const glassStateRef = useRef<Map<number, 'intact' | 'cracked' | 'broken'>>(new Map())
  const onGlassRef = useRef(onGlassEvent)
  onGlassRef.current = onGlassEvent
  useEffect(() => {
    glassStateRef.current = new Map()
  }, [built])

  useFrame(() => {
    const marks = stageMarks(
      decayRef.current.settledAt,
      decayRef.current.abandonedAt,
      decayRef.current.reclaimedAt,
    )
    const w = cellWear(cell.age, marks)
    wear.uWear.value = w
    wear.uWearIntensity.value = decayRef.current.wearIntensity

    const log = onGlassRef.current
    if (!log || built.panes.length === 0) return
    for (const pane of built.panes) {
      const next = glassStateAtWear(w, pane.order, pane.sideDist)
      const prev = glassStateRef.current.get(pane.order)
      if (prev === undefined) {
        // Seed without logging — remount/scrub must not dump every pane as a break event.
        glassStateRef.current.set(pane.order, next)
        continue
      }
      if (next === prev) continue
      glassStateRef.current.set(pane.order, next)
      if (next === 'cracked' || next === 'broken') {
        const verb = next === 'broken' ? 'breaks' : 'cracks'
        const line = `[glass] ${cell.ix},${cell.iz} window (story ${pane.story}, ${faceLetter(pane.side)} face) ${verb} — wear crosses threshold`
        console.info(`[weathering glass] ${line}`)
        log(line)
      }
    }
  })

  const plasterCount = built.plaster.getAttribute('position')?.count ?? 0
  const glowCount = built.glow.getAttribute('position')?.count ?? 0
  const glassCount = built.glass.getAttribute('position')?.count ?? 0
  const tarpCount = built.tarp.getAttribute('position')?.count ?? 0
  const debrisCount = built.debris.getAttribute('position')?.count ?? 0
  const [cx, cz] = cellCentroid(cell.ix, cell.iz, layout)
  const foundationCount = foundation.getAttribute('position')?.count ?? 0
  return (
    <group>
      {foundationCount > 0 ? (
        <mesh geometry={foundation} material={plasterMat} raycast={() => null} />
      ) : null}
      <group name={`lot-${cell.ix},${cell.iz}`} position={[cx, floor, cz]} scale={[1, buildingScale, 1]}>
      <group position={[-cx, -floor, -cz]}>
        {plasterCount > 0 ? <mesh geometry={built.plaster} material={plasterMat} /> : null}
        {tarpCount > 0 ? (
          <mesh geometry={built.tarp} material={tarpMat} raycast={() => null} />
        ) : null}
        {glassCount > 0 ? (
          <mesh geometry={built.glass} material={glassMat} raycast={() => null} />
        ) : null}
        {glowCount > 0 ? <mesh geometry={built.glow} material={glowMat} raycast={() => null} /> : null}
        {debrisCount > 0 ? (
          <mesh geometry={built.debris} material={debrisMat} raycast={() => null} />
        ) : null}
      </group>
      </group>
    </group>
  )
})

/**
 * Phase 2 player edit: claim an empty lot at 1 story, or add one story to a
 * player-owned lot that is still new/held (before it leaves the held stage).
 * Never clears, restores, recolors, or stacks seed/auto shells or aged shells.
 */
export function applyTownClick(
  existing: TownCell | undefined,
  swatch: number,
  place: { ix: number; iz: number; baseY: number },
  maxStories = 8,
  inhabited = false,
  marks: StageThresholds = CELL_STAGE_AT,
): TownCell | null {
  const cap = Math.max(1, Math.floor(maxStories))
  if (existing) {
    if (!existing.playerOwned) return null
    if (cellStage(existing.age, marks) !== 'new') return null
    if (existing.height >= cap) return null
    return { ...existing, height: existing.height + 1 }
  }
  const profile = cellVacateProfile(place.ix, place.iz)
  return {
    ix: place.ix,
    iz: place.iz,
    baseY: place.baseY,
    height: 1,
    color: swatch,
    age: 0,
    inhabited,
    vacateRate: profile.rate,
    playerOwned: true,
  }
}

const TOUCH = [
  [0, 0],
  [GRID_ORTHO.south.dix, GRID_ORTHO.south.diz],
  [GRID_ORTHO.east.dix, GRID_ORTHO.east.diz],
  [GRID_ORTHO.north.dix, GRID_ORTHO.north.diz],
  [GRID_ORTHO.west.dix, GRID_ORTHO.west.diz],
] as const

function neighborColors(map: Map<string, TownCell>, ix: number, iz: number) {
  const colors: number[] = []
  for (const dir of Object.values(GRID_ORTHO)) {
    const neighbor = map.get(gridKey(ix + dir.dix, iz + dir.diz))
    if (neighbor) colors.push(neighbor.color)
  }
  return colors
}

type TownProps = {
  cellsRef: { current: Map<string, TownCell> }
  layout: GridLayout
  editEnabled: boolean
  grain: number
  /** Bumped when the grid map is cleared from outside (Reset Grid). */
  claimRevision: number
  editBridge: MutableRefObject<(ix: number, iz: number, y: number) => void>
  autoGrow: boolean
  autoGrowSeconds: number
  maxStories: number
  /** Terrain height at a world point, matching the ground sheet. */
  heightAt: (x: number, z: number) => number
  /** Terrain height at a cell, matching the ground sheet. */
  groundAt: (ix: number, iz: number) => number
  decay: DecayParams
  /** Incremented by Reset Decay. Zeroes age and leaves the lots in place. */
  decayReset: number
  /** Written every frame. Fog reads this without waiting on React. */
  townDecayRef: MutableRefObject<number>
  onTownDecay: (share: number) => void
  /** Age/stage lines for the viewport overlay. Same strings as the in-scene readout. */
  /** Second arg is always false in v3 (no water reject note). */
  onAgeReadout: (lines: string[], waterNote: boolean) => void
  /** Fired when the set of claimed cells changes. Age ticks do not call this. */
  onSettlement: () => void
  /** Phase 1 intro vs Phase 2 continuous. */
  phase: TownPhase
  /** Intro scrubber time in [0, INTRO_DURATION]. Ignored once ongoing. */
  timelineT: number
  /** Live intro clock (advanced every frame while playing). Prefer over timelineT for ages. */
  timelineClockRef: MutableRefObject<number>
}

export function EpSalvageTown({
  cellsRef,
  layout,
  editEnabled,
  grain,
  claimRevision,
  editBridge,
  autoGrow,
  autoGrowSeconds,
  maxStories,
  heightAt,
  groundAt,
  decay,
  decayReset,
  townDecayRef,
  onTownDecay,
  onAgeReadout,
  onSettlement,
  phase,
  timelineT,
  timelineClockRef,
}: TownProps) {
  const [color, setColor] = useState(0)
  const [lots, setLots] = useState<TownCell[]>([])
  const [ageLines, setAgeLines] = useState<string[]>([])
  /** Recent inhabited flicker on/off events — process log, not per-frame noise. */
  const [flickerLog, setFlickerLog] = useState<string[]>([])
  /** Wear-ordered glass crack/break events — same process log as flicker. */
  const [glassLog, setGlassLog] = useState<string[]>([])
  /** Rule-based claim / seed / massing reasons — same process log as flicker. */
  const [ruleLog, setRuleLog] = useState<string[]>([])
  const colorRef = useRef(color)
  colorRef.current = color
  const pushRuleLog = (line: string) => {
    setRuleLog((prev) => [line, ...prev].slice(0, 20))
  }
  const pushRuleLogRef = useRef(pushRuleLog)
  pushRuleLogRef.current = pushRuleLog
  const groundAtRef = useRef(groundAt)
  groundAtRef.current = groundAt
  const decayRef = useRef(decay)
  decayRef.current = decay
  const maxStoriesRef = useRef(maxStories)
  maxStoriesRef.current = maxStories
  const layoutRef = useRef(layout)
  layoutRef.current = layout
  const heightAtRef = useRef(heightAt)
  heightAtRef.current = heightAt
  const onTownDecayRef = useRef(onTownDecay)
  onTownDecayRef.current = onTownDecay
  const onAgeReadoutRef = useRef(onAgeReadout)
  onAgeReadoutRef.current = onAgeReadout
  const onSettlementRef = useRef(onSettlement)
  onSettlementRef.current = onSettlement
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  // timelineClockRef is owned by WeatheringV3Scene (scrub sync + play driver).

  const publish = (ix: number, iz: number) => {
    const map = cellsRef.current
    for (const [dx, dz] of TOUCH) {
      const key = gridKey(ix + dx, iz + dz)
      const item = map.get(key)
      if (item) map.set(key, { ...item })
    }
    const byKey = new Map<string, TownCell>()
    for (const cell of map.values()) byKey.set(gridKey(cell.ix, cell.iz), cell)
    setLots([...byKey.values()])
    onSettlementRef.current()
  }

  const neighborsAround = (map: Map<string, TownCell>, ix: number, iz: number): CardinalNeighbors => ({
    south: map.get(gridKey(ix + GRID_ORTHO.south.dix, iz + GRID_ORTHO.south.diz)) ?? null,
    east: map.get(gridKey(ix + GRID_ORTHO.east.dix, iz + GRID_ORTHO.east.diz)) ?? null,
    north: map.get(gridKey(ix + GRID_ORTHO.north.dix, iz + GRID_ORTHO.north.diz)) ?? null,
    west: map.get(gridKey(ix + GRID_ORTHO.west.dix, iz + GRID_ORTHO.west.diz)) ?? null,
  })

  const editAt = (ix: number, iz: number, y: number) => {
    void y
    // Phase 1 watch-only. Phase 2: claim empty lots, or stack on player-owned new/held lots.
    if (phaseRef.current !== 'ongoing') return
    const key = gridKey(ix, iz)
    const map = cellsRef.current
    const existing = map.get(key)
    const marks = stageMarks(
      decayRef.current.settledAt,
      decayRef.current.abandonedAt,
      decayRef.current.reclaimedAt,
    )
    if (existing) {
      const next = applyTownClick(
        existing,
        existing.color,
        { ix, iz, baseY: existing.baseY },
        maxStoriesRef.current,
        existing.inhabited,
        marks,
      )
      if (!next) return
      map.set(key, next)
      pushRuleLogRef.current(
        `[rule] ${ix},${iz} story ${next.height} added (player claim)`,
      )
      publish(ix, iz)
      return
    }
    const inhabited = shouldClaimInhabited(map, ix, iz, decayRef.current.fireBarrelChance)
    const swatch = colorRef.current
    const next = applyTownClick(
      undefined,
      swatch,
      { ix, iz, baseY: lotFloor(ix, iz, layoutRef.current, heightAtRef.current) },
      maxStoriesRef.current,
      inhabited,
      marks,
    )
    if (!next) return
    map.set(key, next)
    const nb = neighborsAround(map, ix, iz)
    pushRuleLogRef.current(
      describeClaimDecision({
        ix,
        iz,
        height: next.height,
        colorLabel: TOWN_SWATCHES[swatch]?.label ?? `swatch ${swatch}`,
        heightReason: 'player claim starts at 1 story',
        colorReason: 'swatch picker',
        inhabited,
        inhabitedReason: inhabited
          ? 'inhabited share still below panel; denser edge preferred'
          : 'inhabited share already at panel chance',
        neighbors: nb,
      }),
    )
    pushRuleLogRef.current(`[rule] ${ix},${iz} story 1 added (player claim)`)
    publish(ix, iz)
  }
  editBridge.current = editAt

  const growOnce = () => {
    if (phaseRef.current !== 'ongoing') return
    const map = cellsRef.current
    const spot = pickGrowthCellByDensity(map)
    if (!spot) return
    const key = gridKey(spot.ix, spot.iz)
    if (map.has(key)) return
    const nearby = neighborColors(map, spot.ix, spot.iz)
    const swatch = colorFromNeighborMajority(nearby, 0)
    const nbBefore = neighborsAround(map, spot.ix, spot.iz)
    const height = heightFromNeighbors(
      [nbBefore.south, nbBefore.east, nbBefore.north, nbBefore.west],
      maxStoriesRef.current,
    )
    const inhabited = shouldClaimInhabited(map, spot.ix, spot.iz, decayRef.current.fireBarrelChance)
    const next = applyTownClick(
      undefined,
      swatch,
      {
        ix: spot.ix,
        iz: spot.iz,
        baseY: lotFloor(spot.ix, spot.iz, layoutRef.current, heightAtRef.current),
      },
      maxStoriesRef.current,
      inhabited,
    )
    if (!next) return
    next.height = height
    map.set(key, next)
    const nb = neighborsAround(map, spot.ix, spot.iz)
    pushRuleLogRef.current(
      describeClaimDecision({
        ix: spot.ix,
        iz: spot.iz,
        height,
        colorLabel: TOWN_SWATCHES[swatch]?.label ?? `swatch ${swatch}`,
        heightReason:
          nearby.length > 0 ? 'mean of abutting neighbor heights' : 'no neighbors → 1 story',
        colorReason:
          nearby.length > 0 ? 'majority neighbor swatch' : 'fallback brick (no neighbors)',
        inhabited,
        inhabitedReason: inhabited
          ? 'inhabited share still below panel; denser edge preferred'
          : 'inhabited share already at panel chance',
        neighbors: nb,
      }),
    )
    publish(spot.ix, spot.iz)
  }
  const growRef = useRef(growOnce)
  growRef.current = growOnce

  useEffect(() => {
    if (!autoGrow || phase !== 'ongoing') return
    const delay = Math.max(0.25, autoGrowSeconds) * 1000
    const id = window.setInterval(() => growRef.current(), delay)
    return () => window.clearInterval(id)
  }, [autoGrow, autoGrowSeconds, phase])

  useEffect(() => {
    const byKey = new Map<string, TownCell>()
    for (const cell of cellsRef.current.values()) byKey.set(gridKey(cell.ix, cell.iz), cell)
    setLots([...byKey.values()])
    setFlickerLog([])
    setGlassLog([])
    const map = cellsRef.current
    const sample = [...map.values()]
      .sort((a, b) => a.iz - b.iz || a.ix - b.ix)
      .slice(0, 8)
      .map((cell) => {
        const nb = {
          south: map.get(gridKey(cell.ix + GRID_ORTHO.south.dix, cell.iz + GRID_ORTHO.south.diz)) ?? null,
          east: map.get(gridKey(cell.ix + GRID_ORTHO.east.dix, cell.iz + GRID_ORTHO.east.diz)) ?? null,
          north: map.get(gridKey(cell.ix + GRID_ORTHO.north.dix, cell.iz + GRID_ORTHO.north.diz)) ?? null,
          west: map.get(gridKey(cell.ix + GRID_ORTHO.west.dix, cell.iz + GRID_ORTHO.west.diz)) ?? null,
        }
        return `${cell.ix},${cell.iz} · ${describeLotMassing(cell, nb)}`
      })
    const vacancies = listSeedVacancies()
    setRuleLog([
      seedLayoutRuleSummary(),
      `seed/reseed · height by center distance · color by distance ring · inhabited = central share`,
      ...vacancies.slice(0, 12),
      ...(vacancies.length > 12 ? [`… ${vacancies.length - 12} more street vacancies`] : []),
      ...sample,
    ])
    onSettlementRef.current()
  }, [claimRevision, cellsRef])

  useEffect(() => {
    // Reset Decay: return every shell to held/new ages; structures remain.
    for (const cell of cellsRef.current.values()) {
      cell.age = 0
      if (cell.vacateRate == null) cell.vacateRate = cellVacateProfile(cell.ix, cell.iz).rate
    }
  }, [decayReset, cellsRef])

  useEffect(() => {
    const blocks: string[] = []
    if (ruleLog.length > 0) blocks.push('settlement rules', ...ruleLog)
    if (flickerLog.length > 0) {
      if (blocks.length > 0) blocks.push('—')
      blocks.push('flicker events', ...flickerLog)
    }
    if (glassLog.length > 0) {
      if (blocks.length > 0) blocks.push('—')
      blocks.push('glass events', ...glassLog)
    }
    if (ageLines.length > 0) {
      if (blocks.length > 0) blocks.push('—')
      blocks.push(...ageLines)
    }
    onAgeReadoutRef.current(blocks, false)
  }, [ageLines, flickerLog, glassLog, ruleLog])

  const onFlickerEvent = (line: string) => {
    setFlickerLog((prev) => [`${line}`, ...prev].slice(0, 14))
  }
  const onGlassEvent = (line: string) => {
    setGlassLog((prev) => [`${line}`, ...prev].slice(0, 14))
  }

  useEffect(() => {
    const map = cellsRef.current
    let changed = false
    for (const cell of map.values()) {
      const floor = lotFloor(cell.ix, cell.iz, layout, heightAt)
      if (Math.abs(cell.baseY - floor) > 0.002) {
        cell.baseY = floor
        changed = true
      }
    }
    if (changed) setLots(Array.from(map.values()))
  }, [heightAt, layout, cellsRef, claimRevision])

  // Seed / reseed / scrub: assign intro ages in place. Do not setLots on every
  // timeline tick — wear reads cell.age live; remounting all lots froze the tab.
  // Also snap once on Phase 1→2 handoff (Skip/Play end) so ages aren't left at 0.
  const introHandedOff = useRef(false)
  useEffect(() => {
    const map = cellsRef.current
    const applyFromClock = () => {
      // Prefer prop on scrub/skip commits; live ref while Play advances between commits.
      const t = Math.max(timelineT, timelineClockRef.current)
      for (const cell of map.values()) {
        const profile = cellVacateProfile(cell.ix, cell.iz)
        const rate = Number.isFinite(profile.rate) ? profile.rate : 1
        cell.vacateRate = rate
        const age = ageAtIntroTime(t, { ...profile, rate })
        cell.age = Number.isFinite(age) ? age : 0
      }
    }
    if (phase === 'intro') {
      introHandedOff.current = false
      applyFromClock()
      return
    }
    if (!introHandedOff.current) {
      introHandedOff.current = true
      applyFromClock()
    }
  }, [phase, timelineT, cellsRef, claimRevision, timelineClockRef])

  useEffect(() => {
    let last = performance.now()
    let readoutWait = 0
    let logWait = 0
    let frame = 0
    const tick = (now: number) => {
      const dt = Math.min(0.25, (now - last) / 1000)
      last = now
      const map = cellsRef.current
      const speed = Math.max(0, decayRef.current.decaySpeed)
      const marks = stageMarks(
        decayRef.current.settledAt,
        decayRef.current.abandonedAt,
        decayRef.current.reclaimedAt,
      )
      if (phaseRef.current === 'ongoing') {
        for (const cell of map.values()) {
          const rate = cell.vacateRate ?? cellVacateProfile(cell.ix, cell.iz).rate
          const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 1
          cell.vacateRate = safeRate
          cell.age += dt * speed * safeRate
          if (!Number.isFinite(cell.age)) cell.age = 0
        }
      } else {
        // Keep intro ages locked to the live clock even between React commits.
        const t = timelineClockRef.current
        for (const cell of map.values()) {
          const profile = cellVacateProfile(cell.ix, cell.iz)
          const rate = Number.isFinite(profile.rate) ? profile.rate : 1
          cell.vacateRate = rate
          const age = ageAtIntroTime(t, { ...profile, rate })
          cell.age = Number.isFinite(age) ? age : 0
        }
      }
      const share = townDecayShare(map.values(), marks)
      townDecayRef.current = share
      readoutWait += dt
      logWait += dt
      if (readoutWait >= 0.25) {
        readoutWait = 0
        const lines = [...map.values()]
          .sort((a, b) => a.iz - b.iz || a.ix - b.ix)
          .map(
            (cell) =>
              `${cell.ix},${cell.iz}  ${cell.age.toFixed(1)}s  ${cellStage(cell.age, marks)}${cell.inhabited ? '  inhabited' : ''}`,
          )
        setAgeLines(lines)
        onTownDecayRef.current(share)
      }
      if (logWait >= 2) {
        logWait = 0
        const sample = [...map.values()]
          .sort((a, b) => b.age - a.age)
          .slice(0, 4)
          .map(
            (cell) =>
              `${cell.ix},${cell.iz} ${cell.age.toFixed(1)}s ${cellStage(cell.age, marks)}${cell.inhabited ? ' inhabited' : ''}`,
          )
        console.info(`[weathering age] ${map.size} cells`, sample.join(' · ') || 'none')
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [cellsRef])

  const canEdit = editEnabled && phase === 'ongoing'

  return (
    <>
      {lots.map((cell) => (
        <LotMesh
          key={gridKey(cell.ix, cell.iz)}
          cell={cell}
          cellSize={layout.cellSize}
          warp={layout.warp}
          buildingScale={layout.buildingScale ?? 3}
          heightAt={heightAt}
          decayRef={decayRef}
          onGlassEvent={onGlassEvent}
          maxStories={maxStories}
          south={neighborCell(cellsRef.current, cell.ix, cell.iz, GRID_ORTHO.south)}
          east={neighborCell(cellsRef.current, cell.ix, cell.iz, GRID_ORTHO.east)}
          north={neighborCell(cellsRef.current, cell.ix, cell.iz, GRID_ORTHO.north)}
          west={neighborCell(cellsRef.current, cell.ix, cell.iz, GRID_ORTHO.west)}
        />
      ))}
      <StageLightBudget
        cellsRef={cellsRef}
        layout={layout}
        decayRef={decayRef}
        onFlickerEvent={onFlickerEvent}
      />
      <FeedGrade amount={0.35 + grain * 0.35} />
      {canEdit ? (
        <Html fullscreen style={{ pointerEvents: 'none' }}>
          <div className="ep-swatches">
            {TOWN_SWATCHES.map((swatch, index) => (
              <button
                key={swatch.id}
                type="button"
                className={index === color ? 'is-active' : undefined}
                style={{ background: swatch.plaster }}
                aria-label={swatch.label}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation()
                  setColor(index)
                }}
              />
            ))}
          </div>
        </Html>
      ) : null}
    </>
  )
}
