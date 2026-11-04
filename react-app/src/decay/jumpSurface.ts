/**
 * DECAY Jump In — ground surface rules (Group C).
 * Eye height, curb step, slope gate. No Math.random.
 */

import type { HeightFn } from './directionField.ts'
import { slopeAt } from './directionField.ts'
import {
  sampleWalk,
  WALK_NONE,
  WALK_OPEN,
  WALK_ROAD,
  WALK_ROAD_CROSS,
  WALK_SIDEWALK,
  type WalkableMap,
  type WalkKind,
} from './walkableMap.ts'

/** Standing eye height above the walk surface. */
export const JUMP_EYE_HEIGHT = 1.7
/** Road sits nearly flush on terrain (anti z-fight). */
export const JUMP_ROAD_LIFT = 0.02
/** Curb rise: sidewalk / open above road (~0.15 m). */
export const JUMP_CURB = 0.15
/** Sidewalk surface = road flush + curb. */
export const JUMP_WALK_LIFT = JUMP_ROAD_LIFT + JUMP_CURB

/** Orbit ribbon lifts (RoadNetwork) — used to shift meshes flush in Jump In. */
export const ORBIT_ROAD_LIFT = 0.62
export const ORBIT_WALK_LIFT = 0.52

/** How fast curb height eases when crossing sidewalk ↔ road. */
export const CURB_EASE = 10
/** How fast eye height tracks the surface. */
export const EYE_FOLLOW = 12

export function curbTargetForKind(kind: WalkKind): number {
  if (kind === WALK_ROAD || kind === WALK_ROAD_CROSS) return 0
  if (kind === WALK_SIDEWALK || kind === WALK_OPEN) return JUMP_CURB
  // Blocked / unknown — treat as sidewalk height so we don't drop through.
  return JUMP_CURB
}

export function surfaceY(
  heightAt: HeightFn,
  x: number,
  z: number,
  curb: number,
): number {
  return heightAt(x, z) + JUMP_ROAD_LIFT + curb
}

export function eyeY(heightAt: HeightFn, x: number, z: number, curb: number): number {
  return surfaceY(heightAt, x, z, curb) + JUMP_EYE_HEIGHT
}

/**
 * True if the step from (x0,z0) → (x1,z1) stays under the slope limit
 * (rise/run and destination slope sample).
 */
export function slopeAllowed(
  heightAt: HeightFn,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  slopeLimit: number,
): boolean {
  const run = Math.hypot(x1 - x0, z1 - z0)
  if (run < 1e-5) return true
  const rise = Math.abs(heightAt(x1, z1) - heightAt(x0, z0))
  if (rise / run > slopeLimit + 1e-4) return false
  if (slopeAt(heightAt, x1, z1) > slopeLimit + 1e-4) return false
  return true
}

/** Curb target from walk map at xz (defaults to sidewalk curb). */
export function curbTargetAt(map: WalkableMap | null, x: number, z: number): number {
  if (!map) return JUMP_CURB
  return curbTargetForKind(sampleWalk(map, x, z))
}

export function isRoadKind(kind: WalkKind): boolean {
  return kind === WALK_ROAD || kind === WALK_ROAD_CROSS
}

void WALK_NONE
void WALK_SIDEWALK
