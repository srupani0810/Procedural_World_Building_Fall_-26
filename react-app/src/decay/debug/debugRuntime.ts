/**
 * DECAY Debug runtime — module store + timers.
 * When disabled, timedRebuild is a passthrough and nothing is recorded.
 * No Math.random.
 */

import type { JumpDebugInfo } from '../DecayFirstPerson.tsx'

export const DEBUG_REBUILD_CAP = 20
/** Panel / probe publish interval (~4 Hz). */
export const DEBUG_TICK_MS = 250

export type RebuildKind =
  | 'road graph'
  | 'plots + land use'
  | 'buildings'
  | 'walkable map'
  | 'jump solids'
  | 'row house mesh'
  | 'walk-up mesh'
  | 'industry mesh'
  | 'commerce mesh'
  | 'claimed buildings'

export type RebuildEntry = {
  at: number
  kind: RebuildKind | string
  ms: number
  cause: string
}

export type FormInstanceCounts = {
  row: number
  walkup: number
  tenement: number
  factory: number
  warehouse: number
  heavy: number
  rail: number
  cornerShop: number
  mainBlock: number
  civic: number
}

export type PerfSample = {
  fps: number
  frameAvgMs: number
  frameWorstMs: number
  drawCalls: number
  triangles: number
  geometries: number
  textures: number
  camPos: [number, number, number]
  camDir: [number, number, number]
  orbitEnabled: boolean | null
}

export type WalkMapDebug = {
  cells: number
  n: number
  halfExtent: number
  buildMs: number
  at: number
}

export type DebugLive = {
  perf: PerfSample | null
  keysDown: string[]
  jump: JumpDebugInfo | null
  walkMap: WalkMapDebug | null
  forms: FormInstanceCounts
  rebuilds: RebuildEntry[]
}

const emptyForms = (): FormInstanceCounts => ({
  row: 0,
  walkup: 0,
  tenement: 0,
  factory: 0,
  warehouse: 0,
  heavy: 0,
  rail: 0,
  cornerShop: 0,
  mainBlock: 0,
  civic: 0,
})

let enabled = false
let rebuilds: RebuildEntry[] = []
let jump: JumpDebugInfo | null = null
let walkMap: WalkMapDebug | null = null
let forms: FormInstanceCounts = emptyForms()
let perf: PerfSample | null = null
let keysDown: string[] = []
/** Ring of last 60 frame times (ms). */
const frameMs: number[] = []
const FRAME_CAP = 60

export function setDebugRuntimeEnabled(on: boolean): void {
  enabled = on
  if (!on) {
    rebuilds = []
    jump = null
    walkMap = null
    forms = emptyForms()
    perf = null
    keysDown = []
    frameMs.length = 0
  }
}

export function isDebugRuntimeEnabled(): boolean {
  return enabled
}

/**
 * Passthrough when Debug is off — one boolean check, then `fn()`.
 * Optional `after` runs only while Debug is on (e.g. walk-map size meta).
 */
export function timedRebuild<T>(
  kind: RebuildKind | string,
  cause: string,
  fn: () => T,
  after?: (result: T, ms: number) => void,
): T {
  if (!enabled) return fn()
  const t0 = performance.now()
  const result = fn()
  const ms = performance.now() - t0
  rebuilds = [{ at: performance.now(), kind, ms, cause }, ...rebuilds].slice(
    0,
    DEBUG_REBUILD_CAP,
  )
  after?.(result, ms)
  return result
}

export function recordJumpDebug(info: JumpDebugInfo): void {
  if (!enabled) return
  jump = info
}

export function recordWalkMapDebug(meta: WalkMapDebug): void {
  if (!enabled) return
  walkMap = meta
}

export function recordFormInstances(next: FormInstanceCounts): void {
  if (!enabled) return
  forms = next
}

export function recordKeysDown(codes: string[]): void {
  if (!enabled) return
  keysDown = codes
}

export function pushFrameMs(ms: number): void {
  if (!enabled) return
  frameMs.push(ms)
  if (frameMs.length > FRAME_CAP) frameMs.shift()
}

export function recordPerf(sample: Omit<PerfSample, 'fps' | 'frameAvgMs' | 'frameWorstMs'> & {
  fps?: number
}): void {
  if (!enabled) return
  let sum = 0
  let worst = 0
  for (const m of frameMs) {
    sum += m
    if (m > worst) worst = m
  }
  const n = frameMs.length
  const avg = n > 0 ? sum / n : 0
  const fps = n > 0 ? 1000 / Math.max(0.001, avg) : 0
  perf = {
    fps,
    frameAvgMs: avg,
    frameWorstMs: worst,
    drawCalls: sample.drawCalls,
    triangles: sample.triangles,
    geometries: sample.geometries,
    textures: sample.textures,
    camPos: sample.camPos,
    camDir: sample.camDir,
    orbitEnabled: sample.orbitEnabled,
  }
}

export function readDebugLive(): DebugLive {
  return {
    perf,
    keysDown: keysDown.slice(),
    jump,
    walkMap,
    forms: { ...forms },
    rebuilds: rebuilds.slice(),
  }
}
