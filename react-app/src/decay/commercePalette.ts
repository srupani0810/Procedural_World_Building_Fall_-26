/**
 * DECAY peak-city (“Before”) palette for commerce low-rise parts.
 * Tan / red-brown brick, cream sign band, colored awnings.
 */

export const COMMERCE_BEFORE = {
  brickTan: '#c4a07a',
  brickRedBrown: '#a85a42',
  bricks: ['#c4a07a', '#b89068', '#a85a42', '#8a4838'] as const,
  cream: '#e8dcc8',
  stone: '#a8a29a',
  glass: '#8a9aaa',
  glassBright: '#a8b8c8',
  roof: '#4a4440',
  cornice: '#d4cfc4',
  trim: '#2a2826',
  base: '#6a6460',
  /** Awning colors — pick by block position (no Math.random). */
  awnings: ['#8a3030', '#3d5a7a', '#3a5a42', '#c4a035', '#5a3a6a'] as const,
} as const
