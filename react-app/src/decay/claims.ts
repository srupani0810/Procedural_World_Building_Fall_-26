/**
 * DECAY Phase 2 player claims — add-only onto open morphology plots.
 * Independent of weatheringV3. No Math.random.
 */

import { pointInRing } from './plots.ts'
import type { MorphPlot } from './morphology.ts'
import type { BuildingHoverInfo } from './buildings.ts'
import type { BuildingVacateProfile } from './timeline.ts'

export type PlayerClaim = {
  plotId: number
  /** Stories on this lot. Claim starts at 1. */
  stories: number
  /** Intro / continuous clock time when the lot was claimed (age zero). */
  claimTime: number
}

export function claimsMap(list: PlayerClaim[]): Map<number, PlayerClaim> {
  const m = new Map<number, PlayerClaim>()
  for (const c of list) m.set(c.plotId, c)
  return m
}

/** Open plot under xz that is not yet claimed — claimable empty lot. */
export function findClaimablePlot(
  plots: MorphPlot[],
  x: number,
  z: number,
  claimed: ReadonlyMap<number, PlayerClaim>,
): MorphPlot | null {
  for (const p of plots) {
    if (!p.open) continue
    if (claimed.has(p.id)) continue
    const ring = p.buildingLine.length >= 3 ? p.buildingLine : p.ring
    if (ring.length >= 3 && pointInRing(ring, x, z)) return p
  }
  return null
}

export function claimableHover(
  plot: MorphPlot,
  x: number,
  z: number,
): BuildingHoverInfo {
  return {
    plotId: plot.id,
    heightField: 0,
    sizeField: 0,
    slope: 0,
    floorY: 0,
    foundationHeight: 0,
    shrink: 1,
    stories: 0,
    x,
    z,
    stage: 'claimable',
    age: 0,
  }
}

/** Vacate profile so a fresh claim reads stage new (age 0 at claimTime). */
export function claimVacateProfile(claim: PlayerClaim): BuildingVacateProfile {
  return {
    plotId: claim.plotId,
    delay: claim.claimTime,
    rate: 1,
    rule: 'player-claim',
    rim: 0,
    steep: 0,
    small: 0,
  }
}
