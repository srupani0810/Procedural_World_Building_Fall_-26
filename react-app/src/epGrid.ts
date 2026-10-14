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
