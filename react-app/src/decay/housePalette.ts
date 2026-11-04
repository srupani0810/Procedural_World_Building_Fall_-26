/**
 * DECAY peak-city (“Before”) palette for detailed house parts.
 * After / stage-shifted palette still to wire.
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

export type HouseDoorColor = (typeof HOUSE_BEFORE.doors)[number]
