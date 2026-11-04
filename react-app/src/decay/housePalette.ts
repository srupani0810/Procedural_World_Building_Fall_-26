/**
 * DECAY peak-city (“Before”) palette for detailed house parts.
 * After = same slots, weathered / desaturated for Era slider.
 */

export const HOUSE_BEFORE = {
  brick: '#a85a42',
  plaster: '#e8dcc8',
  concrete: '#c8c8c8',
  stone: '#a8a29a',
  glassAmber: '#e8b060',
  glassDay: '#8a9aaa',
  roof: '#4a4440',
  cornice: '#d4cfc4',
  parapet: '#b8b2a8',
  stoop: '#9a9590',
  trim: '#2a2826',
  fence: '#5a5048',
  chimney: '#7a5048',
  waterTank: '#6a7078',
  /** Light brick / plaster body tones for walk-ups (pick by position). */
  walkupBodies: ['#b87058', '#c48a72', '#e8dcc8', '#d4b8a0'] as const,
  /** Accent door colors — pick by block position (no Math.random). */
  doors: ['#3d5a7a', '#8a3030', '#3a5a42', '#5a3a6a'] as const,
} as const

/** After palette — same roles, muted / stained for era blend. */
export const HOUSE_AFTER = {
  brick: '#8a4a38',
  plaster: '#c4b8a8',
  concrete: '#9a9894',
  stone: '#8a8480',
  glassAmber: '#b88848',
  glassDay: '#6a7a88',
  roof: '#3a342e',
  cornice: '#a8a098',
  parapet: '#908880',
  stoop: '#7a7570',
  trim: '#1e1c1a',
  fence: '#4a443e',
  chimney: '#5a3c38',
  waterTank: '#4a5058',
  walkupBodies: ['#906048', '#a07058', '#c4b8a8', '#b09880'] as const,
  doors: ['#2e4860', '#6a2828', '#2e4834', '#482a52'] as const,
} as const

export type HouseDoorColor = (typeof HOUSE_BEFORE.doors)[number]

/** Before → After pairs for deterministic Era blend (no Math.random). */
const HOUSE_ERA_PAIRS: ReadonlyArray<readonly [string, string]> = [
  [HOUSE_BEFORE.brick, HOUSE_AFTER.brick],
  [HOUSE_BEFORE.plaster, HOUSE_AFTER.plaster],
  [HOUSE_BEFORE.concrete, HOUSE_AFTER.concrete],
  [HOUSE_BEFORE.stone, HOUSE_AFTER.stone],
  [HOUSE_BEFORE.glassAmber, HOUSE_AFTER.glassAmber],
  [HOUSE_BEFORE.glassDay, HOUSE_AFTER.glassDay],
  [HOUSE_BEFORE.roof, HOUSE_AFTER.roof],
  [HOUSE_BEFORE.cornice, HOUSE_AFTER.cornice],
  [HOUSE_BEFORE.parapet, HOUSE_AFTER.parapet],
  [HOUSE_BEFORE.stoop, HOUSE_AFTER.stoop],
  [HOUSE_BEFORE.trim, HOUSE_AFTER.trim],
  [HOUSE_BEFORE.fence, HOUSE_AFTER.fence],
  [HOUSE_BEFORE.chimney, HOUSE_AFTER.chimney],
  [HOUSE_BEFORE.waterTank, HOUSE_AFTER.waterTank],
  [HOUSE_BEFORE.walkupBodies[0], HOUSE_AFTER.walkupBodies[0]],
  [HOUSE_BEFORE.walkupBodies[1], HOUSE_AFTER.walkupBodies[1]],
  [HOUSE_BEFORE.walkupBodies[2], HOUSE_AFTER.walkupBodies[2]],
  [HOUSE_BEFORE.walkupBodies[3], HOUSE_AFTER.walkupBodies[3]],
  [HOUSE_BEFORE.doors[0], HOUSE_AFTER.doors[0]],
  [HOUSE_BEFORE.doors[1], HOUSE_AFTER.doors[1]],
  [HOUSE_BEFORE.doors[2], HOUSE_AFTER.doors[2]],
  [HOUSE_BEFORE.doors[3], HOUSE_AFTER.doors[3]],
]

function hexToUnitRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ]
}

/**
 * Map a Lab vertex color from Before → After by nearest palette role, then
 * lerp by era (0 = exact Before, 1 = After). Unmatched custom tones shift
 * by the nearest pair's delta so Era still reads.
 */
export function blendHouseRgbByEra(
  r: number,
  g: number,
  b: number,
  era: number,
): [number, number, number] {
  const t = era <= 0 ? 0 : era >= 1 ? 1 : era
  if (t === 0) return [r, g, b]

  let best = 0
  let bestD = Infinity
  for (let i = 0; i < HOUSE_ERA_PAIRS.length; i++) {
    const [br, bg, bb] = hexToUnitRgb(HOUSE_ERA_PAIRS[i]![0])
    const d = (r - br) * (r - br) + (g - bg) * (g - bg) + (b - bb) * (b - bb)
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  const pair = HOUSE_ERA_PAIRS[best]!
  const before = hexToUnitRgb(pair[0])
  const after = hexToUnitRgb(pair[1])
  // Preserve custom offset from the matched Before swatch, then slide Toward After.
  const outR = r + (after[0] - before[0]) * t
  const outG = g + (after[1] - before[1]) * t
  const outB = b + (after[2] - before[2]) * t
  return [
    outR < 0 ? 0 : outR > 1 ? 1 : outR,
    outG < 0 ? 0 : outG > 1 ? 1 : outG,
    outB < 0 ? 0 : outB > 1 ? 1 : outB,
  ]
}
