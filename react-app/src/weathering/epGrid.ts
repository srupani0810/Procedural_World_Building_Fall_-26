/**
 * Relaxed quad grid for the EP settlement.
 * Integer (ix, iz) is the stable cell id. Warp only moves corners in X/Z.
 * This module stores cell state and neighbor lookup. It does not build housing.
 */

export type GridLayout = {
  /** Spacing between unwarped grid points, in world units. */
  cellSize: number
  /** 0 = rigid lattice. Higher values scale the low-frequency corner offset. */
  warp: number
  /**
   * Visual size of the house on a lot. Does not move cell ids or lot spacing.
   */
  buildingScale?: number
}

export type CellStage = 'new' | 'settled' | 'abandoned' | 'reclaimed'

/**
 * Age is elapsed seconds since the cell was claimed.
 * Stage is derived from that number; it is not stored separately.
 */
export const CELL_STAGE_AT = {
  settled: 8,
  abandoned: 20,
  reclaimed: 40,
} as const

export type StageThresholds = {
  settled: number
  abandoned: number
  reclaimed: number
}

/** Keep the three ages in order so a slider cannot invert the stages. */
export function stageMarks(settledAt: number, abandonedAt: number, reclaimedAt: number): StageThresholds {
  const settled = Math.max(0.5, settledAt)
  const abandoned = Math.max(settled + 0.5, abandonedAt)
  const reclaimed = Math.max(abandoned + 0.5, reclaimedAt)
  return { settled, abandoned, reclaimed }
}

/** Stable 0–1 roll. A cell keeps a barrel when this is below the Decay chance. */
export function cellInhabitRoll(ix: number, iz: number) {
  const n = Math.sin(ix * 127.1 + iz * 311.7 + 21 * 17.3) * 43758.5453
  return n - Math.floor(n)
}

export function cellHasBarrel(ix: number, iz: number, chance: number) {
  return cellInhabitRoll(ix, iz) < chance
}

export function cellStage(age: number, marks: StageThresholds = CELL_STAGE_AT): CellStage {
  if (age < marks.settled) return 'new'
  if (age < marks.abandoned) return 'settled'
  if (age < marks.reclaimed) return 'abandoned'
  return 'reclaimed'
}

/**
 * Continuous wear along the stage timeline.
 * 0 at claim, 1 at settled, 2 at abandoned, 3 once reclaimed.
 * Materials blend across this instead of switching at the boundaries.
 */
export function cellWear(age: number, marks: StageThresholds = CELL_STAGE_AT) {
  const { settled, abandoned, reclaimed } = marks
  if (age <= 0) return 0
  if (age < settled) return age / settled
  if (age < abandoned) return 1 + (age - settled) / (abandoned - settled)
  if (age < reclaimed) return 2 + (age - abandoned) / (reclaimed - abandoned)
  return 3
}

/**
 * 0 when every claimed lot is new, 1 when every lot is fully reclaimed.
 * Taller lots count more, so an abandoned block pulls the town harder than a shack.
 * An empty grid is 0.
 */
export function townDecayShare(cells: Iterable<GridCell>, marks: StageThresholds = CELL_STAGE_AT) {
  let weight = 0
  let sum = 0
  for (const cell of cells) {
    const stories = Math.max(1, cell.height)
    weight += stories
    sum += stories * (cellWear(cell.age, marks) / 3)
  }
  if (weight <= 0) return 0
  return sum / weight
}

export type GridCell = {
  ix: number
  iz: number
  /** Swatch index. Meaningful once the cell is claimed. */
  color: number
  /** Built height in stories. An absent map entry is unclaimed water. */
  height: number
  /** Terrain height sampled when the cell was claimed. */
  baseY: number
  /** Seconds since this cell was claimed. Advances while the scene is mounted. */
  age: number
  /** Stable tag. Abandoned inhabited cells keep a barrel fire instead of a dead bulb. */
  inhabited: boolean
}

export type XZ = [number, number]

/** Half-extent of the debug lattice, matching the overview ground. */
export const GRID_HALF_EXTENT = 260
export const GRID_DEBUG_Y = 0.55

const NOISE_FREQ = 0.18
const AMP_SCALE = 0.42

export const defaultGridLayout: GridLayout = {
  cellSize: 1.85,
  warp: 0.55,
}

export function gridKey(ix: number, iz: number) {
  return `${ix},${iz}`
}

export const GRID_ORTHO = {
  south: { dix: 0, diz: -1 },
  east: { dix: 1, diz: 0 },
  north: { dix: 0, diz: 1 },
  west: { dix: -1, diz: 0 },
} as const

export type GridOrthoName = keyof typeof GRID_ORTHO

export function neighborCell(
  cells: ReadonlyMap<string, GridCell>,
  ix: number,
  iz: number,
  dir: { dix: number; diz: number },
) {
  return cells.get(gridKey(ix + dir.dix, iz + dir.diz)) ?? null
}

export function clearGrid(cells: Map<string, GridCell>) {
  cells.clear()
}

/**
 * Next lot for idle growth. An empty map seeds the origin.
 * Otherwise the pick is an unclaimed cell sharing an edge with a claimed one,
 * weighted toward cells that already touch more of the settlement.
 */
export function pickGrowthCell(
  cells: ReadonlyMap<string, GridCell>,
  random: () => number = Math.random,
) {
  if (cells.size === 0) return { ix: 0, iz: 0 }
  const options: { ix: number; iz: number; weight: number }[] = []
  const seen = new Set<string>()
  for (const cell of cells.values()) {
    for (const dir of Object.values(GRID_ORTHO)) {
      const ix = cell.ix + dir.dix
      const iz = cell.iz + dir.diz
      const key = gridKey(ix, iz)
      if (cells.has(key) || seen.has(key)) continue
      seen.add(key)
      let weight = 0
      for (const around of Object.values(GRID_ORTHO)) {
        if (cells.has(gridKey(ix + around.dix, iz + around.diz))) weight += 1
      }
      if (weight > 0) options.push({ ix, iz, weight })
    }
  }
  if (options.length === 0) return null
  let total = 0
  for (const option of options) total += option.weight
  let roll = random() * total
  for (const option of options) {
    roll -= option.weight
    if (roll <= 0) return { ix: option.ix, iz: option.iz }
  }
  const last = options[options.length - 1]
  return { ix: last.ix, iz: last.iz }
}

function hash(ix: number, iz: number) {
  const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453
  return n - Math.floor(n)
}

function fade(t: number) {
  return t * t * (3 - 2 * t)
}

/** Value noise in 0..1. Low frequency when sampled with a small multiplier on ix/iz. */
function noise2(x: number, z: number) {
  const x0 = Math.floor(x)
  const z0 = Math.floor(z)
  const tx = fade(x - x0)
  const tz = fade(z - z0)
  const v00 = hash(x0, z0)
  const v10 = hash(x0 + 1, z0)
  const v01 = hash(x0, z0 + 1)
  const v11 = hash(x0 + 1, z0 + 1)
  const a = v00 + (v10 - v00) * tx
  const b = v01 + (v11 - v01) * tx
  return a + (b - a) * tz
}

/** World XZ of lattice vertex (ix, iz). Same integers always return the same point for a layout. */
export function cornerXZ(ix: number, iz: number, layout: GridLayout): XZ {
  const x = ix * layout.cellSize
  const z = iz * layout.cellSize
  if (layout.warp === 0) return [x, z]
  const amp = layout.warp * layout.cellSize * AMP_SCALE
  const ox = (noise2(ix * NOISE_FREQ, iz * NOISE_FREQ) * 2 - 1) * amp
  const oz = (noise2(ix * NOISE_FREQ + 50, iz * NOISE_FREQ + 23) * 2 - 1) * amp
  return [x + ox, z + oz]
}

/** Corners in south-west, south-east, north-east, north-west order. */
export function cellCorners(ix: number, iz: number, layout: GridLayout): XZ[] {
  return [
    cornerXZ(ix, iz, layout),
    cornerXZ(ix + 1, iz, layout),
    cornerXZ(ix + 1, iz + 1, layout),
    cornerXZ(ix, iz + 1, layout),
  ]
}

export function cellCentroid(ix: number, iz: number, layout: GridLayout): XZ {
  const corners = cellCorners(ix, iz, layout)
  return [
    (corners[0][0] + corners[1][0] + corners[2][0] + corners[3][0]) / 4,
    (corners[0][1] + corners[1][1] + corners[2][1] + corners[3][1]) / 4,
  ]
}

function pointInQuad(x: number, z: number, corners: XZ[]) {
  let sign = 0
  for (let i = 0; i < 4; i++) {
    const a = corners[i]
    const b = corners[(i + 1) % 4]
    const cross = (b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0])
    if (Math.abs(cross) < 1e-5) continue
    const s = cross > 0 ? 1 : -1
    if (sign === 0) sign = s
    else if (s !== sign) return false
  }
  return true
}

/**
 * Cell whose warped quad contains (x, z).
 * Logical ids stay on the integer lattice; only the corner test uses the warp.
 */
export function resolveCell(x: number, z: number, layout: GridLayout) {
  const size = layout.cellSize || 1
  const guessIx = Math.round(x / size)
  const guessIz = Math.round(z / size)
  const reach = 2 + Math.ceil(Math.abs(layout.warp) * AMP_SCALE)
  let inside: { ix: number; iz: number; d: number } | null = null
  let nearest: { ix: number; iz: number; d: number } | null = null
  for (let dz = -reach; dz <= reach; dz++) {
    for (let dx = -reach; dx <= reach; dx++) {
      const ix = guessIx + dx
      const iz = guessIz + dz
      const [cx, cz] = cellCentroid(ix, iz, layout)
      const d = (cx - x) ** 2 + (cz - z) ** 2
      if (!nearest || d < nearest.d) nearest = { ix, iz, d }
      if (pointInQuad(x, z, cellCorners(ix, iz, layout)) && (!inside || d < inside.d)) {
        inside = { ix, iz, d }
      }
    }
  }
  const hit = inside ?? nearest ?? { ix: guessIx, iz: guessIz }
  return { ix: hit.ix, iz: hit.iz }
}
