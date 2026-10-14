import { memo, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  MeshBasicMaterial,
  ShaderMaterial,
} from 'three'
import {
  GRID_ORTHO,
  cellCentroid,
  cellCorners,
  cellStage,
  cellWear,
  townDecayShare,
  cellHasBarrel,
  stageMarks,
  gridKey,
  neighborCell,
  pickGrowthCell,
  type GridCell,
  type GridLayout,
  type XZ,
} from './epGrid.ts'
import {
  createGlowMaterial,
  createPlasterMaterial,
  createTarpMaterial,
  createWearUniforms,
} from './shiftWear.ts'
import { CellStageFixture, StageLightBudget } from './shiftLights.tsx'
import type { DecayParams } from './epParams.ts'
import { readWaterMask, waterMaskAt } from './waterMask.ts'

export const TOWN_STORY = 1.05
const COLUMN_R = 0.2
const WALL_T = 0.16

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

export const TOWN_SWATCHES = [
  { id: 'magenta', label: 'Magenta', plaster: '#2a2428', glow: '#ff2bd6' },
  { id: 'cyan', label: 'Cyan', plaster: '#1c2428', glow: '#3ee0ff' },
  { id: 'red', label: 'Red', plaster: '#2a1818', glow: '#ff3344' },
  { id: 'ash', label: 'Ash', plaster: '#16181b', glow: '#9aa3ad' },
] as const

type V = [number, number, number]
type RGB = [number, number, number]

const plasterRgb = TOWN_SWATCHES.map((swatch) => {
  const c = new Color(swatch.plaster)
  return [c.r, c.g, c.b] as RGB
})
const glowRgb = TOWN_SWATCHES.map((swatch) => {
  const c = new Color(swatch.glow)
  return [c.r, c.g, c.b] as RGB
})

function hash2(ix: number, iz: number, salt: number) {
  const n = Math.sin(ix * 127.1 + iz * 311.7 + salt * 17.3) * 43758.5453
  return n - Math.floor(n)
}

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
      noise[i] = hash2(pos[i * 3] * 10, pos[i * 3 + 2] * 10, pos[i * 3 + 1])
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

type Side = { open: boolean; neighbor: TownCell | null; a: XZ; b: XZ; inward: XZ }

function lotSides(
  cell: TownCell,
  around: Array<TownCell | null>,
  layout: GridLayout,
  iy: number,
): Side[] {
  const corners = cellCorners(cell.ix, cell.iz, layout)
  const [cx, cz] = cellCentroid(cell.ix, cell.iz, layout)
  return corners.map((a, i) => {
    const b = corners[(i + 1) % 4]
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
  side: Side,
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
  side: Side,
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

function addRoof(
  pos: number[],
  nrm: number[],
  col: number[],
  edge: number[],
  gpos: number[],
  gnrm: number[],
  gcol: number[],
  cell: TownCell,
  rgb: RGB,
  glow: RGB,
  showSign: boolean,
  layout: GridLayout,
) {
  const [cx, cz] = cellCentroid(cell.ix, cell.iz, layout)
  const y = cell.baseY + cell.height * TOWN_STORY
  const corners = cellCorners(cell.ix, cell.iz, layout)
  const outer = corners.map((p) => [p[0] + (cx - p[0]) * 0.08, p[1] + (cz - p[1]) * 0.08] as XZ)
  const inner = outer.map((p) => [p[0] + (cx - p[0]) * 0.22, p[1] + (cz - p[1]) * 0.22] as XZ)
  const thickness = 0.14
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4
    const o0: V = [outer[i][0], y, outer[i][1]]
    const o1: V = [outer[j][0], y, outer[j][1]]
    const i0: V = [inner[i][0], y + thickness, inner[i][1]]
    const i1: V = [inner[j][0], y + thickness, inner[j][1]]
    pushQuad(pos, nrm, col, edge, o0, o1, i1, i0, rgb, [cx, y - 1, cz], true)
    const strip: RGB = [glow[0] * 0.55, glow[1] * 0.55, glow[2] * 0.55]
    const e0: V = [o0[0], y + 0.02, o0[2]]
    const e1: V = [o1[0], y + 0.02, o1[2]]
    pushQuad(
      gpos,
      gnrm,
      gcol,
      [],
      e0,
      e1,
      [e1[0], e1[1] + 0.035, e1[2]],
      [e0[0], e0[1] + 0.035, e0[2]],
      strip,
      [cx, y - 1, cz],
    )
  }
  const top = inner.map((p) => [p[0], y + thickness, p[1]] as V)
  pushQuad(pos, nrm, col, edge, top[0], top[1], top[2], top[3], rgb, [cx, y - 1, cz])

  if (showSign) {
    const s = 0.06
    const mast: V[] = [
      [cx - s, y + thickness, cz - s],
      [cx + s, y + thickness, cz - s],
      [cx + s, y + thickness + 0.46, cz + s],
      [cx - s, y + thickness + 0.46, cz - s],
    ]
    pushQuad(gpos, gnrm, gcol, [], mast[0], mast[1], mast[2], mast[3], glow, [cx, y, cz])
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
  const ring = corners.map((p) => [p[0] + (cx - p[0]) * 0.12, p[1] + (cz - p[1]) * 0.12] as XZ)
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
  gpos: number[],
  gnrm: number[],
  gcol: number[],
  cell: TownCell,
  sides: Side[],
  y: number,
  rgb: RGB,
  glow: RGB,
  layout: GridLayout,
) {
  const [cx, cz] = cellCentroid(cell.ix, cell.iz, layout)
  const corners = cellCorners(cell.ix, cell.iz, layout)
  const yLow = y + 0.06
  const yHigh = y + 0.62
  const heights = corners.map((_, k) => {
    const prevClosed = sides[(k + 3) % 4].open ? 0 : 1
    const nextClosed = sides[k].open ? 0 : 1
    return yLow + (yHigh - yLow) * ((prevClosed + nextClosed) / 2)
  })
  const inset = corners.map((p) => [p[0] + (cx - p[0]) * 0.1, p[1] + (cz - p[1]) * 0.1] as XZ)
  const top = inset.map((p, i) => [p[0], heights[i], p[1]] as V)
  pushQuad(pos, nrm, col, edge, top[0], top[1], top[2], top[3], rgb, [cx, y - 1, cz], true)
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
      true,
    )
  }
  let hi = 0
  for (let i = 1; i < heights.length; i++) if (heights[i] > heights[hi]) hi = i
  const c = inset[hi]
  const s = 0.07
  const base = heights[hi]
  const box: V[] = [
    [c[0] - s, base, c[1] - s],
    [c[0] + s, base, c[1] - s],
    [c[0] + s, base + 0.38, c[1] + s],
    [c[0] - s, base + 0.38, c[1] - s],
  ]
  pushQuad(gpos, gnrm, gcol, [], box[0], box[1], box[2], box[3], glow, [cx, y, cz])
}

type LotNeighbors = {
  south: TownCell | null
  east: TownCell | null
  north: TownCell | null
  west: TownCell | null
}

function addTarp(cell: TownCell, layout: GridLayout) {
  const pos: number[] = []
  const nrm: number[] = []
  const col: number[] = []
  const edge: number[] = []
  const drape: number[] = []
  const rgb: RGB = [0.45, 0.42, 0.36]
  const corners = cellCorners(cell.ix, cell.iz, layout)
  const [cx, cz] = cellCentroid(cell.ix, cell.iz, layout)
  const sheets = 1 + (hash2(cell.ix, cell.iz, 12) > 0.45 ? 1 : 0)
  const y = cell.baseY + cell.height * TOWN_STORY + 0.12

  const sheet = (i: number, salt: number) => {
    const a = corners[i]
    const b = corners[(i + 1) % 4]
    const mx = (a[0] + b[0]) / 2
    const mz = (a[1] + b[1]) / 2
    let ox = mx - cx
    let oz = mz - cz
    const len = Math.hypot(ox, oz) || 1
    ox /= len
    oz /= len
    const hang = (0.42 + hash2(cell.ix, cell.iz, salt) * 0.35) * Math.max(1, cell.height)
    const flare = 0.16 + hash2(cell.ix, cell.iz, salt + 1) * 0.14
    const droop = 0.12 + hash2(cell.ix, cell.iz, salt + 2) * 0.16
    const a0: V = [a[0], y, a[1]]
    const b0: V = [b[0], y, b[1]]
    const mid: V = [(a0[0] + b0[0]) / 2, y, (a0[2] + b0[2]) / 2]
    const a1: V = [a[0] + ox * flare, y - hang, a[1] + oz * flare]
    const b1: V = [b[0] + ox * flare * 0.85, y - hang * 0.9, b[1] + oz * flare * 0.85]
    const low: V = [mx + ox * (flare + 0.06), y - hang - droop, mz + oz * (flare + 0.06)]
    for (const [p, q, r, s] of [
      [a0, mid, low, a1],
      [mid, b0, b1, low],
    ] as Array<[V, V, V, V]>) {
      const before = pos.length
      pushQuad(pos, nrm, col, edge, p, q, r, s, rgb, [cx, y - 1, cz])
      const written = (pos.length - before) / 3
      for (let v = 0; v < written; v++) {
        const px = pos[before + v * 3]
        const py = pos[before + v * 3 + 1]
        const pz = pos[before + v * 3 + 2]
        const roof = py > y - 0.04
        const ax = roof ? px : (a0[0] + b0[0]) / 2
        const ay = roof ? py : y
        const az = roof ? pz : (a0[2] + b0[2]) / 2
        drape.push(ax - px, ay - py, az - pz)
      }
    }
  }

  for (let n = 0; n < sheets; n++) {
    const i = Math.floor(hash2(cell.ix, cell.iz, 8 + n) * 4) % 4
    sheet(i, 20 + n * 3)
  }
  return toGeo(pos, nrm, col, edge, drape)
}

export function buildLotGeometry(cell: TownCell, neighbors: LotNeighbors, layout: GridLayout) {
  const pos: number[] = []
  const nrm: number[] = []
  const col: number[] = []
  const edge: number[] = []
  const gpos: number[] = []
  const gnrm: number[] = []
  const gcol: number[] = []
  const rgb = plasterRgb[cell.color] ?? plasterRgb[0]
  const glow = glowRgb[cell.color] ?? glowRgb[0]
  const around = [neighbors.south, neighbors.east, neighbors.north, neighbors.west]
  const voxels = cellStoryVoxels(cell)
  const [cx, cz] = cellCentroid(cell.ix, cell.iz, layout)
  const corners = cellCorners(cell.ix, cell.iz, layout)
  let topSides: Side[] = []

  for (const voxel of voxels) {
    const sides = lotSides(cell, around, layout, voxel.iy)
    const y0 = cell.baseY + voxel.iy * TOWN_STORY
    const y1 = y0 + TOWN_STORY
    topSides = sides

    for (let k = 0; k < 4; k++) {
      const prev = sides[(k + 3) % 4]
      const next = sides[k]
      if (prev.open && next.open) {
        const c = corners[k]
        const insetX = c[0] + (cx - c[0]) * 0.2
        const insetZ = c[1] + (cz - c[1]) * 0.2
        addColumn(pos, nrm, col, edge, insetX, insetZ, y0, y1, rgb)
      }
    }

    sides.forEach((side) => {
      if (!side.open) return
      const neighbor = side.neighbor
      if (neighbor && voxel.iy === neighbor.height) {
        const stepLow = neighbor.baseY + neighbor.height * TOWN_STORY
        addStairs(pos, nrm, col, edge, side, stepLow, y1, rgb)
        addArchWall(pos, nrm, col, edge, gpos, gnrm, gcol, side, stepLow, y1, rgb, glow, false)
        return
      }
      if (voxel.iy === 0) {
        addArchWall(pos, nrm, col, edge, gpos, gnrm, gcol, side, y0, y1, rgb, glow, true)
        return
      }
      addWindowWall(pos, nrm, col, edge, gpos, gnrm, gcol, side, y0, y1, rgb, glow)
    })
  }

  const yTop = cell.baseY + cell.height * TOWN_STORY
  const openCount = topSides.filter((side) => side.open).length
  if (openCount === 0) {
    addFlatCourt(pos, nrm, col, edge, cell, yTop, rgb, layout)
  } else if (openCount === 4) {
    addRoof(pos, nrm, col, edge, gpos, gnrm, gcol, cell, rgb, glow, true, layout)
  } else {
    addShedRoof(pos, nrm, col, edge, gpos, gnrm, gcol, cell, topSides, yTop, rgb, glow, layout)
  }

  return {
    plaster: toGeo(pos, nrm, col, edge),
    glow: toGeo(gpos, gnrm, gcol, []),
    tarp: addTarp(cell, layout),
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
  decayRef,
}: {
  cell: TownCell
  south: TownCell | null
  east: TownCell | null
  north: TownCell | null
  west: TownCell | null
  cellSize: number
  warp: number
  decayRef: { current: DecayParams }
}) {
  const built = useMemo(
    () => buildLotGeometry(cell, { south, east, north, west }, { cellSize, warp }),
    [
      cell.ix,
      cell.iz,
      cell.height,
      cell.color,
      cell.baseY,
      south?.height,
      south?.baseY,
      east?.height,
      east?.baseY,
      north?.height,
      north?.baseY,
      west?.height,
      west?.baseY,
      cellSize,
      warp,
    ],
  )
  useEffect(() => {
    return () => {
      built.plaster.dispose()
      built.glow.dispose()
      built.tarp.dispose()
    }
  }, [built])

  const wear = useMemo(() => {
    const paint = new Color(TOWN_SWATCHES[cell.color]?.glow ?? '#c8c4bc')
    return createWearUniforms(
      cell.baseY,
      (hash2(cell.ix, cell.iz, 3) - 0.5) * 0.28,
      (hash2(cell.ix, cell.iz, 4) - 0.5) * 0.22,
      paint,
    )
  }, [cell.ix, cell.iz, cell.baseY, cell.color])
  const plasterMat = useMemo(() => createPlasterMaterial(wear), [wear])
  const glowMat = useMemo(() => createGlowMaterial(wear), [wear])
  const tarpMat = useMemo(() => createTarpMaterial(wear), [wear])
  useEffect(() => {
    return () => {
      plasterMat.dispose()
      glowMat.dispose()
      tarpMat.dispose()
    }
  }, [plasterMat, glowMat, tarpMat])
  useFrame(() => {
    const marks = stageMarks(
      decayRef.current.settledAt,
      decayRef.current.abandonedAt,
      decayRef.current.reclaimedAt,
    )
    wear.uWear.value = cellWear(cell.age, marks)
    wear.uWearIntensity.value = decayRef.current.wearIntensity
  })

  const plasterCount = built.plaster.getAttribute('position')?.count ?? 0
  const glowCount = built.glow.getAttribute('position')?.count ?? 0
  const tarpCount = built.tarp.getAttribute('position')?.count ?? 0
  return (
    <>
      {plasterCount > 0 ? <mesh geometry={built.plaster} material={plasterMat} /> : null}
      {tarpCount > 0 ? (
        <mesh geometry={built.tarp} material={tarpMat} raycast={() => null} />
      ) : null}
      {glowCount > 0 ? <mesh geometry={built.glow} material={glowMat} raycast={() => null} /> : null}
      <CellStageFixture cell={cell} cellSize={cellSize} warp={warp} decayRef={decayRef} />
    </>
  )
})

const WATER_FLASH_MS = 1100

/** True when the lot's center, corners, or edge midpoints land on the water mask. */
export function cellCoversWater(ix: number, iz: number, layout: GridLayout) {
  const mask = readWaterMask()
  if (!mask) return false
  const corners = cellCorners(ix, iz, layout)
  const [cx, cz] = cellCentroid(ix, iz, layout)
  const samples: XZ[] = [[cx, cz], ...corners]
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i]
    const b = corners[(i + 1) % corners.length]
    samples.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])
  }
  return samples.some(([x, z]) => waterMaskAt(mask, x, z) === 1)
}

function WaterRejectFlash({
  ix,
  iz,
  born,
  layout,
  groundAt,
  onDone,
}: {
  ix: number
  iz: number
  born: number
  layout: GridLayout
  groundAt: (ix: number, iz: number) => number
  onDone: (born: number) => void
}) {
  const finished = useRef(false)
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#ff3b3b',
        transparent: true,
        opacity: 0.9,
        depthTest: false,
        depthWrite: false,
        fog: false,
        toneMapped: false,
        side: DoubleSide,
      }),
    [],
  )
  const geometry = useMemo(() => {
    const corners = cellCorners(ix, iz, layout)
    const y = groundAt(ix, iz) + 1.15
    const [cx, cz] = cellCentroid(ix, iz, layout)
    const spread = corners.map(([x, z]) => {
      const dx = x - cx
      const dz = z - cz
      const len = Math.hypot(dx, dz) || 1
      return [cx + (dx / len) * (len + 0.55), cz + (dz / len) * (len + 0.55)] as XZ
    })
    const [a, b, c, d] = spread
    const positions = [a, b, c, a, c, d].flatMap(([x, z]) => [x, y, z])
    const geo = new BufferGeometry()
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3))
    return geo
  }, [ix, iz, layout, groundAt])
  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])
  useFrame(() => {
    const t = (performance.now() - born) / WATER_FLASH_MS
    material.opacity = t >= 1 ? 0 : 0.55 + 0.4 * (1 - t)
    if (t >= 1 && !finished.current) {
      finished.current = true
      onDone(born)
    }
  })
  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={6} raycast={() => null} />
}

/**
 * A new lot is one story voxel. Each later click appends another voxel until Max height.
 * Clicks past the cap recolor the column and leave the stack in place.
 * A lot that overlaps the water mask is left empty.
 */
export function applyTownClick(
  existing: TownCell | undefined,
  swatch: number,
  place: { ix: number; iz: number; baseY: number },
  maxStories = 8,
): TownCell | null {
  const cap = Math.max(1, Math.floor(maxStories))
  if (!existing) {
    return {
      ix: place.ix,
      iz: place.iz,
      baseY: place.baseY,
      height: 1,
      color: swatch,
      age: 0,
      inhabited: cellHasBarrel(place.ix, place.iz, 0.38),
    }
  }
  if (existing.height < cap) {
    return { ...existing, height: existing.height + 1 }
  }
  const nextColor = (existing.color + 1) % TOWN_SWATCHES.length
  return { ...existing, color: nextColor }
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
  /** Terrain height at a cell, matching the ground sheet. */
  groundAt: (ix: number, iz: number) => number
  decay: DecayParams
  /** Incremented by Reset Decay. Zeroes age and leaves the lots in place. */
  decayReset: number
  /** Written every frame. Fog reads this without waiting on React. */
  townDecayRef: MutableRefObject<number>
  onTownDecay: (share: number) => void
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
  groundAt,
  decay,
  decayReset,
  townDecayRef,
  onTownDecay,
}: TownProps) {
  const [color, setColor] = useState(0)
  const [lots, setLots] = useState<TownCell[]>([])
  const [ageLines, setAgeLines] = useState<string[]>([])
  const [flashes, setFlashes] = useState<Array<{ ix: number; iz: number; born: number }>>([])
  const [waterNote, setWaterNote] = useState(false)
  const colorRef = useRef(color)
  colorRef.current = color
  const groundAtRef = useRef(groundAt)
  groundAtRef.current = groundAt
  const decayRef = useRef(decay)
  decayRef.current = decay
  const maxStoriesRef = useRef(maxStories)
  maxStoriesRef.current = maxStories
  const layoutRef = useRef(layout)
  layoutRef.current = layout
  const onTownDecayRef = useRef(onTownDecay)
  onTownDecayRef.current = onTownDecay

  const publish = (ix: number, iz: number) => {
    const map = cellsRef.current
    for (const [dx, dz] of TOUCH) {
      const item = map.get(gridKey(ix + dx, iz + dz))
      if (item) map.set(gridKey(ix + dx, iz + dz), { ...item })
    }
    setLots(Array.from(map.values()))
  }

  const rejectWater = (ix: number, iz: number) => {
    const born = performance.now()
    setFlashes((list) => [...list.filter((flash) => flash.ix !== ix || flash.iz !== iz), { ix, iz, born }])
    setWaterNote(true)
  }

  const editAt = (ix: number, iz: number, y: number) => {
    if (cellCoversWater(ix, iz, layoutRef.current)) {
      rejectWater(ix, iz)
      return
    }
    const key = gridKey(ix, iz)
    const map = cellsRef.current
    const next = applyTownClick(map.get(key), colorRef.current, { ix, iz, baseY: y }, maxStoriesRef.current)
    if (next) map.set(key, next)
    else map.delete(key)
    publish(ix, iz)
  }
  editBridge.current = editAt

  const growOnce = () => {
    const map = cellsRef.current
    let spot: { ix: number; iz: number } | null = null
    for (let attempt = 0; attempt < 8; attempt++) {
      const next = pickGrowthCell(map)
      if (!next) return
      if (!cellCoversWater(next.ix, next.iz, layoutRef.current)) {
        spot = next
        break
      }
    }
    if (!spot) return
    const key = gridKey(spot.ix, spot.iz)
    if (map.has(key)) return
    const nearby = neighborColors(map, spot.ix, spot.iz)
    const swatch =
      nearby.length > 0 && Math.random() < 0.72
        ? nearby[Math.floor(Math.random() * nearby.length)]
        : Math.floor(Math.random() * TOWN_SWATCHES.length)
    map.set(key, {
      ix: spot.ix,
      iz: spot.iz,
      height: 1,
      color: swatch,
      baseY: groundAtRef.current(spot.ix, spot.iz),
      age: 0,
      inhabited: cellHasBarrel(spot.ix, spot.iz, decayRef.current.fireBarrelChance),
    })
    publish(spot.ix, spot.iz)
  }
  const growRef = useRef(growOnce)
  growRef.current = growOnce

  useEffect(() => {
    if (!waterNote) return
    const id = window.setTimeout(() => setWaterNote(false), WATER_FLASH_MS)
    return () => window.clearTimeout(id)
  }, [waterNote, flashes])

  useEffect(() => {
    if (!autoGrow) return
    const delay = Math.max(0.25, autoGrowSeconds) * 1000
    const id = window.setInterval(() => growRef.current(), delay)
    return () => window.clearInterval(id)
  }, [autoGrow, autoGrowSeconds])

  useEffect(() => {
    setLots(Array.from(cellsRef.current.values()))
  }, [claimRevision, cellsRef])

  useEffect(() => {
    for (const cell of cellsRef.current.values()) cell.age = 0
  }, [decayReset, cellsRef])

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
      const chance = decayRef.current.fireBarrelChance
      for (const cell of map.values()) cell.age += dt * speed
      const share = townDecayShare(map.values(), marks)
      townDecayRef.current = share
      readoutWait += dt
      logWait += dt
      if (readoutWait >= 0.25) {
        readoutWait = 0
        const lines = [...map.values()]
          .sort((a, b) => a.iz - b.iz || a.ix - b.ix)
          .map((cell) => `${cell.ix},${cell.iz}  ${cell.age.toFixed(1)}s  ${cellStage(cell.age, marks)}${cellHasBarrel(cell.ix, cell.iz, chance) ? '  inhabited' : ''}`)
        setAgeLines(lines)
        onTownDecayRef.current(share)
      }
      if (logWait >= 2) {
        logWait = 0
        const sample = [...map.values()]
          .sort((a, b) => b.age - a.age)
          .slice(0, 4)
          .map((cell) => `${cell.ix},${cell.iz} ${cell.age.toFixed(1)}s ${cellStage(cell.age, marks)}${cellHasBarrel(cell.ix, cell.iz, chance) ? ' inhabited' : ''}`)
        console.info(`[shift age] ${map.size} cells`, sample.join(' · ') || 'none')
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [cellsRef])

  return (
    <>
      {flashes.map((flash) => (
        <WaterRejectFlash
          key={`${flash.ix},${flash.iz},${flash.born}`}
          ix={flash.ix}
          iz={flash.iz}
          born={flash.born}
          layout={layout}
          groundAt={groundAt}
          onDone={(born) =>
            setFlashes((list) => list.filter((item) => item.born !== born || item.ix !== flash.ix || item.iz !== flash.iz))
          }
        />
      ))}
      {lots.map((cell) => (
        <LotMesh
          key={gridKey(cell.ix, cell.iz)}
          cell={cell}
          cellSize={layout.cellSize}
          warp={layout.warp}
          decayRef={decayRef}
          south={neighborCell(cellsRef.current, cell.ix, cell.iz, GRID_ORTHO.south)}
          east={neighborCell(cellsRef.current, cell.ix, cell.iz, GRID_ORTHO.east)}
          north={neighborCell(cellsRef.current, cell.ix, cell.iz, GRID_ORTHO.north)}
          west={neighborCell(cellsRef.current, cell.ix, cell.iz, GRID_ORTHO.west)}
        />
      ))}
      <StageLightBudget cellsRef={cellsRef} layout={layout} decayRef={decayRef} />
      <FeedGrade amount={0.35 + grain * 0.35} />
      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            maxHeight: '46vh',
            overflow: 'auto',
            padding: '8px 10px',
            background: '#0c0d10cc',
            color: '#d5d8de',
            font: '11px/1.45 ui-monospace, monospace',
            whiteSpace: 'pre',
            pointerEvents: 'auto',
          }}
        >
          {waterNote ? <div style={{ color: '#ff5a5a', marginBottom: 6 }}>water — no build</div> : null}
          {ageLines.length === 0
            ? 'age — no claimed cells'
            : `age (s) · stage\n${ageLines.join('\n')}`}
        </div>
      </Html>
      {editEnabled ? (
        <Html fullscreen style={{ pointerEvents: 'none' }}>
          <div className="ep-swatches">
            {TOWN_SWATCHES.map((swatch, index) => (
              <button
                key={swatch.id}
                type="button"
                className={index === color ? 'is-active' : undefined}
                style={{ background: swatch.glow }}
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
