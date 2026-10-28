import type { VacateStage } from './stages.ts'
import { vacateStage, type StageThresholds } from './stages.ts'

export type V2Cell = {
  ix: number
  iz: number
  /** Stories claimed. */
  height: number
  /** Seconds since claim without upkeep (absence clock). */
  age: number
  /** Last published vacate stage — for logging transitions. */
  lastStage: VacateStage
  baseY: number
}

export function cellKey(ix: number, iz: number) {
  return `${ix},${iz}`
}

export function cellCentroid(ix: number, iz: number, cellSize: number): [number, number] {
  return [ix * cellSize, iz * cellSize]
}

export function resolveCell(x: number, z: number, cellSize: number) {
  const ix = Math.round(x / cellSize)
  const iz = Math.round(z / cellSize)
  return { ix, iz }
}

const ORTHO = [
  { dix: 0, diz: -1, name: 'south' },
  { dix: 1, diz: 0, name: 'east' },
  { dix: 0, diz: 1, name: 'north' },
  { dix: -1, diz: 0, name: 'west' },
] as const

export type NeighborFace = {
  name: (typeof ORTHO)[number]['name']
  open: boolean
  neighbor: V2Cell | null
}

export function neighborFaces(cell: V2Cell, map: Map<string, V2Cell>): NeighborFace[] {
  return ORTHO.map(({ dix, diz, name }) => {
    const neighbor = map.get(cellKey(cell.ix + dix, cell.iz + diz)) ?? null
    const open = !neighbor || neighbor.height < cell.height
    return { name, open, neighbor }
  })
}

/** How many of the four ortho cells are claimed (0–4). */
export function occupiedNeighborCount(ix: number, iz: number, map: Map<string, V2Cell>) {
  let n = 0
  for (const { dix, diz } of ORTHO) {
    if (map.has(cellKey(ix + dix, iz + diz))) n += 1
  }
  return n
}

/** Stable 0–1 hash from grid id (reproducible; not per-frame). */
export function cellHash(ix: number, iz: number, salt = 0) {
  const n = Math.sin(ix * 127.1 + iz * 311.7 + salt * 74.7) * 43758.5453
  return n - Math.floor(n)
}

/** Pick an empty neighbor of a claimed cell, or adjacent to origin ring. */
export function pickGrowthTarget(map: Map<string, V2Cell>, maxStories: number): { ix: number; iz: number; height: number } | null {
  void maxStories
  if (map.size === 0) {
    return { ix: 0, iz: 0, height: 1 + Math.floor(Math.random() * 2) }
  }
  const claimed = [...map.values()]
  const candidates: Array<{ ix: number; iz: number }> = []
  for (const cell of claimed) {
    for (const { dix, diz } of ORTHO) {
      const ix = cell.ix + dix
      const iz = cell.iz + diz
      if (!map.has(cellKey(ix, iz))) candidates.push({ ix, iz })
    }
  }
  if (candidates.length === 0) return null
  const pick = candidates[Math.floor(Math.random() * candidates.length)]!
  const height = 1 + Math.floor(Math.random() * Math.min(4, 3))
  return { ix: pick.ix, iz: pick.iz, height }
}

export function syncStage(cell: V2Cell, marks: StageThresholds): VacateStage | null {
  const next = vacateStage(cell.age, marks)
  if (next === cell.lastStage) return null
  cell.lastStage = next
  return next
}
