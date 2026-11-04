/**
 * Rule-based Jump In start pose — sidewalk near field center, looking along a main road.
 * No Math.random.
 */

import type { HeightFn } from './directionField.ts'
import { edgeHalfWidth } from './morphology.ts'
import type { RoadNetworkParams } from './params.ts'
import { getNode, type RoadGraph } from './roadGraph.ts'
import { eyeY, JUMP_CURB, JUMP_EYE_HEIGHT, JUMP_WALK_LIFT } from './jumpSurface.ts'

export { JUMP_EYE_HEIGHT, JUMP_WALK_LIFT }

export type JumpInSpawn = {
  x: number
  y: number
  z: number
  /** Yaw so −Z (camera look) faces along the road. */
  yaw: number
  rule: string
}

/**
 * Pick the main-tier edge whose midpoint is closest to the origin.
 * Stand on the sidewalk strip (outer half of the walk band), look along the edge
 * toward the endpoint with larger |coord| sum so direction is deterministic.
 */
export function findJumpInSpawn(
  graph: RoadGraph,
  roads: RoadNetworkParams,
  heightAt: HeightFn,
): JumpInSpawn | null {
  const walk = Math.max(0.05, roads.sidewalkWidth)
  let best: {
    mx: number
    mz: number
    dx: number
    dz: number
    half: number
    dist: number
  } | null = null

  for (const e of graph.edges) {
    if (e.tier !== 'main') continue
    const a = getNode(graph, e.nodeA)
    const b = getNode(graph, e.nodeB)
    if (!a || !b) continue
    const mx = (a.x + b.x) * 0.5
    const mz = (a.z + b.z) * 0.5
    const dist = Math.hypot(mx, mz)
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len = Math.hypot(dx, dz)
    if (len < 0.5) continue
    const half = edgeHalfWidth(e, roads)
    if (!best || dist < best.dist) {
      best = { mx, mz, dx: dx / len, dz: dz / len, half, dist }
    }
  }

  // Fallback: any edge nearest the origin.
  if (!best) {
    for (const e of graph.edges) {
      const a = getNode(graph, e.nodeA)
      const b = getNode(graph, e.nodeB)
      if (!a || !b) continue
      const mx = (a.x + b.x) * 0.5
      const mz = (a.z + b.z) * 0.5
      const dist = Math.hypot(mx, mz)
      const dx = b.x - a.x
      const dz = b.z - a.z
      const len = Math.hypot(dx, dz)
      if (len < 0.5) continue
      const half = edgeHalfWidth(e, roads)
      if (!best || dist < best.dist) {
        best = { mx, mz, dx: dx / len, dz: dz / len, half, dist }
      }
    }
  }

  if (!best) return null

  // Perpendicular in XZ (right of travel). Prefer the side whose offset is closer to origin
  // so we stay "inside" the city when the road is offset from center.
  const px = -best.dz
  const pz = best.dx
  const offset = best.half + walk * 0.5
  const c1x = best.mx + px * offset
  const c1z = best.mz + pz * offset
  const c2x = best.mx - px * offset
  const c2z = best.mz - pz * offset
  const use1 = Math.hypot(c1x, c1z) <= Math.hypot(c2x, c2z)
  const x = use1 ? c1x : c2x
  const z = use1 ? c1z : c2z

  // Look along the road: camera −Z faces (dx,dz) after yaw.
  let lookDx = best.dx
  let lookDz = best.dz
  const aScore = Math.abs(best.mx - lookDx) + Math.abs(best.mz - lookDz)
  const bScore = Math.abs(best.mx + lookDx) + Math.abs(best.mz + lookDz)
  if (aScore > bScore) {
    lookDx = -lookDx
    lookDz = -lookDz
  }
  const yaw = Math.atan2(-lookDx, -lookDz)
  const y = eyeY(heightAt, x, z, JUMP_CURB)

  return {
    x,
    y,
    z,
    yaw,
    rule: `[jump] start sidewalk @ (${x.toFixed(1)}, ${z.toFixed(1)}) · main nearest origin · look along road`,
  }
}
