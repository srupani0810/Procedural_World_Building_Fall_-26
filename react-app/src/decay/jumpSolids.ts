/**
 * DECAY Jump In — solid oriented rects for collision (Group B).
 * Footprints + bumpable parts (stoop, porch, fence, fire-escape, industry yard fence).
 * Unit-space sizes stay in sync with houseParts / industryParts. No Math.random.
 */

import type { BuildingInstance } from './buildings.ts'
import {
  FENCE_COLLISION,
  PORCH_COLLISION,
  STOOP_COLLISION,
  fireEscapeUnitSolids,
} from './houseParts.ts'
import {
  INDUSTRY_YARD_FENCE,
  industryYardFenceSolids,
} from './industryParts.ts'
import { rowVariantFromSeed } from './rowHouseForm.ts'
import { walkupVariantFromSeed } from './walkupHouseForm.ts'

/** Player circle diameter ≈ 0.35 m → radius. */
export const PLAYER_RADIUS = 0.175

export type SolidRect = {
  x: number
  z: number
  /** Half-extent along local X (after yaw). */
  hx: number
  /** Half-extent along local Z. */
  hz: number
  yaw: number
  cos: number
  sin: number
}

export type SolidGrid = {
  /** World X of window center (matches walkable window). */
  originX: number
  /** World Z of window center. */
  originZ: number
  cell: number
  halfExtent: number
  n: number
  /** Cell → solid indices. */
  buckets: Map<number, number[]>
  solids: SolidRect[]
  rule: string
}

export type SolidWindowOpts = {
  originX: number
  originZ: number
  windowHalf?: number
}

export type UnitSolid = {
  lx: number
  lz: number
  /** Full width in unit X. */
  sx: number
  /** Full depth in unit Z. */
  sz: number
}

function rimOf(x: number, z: number, half: number) {
  return Math.min(1, Math.hypot(x, z) / Math.max(1, half))
}

/** World OBB from unit-space solid on an instanced building. */
export function unitSolidToWorld(inst: BuildingInstance, u: UnitSolid): SolidRect {
  const cos = Math.cos(inst.yaw)
  const sin = Math.sin(inst.yaw)
  const sx = u.lx * inst.width
  const sz = u.lz * inst.depth
  const x = inst.x + sx * cos + sz * sin
  const z = inst.z - sx * sin + sz * cos
  return {
    x,
    z,
    hx: (u.sx * inst.width) * 0.5,
    hz: (u.sz * inst.depth) * 0.5,
    yaw: inst.yaw,
    cos,
    sin,
  }
}

function footprintSolid(inst: BuildingInstance): SolidRect {
  const cos = Math.cos(inst.yaw)
  const sin = Math.sin(inst.yaw)
  return {
    x: inst.x,
    z: inst.z,
    hx: inst.width * 0.5,
    hz: inst.depth * 0.5,
    yaw: inst.yaw,
    cos,
    sin,
  }
}

function detailSolidsFor(inst: BuildingInstance, halfExtent: number): UnitSolid[] {
  const out: UnitSolid[] = []
  if (inst.housingKind === 'row') {
    const v = rowVariantFromSeed(
      inst.plotId,
      inst.unitIndex ?? 0,
      inst.unitCount ?? 1,
      Math.max(2, Math.round(inst.stories)),
      inst.housingCorner ?? false,
    )
    const doorX = v.doorSide * 0.22
    out.push({
      lx: doorX,
      lz: STOOP_COLLISION.lz,
      sx: STOOP_COLLISION.sx,
      sz: STOOP_COLLISION.sz,
    })
    out.push({
      lx: doorX,
      lz: PORCH_COLLISION.lz,
      sx: PORCH_COLLISION.sx,
      sz: PORCH_COLLISION.sz,
    })
    out.push({
      lx: FENCE_COLLISION.lx,
      lz: FENCE_COLLISION.lz,
      sx: FENCE_COLLISION.sx,
      sz: FENCE_COLLISION.sz,
    })
    out.push(...fireEscapeUnitSolids())
    return out
  }
  if (inst.housingKind === 'walkup') {
    const v = walkupVariantFromSeed(
      inst.plotId,
      rimOf(inst.x, inst.z, halfExtent),
      inst.housingCorner ?? false,
      Math.max(4, Math.min(6, Math.round(inst.stories))),
    )
    void v
    out.push({
      lx: 0,
      lz: STOOP_COLLISION.lz,
      sx: STOOP_COLLISION.sx,
      sz: STOOP_COLLISION.sz,
    })
    // Walk-up canopy shares porch footprint.
    out.push({
      lx: 0,
      lz: PORCH_COLLISION.lz,
      sx: Math.max(PORCH_COLLISION.sx, 0.48),
      sz: PORCH_COLLISION.sz,
    })
    out.push(...fireEscapeUnitSolids())
    return out
  }
  if (inst.industryKind) {
    for (const f of industryYardFenceSolids()) out.push(f)
    void INDUSTRY_YARD_FENCE
  }
  return out
}

function bucketKey(ix: number, iz: number, n: number) {
  return iz * n + ix
}

/**
 * Build solid list + coarse grid for neighborhood queries inside a follow window.
 * Only instances that meet the window are indexed — never the whole field.
 */
export function buildSolidGrid(
  instances: BuildingInstance[],
  fieldHalfExtent: number,
  cell = 1.0,
  window: SolidWindowOpts = { originX: 0, originZ: 0, windowHalf: 30 },
): SolidGrid {
  const originX = window.originX
  const originZ = window.originZ
  const halfExtent = Math.max(8, window.windowHalf ?? 30)
  const n = Math.max(4, Math.ceil((halfExtent * 2) / cell))
  const solids: SolidRect[] = []
  let detailCount = 0

  for (const inst of instances) {
    if (inst.width < 0.2 || inst.depth < 0.2) continue
    const reach = Math.hypot(inst.width, inst.depth) * 0.5 + 2
    if (Math.abs(inst.x - originX) > halfExtent + reach) continue
    if (Math.abs(inst.z - originZ) > halfExtent + reach) continue
    solids.push(footprintSolid(inst))
    for (const u of detailSolidsFor(inst, fieldHalfExtent)) {
      solids.push(unitSolidToWorld(inst, u))
      detailCount += 1
    }
  }

  const buckets = new Map<number, number[]>()
  const insert = (ix: number, iz: number, si: number) => {
    if (ix < 0 || iz < 0 || ix >= n || iz >= n) return
    const k = bucketKey(ix, iz, n)
    const list = buckets.get(k)
    if (list) list.push(si)
    else buckets.set(k, [si])
  }

  for (let si = 0; si < solids.length; si++) {
    const s = solids[si]!
    // AABB of OBB
    const ex = Math.abs(s.cos) * s.hx + Math.abs(s.sin) * s.hz + PLAYER_RADIUS
    const ez = Math.abs(s.sin) * s.hx + Math.abs(s.cos) * s.hz + PLAYER_RADIUS
    const ix0 = Math.floor((s.x - ex - originX + halfExtent) / cell)
    const ix1 = Math.floor((s.x + ex - originX + halfExtent) / cell)
    const iz0 = Math.floor((s.z - ez - originZ + halfExtent) / cell)
    const iz1 = Math.floor((s.z + ez - originZ + halfExtent) / cell)
    for (let iz = iz0; iz <= iz1; iz++) {
      for (let ix = ix0; ix <= ix1; ix++) insert(ix, iz, si)
    }
  }

  return {
    originX,
    originZ,
    cell,
    halfExtent,
    n,
    buckets,
    solids,
    rule: `[jump] solids ${solids.length} (footprints + ${detailCount} details) · window ${n}×${n} @ (${originX.toFixed(1)}, ${originZ.toFixed(1)})`,
  }
}

function gatherCandidates(grid: SolidGrid, x: number, z: number, radius: number): number[] {
  const { cell, halfExtent: h, n, buckets, originX, originZ } = grid
  const pad = radius + 0.05
  const ix0 = Math.floor((x - pad - originX + h) / cell)
  const ix1 = Math.floor((x + pad - originX + h) / cell)
  const iz0 = Math.floor((z - pad - originZ + h) / cell)
  const iz1 = Math.floor((z + pad - originZ + h) / cell)
  const seen = new Set<number>()
  const out: number[] = []
  for (let iz = iz0; iz <= iz1; iz++) {
    for (let ix = ix0; ix <= ix1; ix++) {
      if (ix < 0 || iz < 0 || ix >= n || iz >= n) continue
      const list = buckets.get(bucketKey(ix, iz, n))
      if (!list) continue
      for (const si of list) {
        if (seen.has(si)) continue
        seen.add(si)
        out.push(si)
      }
    }
  }
  return out
}

/**
 * Push circle out of overlapping OBBs. Returns slid position.
 * Separates along the shallowest axis in local space (wall slide).
 */
export function resolveCircleSolids(
  grid: SolidGrid,
  x: number,
  z: number,
  radius: number,
  passes = 3,
): { x: number; z: number } {
  let px = x
  let pz = z
  for (let pass = 0; pass < passes; pass++) {
    const ids = gatherCandidates(grid, px, pz, radius)
    let moved = false
    for (const si of ids) {
      const s = grid.solids[si]!
      const dx = px - s.x
      const dz = pz - s.z
      // World → local (inverse yaw)
      const lx = dx * s.cos - dz * s.sin
      const lz = dx * s.sin + dz * s.cos
      const qx = Math.max(-s.hx, Math.min(s.hx, lx))
      const qz = Math.max(-s.hz, Math.min(s.hz, lz))
      let ox = lx - qx
      let oz = lz - qz
      const d2 = ox * ox + oz * oz
      if (d2 > radius * radius && d2 > 1e-10) continue
      // Inside or penetrating
      if (d2 < 1e-10) {
        // Center inside rect — push along smaller penetration axis
        const penX = s.hx + radius - Math.abs(lx)
        const penZ = s.hz + radius - Math.abs(lz)
        if (penX < penZ) {
          const sx = lx >= 0 ? 1 : -1
          ox = sx * (s.hx + radius) - lx
          oz = 0
        } else {
          const sz = lz >= 0 ? 1 : -1
          ox = 0
          oz = sz * (s.hz + radius) - lz
        }
      } else {
        const d = Math.sqrt(d2)
        const push = radius - d
        ox = (ox / d) * push
        oz = (oz / d) * push
      }
      // Local → world
      px += ox * s.cos + oz * s.sin
      pz += -ox * s.sin + oz * s.cos
      moved = true
    }
    if (!moved) break
  }
  return { x: px, z: pz }
}
