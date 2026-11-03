/**
 * Heightfield helpers for DECAY roads. No direction field, no randomness.
 */

export type HeightFn = (x: number, z: number) => number
export type Vec2 = { x: number; z: number }

/** Box-filter the heightfield so slope ignores noise ripples of a few units. */
export function smoothHeightAt(heightAt: HeightFn, radius = 5, step = 2.5): HeightFn {
  return (x, z) => {
    let sum = 0
    let n = 0
    for (let dz = -radius; dz <= radius; dz += step) {
      for (let dx = -radius; dx <= radius; dx += step) {
        sum += heightAt(x + dx, z + dz)
        n++
      }
    }
    return n > 0 ? sum / n : heightAt(x, z)
  }
}

export function terrainGradient(heightAt: HeightFn, x: number, z: number, eps = 3): Vec2 {
  const hx = (heightAt(x + eps, z) - heightAt(x - eps, z)) / (2 * eps)
  const hz = (heightAt(x, z + eps) - heightAt(x, z - eps)) / (2 * eps)
  return { x: hx, z: hz }
}

export function slopeAt(heightAt: HeightFn, x: number, z: number): number {
  const g = terrainGradient(heightAt, x, z)
  return Math.hypot(g.x, g.z)
}

/**
 * Max |Δh|/run along the segment, using the given height function
 * (pass a smoothed sampler so tiny bumps do not break roads).
 */
export function segmentSteepness(
  heightAt: HeightFn,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  samples = 6,
): number {
  const run = Math.hypot(bx - ax, bz - az)
  if (run < 1e-6) return 0
  let maxS = 0
  let prevH = heightAt(ax, az)
  for (let i = 1; i <= samples; i++) {
    const t = i / samples
    const x = ax + (bx - ax) * t
    const z = az + (bz - az) * t
    const h = heightAt(x, z)
    const ds = run / samples
    if (ds > 1e-8) maxS = Math.max(maxS, Math.abs(h - prevH) / ds)
    prevH = h
  }
  return maxS
}
