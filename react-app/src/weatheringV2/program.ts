/**
 * Massing + building program — pure neighbor-pattern + height rules.
 * No cellHash: program is fully determined by occupancy geometry and stories.
 */
import { ORTHO, cellKey, type V2Cell } from './grid.ts'

export type MassingType = 'isolated' | 'row' | 'corner' | 'block-enclosed'

export type BuildingProgram =
  | 'house'
  | 'live-work'
  | 'rowhouse'
  | 'walk-up'
  | 'office-hall'
  | 'corner-shop'
  | 'utility'

export const PROGRAM_LABEL: Record<BuildingProgram, string> = {
  house: 'house',
  'live-work': 'live-work',
  rowhouse: 'rowhouse',
  'walk-up': 'walk-up',
  'office-hall': 'office/market hall',
  'corner-shop': 'corner shop',
  utility: 'utility/transit',
}

export const MASSING_LABEL: Record<MassingType, string> = {
  isolated: 'isolated',
  row: 'row',
  corner: 'corner',
  'block-enclosed': 'block-enclosed',
}

/**
 * Four massing types from ortho occupancy pattern (not height).
 * 0 → isolated · 1 or 2-opposite → row · 2-adjacent → corner · 3–4 → block-enclosed
 */
export function massingType(ix: number, iz: number, map: Map<string, V2Cell>): MassingType {
  const occupied = ORTHO.filter(({ dix, diz }) => map.has(cellKey(ix + dix, iz + diz)))
  const n = occupied.length
  if (n === 0) return 'isolated'
  if (n >= 3) return 'block-enclosed'
  if (n === 1) return 'row'
  const a = occupied[0]!
  const b = occupied[1]!
  const opposite = a.dix + b.dix === 0 && a.diz + b.diz === 0
  return opposite ? 'row' : 'corner'
}

/** Program from massing + height — deterministic table, no hidden salt. */
export function programFor(massing: MassingType, height: number): BuildingProgram {
  if (massing === 'isolated') return height <= 2 ? 'house' : 'live-work'
  if (massing === 'row') return height <= 3 ? 'rowhouse' : 'walk-up'
  if (massing === 'block-enclosed') return 'office-hall'
  return height <= 2 ? 'corner-shop' : 'utility'
}

export function resolveProgram(ix: number, iz: number, height: number, map: Map<string, V2Cell>) {
  const massing = massingType(ix, iz, map)
  const program = programFor(massing, height)
  return { massing, program }
}

export function formatProgramRule(program: BuildingProgram, massing: MassingType, height: number) {
  return `program: ${PROGRAM_LABEL[program]} (${MASSING_LABEL[massing]} massing, height ${height})`
}

/**
 * Demo cluster seeds — separate motifs so adjacency does not cross-contaminate
 * massing (e.g. a diagonal corner must not turn a plus-arm into a corner).
 */
export type DemoSeed = { ix: number; iz: number; height: number; note: string }

export const DEMO_CLUSTER: DemoSeed[] = [
  // Isolated (0 neighbors)
  { ix: 5, iz: 0, height: 2, note: 'demo isolated house' },
  { ix: -5, iz: 0, height: 3, note: 'demo isolated live-work' },

  // Row terrace on its own street (1 / 2-opposite neighbors)
  { ix: -1, iz: 3, height: 2, note: 'demo row rowhouse' },
  { ix: 0, iz: 3, height: 3, note: 'demo row rowhouse mid' },
  { ix: 1, iz: 3, height: 5, note: 'demo row walk-up' },

  // Corner shop L (2 adjacent) — stubs stay row ends
  { ix: 4, iz: -2, height: 1, note: 'demo shop stub' },
  { ix: 3, iz: -1, height: 1, note: 'demo shop stub' },
  { ix: 3, iz: -2, height: 2, note: 'demo corner shop' },

  // Corner utility L (2 adjacent, tall)
  { ix: -4, iz: -2, height: 1, note: 'demo utility stub' },
  { ix: -3, iz: -1, height: 1, note: 'demo utility stub' },
  { ix: -3, iz: -2, height: 4, note: 'demo corner utility' },

  // Plus for block-enclosed center (arms claimed first)
  { ix: 0, iz: 1, height: 2, note: 'demo block arm' },
  { ix: 0, iz: -1, height: 2, note: 'demo block arm' },
  { ix: 1, iz: 0, height: 2, note: 'demo block arm' },
  { ix: -1, iz: 0, height: 2, note: 'demo block arm' },
  { ix: 0, iz: 0, height: 4, note: 'demo block office/hall' },
]
