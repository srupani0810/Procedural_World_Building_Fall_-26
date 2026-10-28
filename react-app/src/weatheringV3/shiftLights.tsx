import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, type PointLight } from 'three'
import {
  cellCentroid,
  cellWear,
  gridKey,
  stageMarks,
  type GridCell,
  type GridLayout,
  type StageThresholds,
} from './epGrid.ts'
import type { DecayParams } from './epParams.ts'

/** Real point lights the stage system may turn on at once. The pool size stays fixed. */
export const STAGE_LIGHT_BUDGET = 8

const STORY = 1.05
const BULB = new Color('#ffe2b8')

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/** Stable 0–1 seed per cell (same legibility standard as other v3 hashes). */
function flickerSeed(ix: number, iz: number, salt: number) {
  const n = Math.sin(ix * 127.1 + iz * 311.7 + salt * 74.7) * 43758.5453
  return n - Math.floor(n)
}

/**
 * Seeded on/off cycle for inhabited presence lights.
 * Period and phase are fixed per cell; duty (from the slider) sets on-fraction.
 * Evaluated from wall time — not re-randomized each frame.
 */
export function inhabitedFlickerLit(
  ix: number,
  iz: number,
  time: number,
  duty: number,
): boolean {
  const uPeriod = flickerSeed(ix, iz, 3)
  const uPhase = flickerSeed(ix, iz, 11)
  // Slow, readable cycles: ~2.8s–6.4s full period.
  const period = 2.8 + uPeriod * 3.6
  const phase = uPhase * period
  const onFrac = Math.min(0.78, Math.max(0.18, 0.22 + duty * 0.5))
  const local = ((time + phase) % period + period) % period
  return local < period * onFrac
}

export type StageLightSample = {
  intensity: number
  bulbGlow: number
  /** Discrete inhabited presence lamp state (false when not inhabited). */
  flickerLit: boolean
  x: number
  y: number
  z: number
}

export type LightTuning = {
  thresholds: StageThresholds
  /** On-fraction of each inhabited cell’s seeded flicker cycle (0–1). */
  flickerProbability: number
}

export function tuningFromDecay(decay: DecayParams): LightTuning {
  return {
    thresholds: stageMarks(decay.settledAt, decay.abandonedAt, decay.reclaimedAt),
    flickerProbability: decay.flickerProbability,
  }
}

/**
 * Stage lights at the bulb. Flicker (discrete on/off) only on cells with
 * `cell.inhabited === true`. No barrel / candle / ground fires.
 */
export function stageLightSample(
  cell: GridCell,
  layout: GridLayout,
  time: number,
  tuning: LightTuning,
): StageLightSample {
  const wear = cellWear(cell.age, tuning.thresholds)
  const [cx, cz] = cellCentroid(cell.ix, cell.iz, layout)
  const scale = Math.max(0.2, layout.buildingScale ?? 1)
  const bulbY = cell.baseY + Math.max(cell.height, 1) * STORY * 0.78 * scale

  const fresh = 1 - smoothstep(0.2, 1, wear)
  const settled = smoothstep(0.25, 0.85, wear) * (1 - smoothstep(1.15, 1.85, wear))
  const abandoned = smoothstep(1.2, 1.85, wear) * (1 - smoothstep(2.15, 2.95, wear))

  const inhabited = cell.inhabited === true
  const duty = Math.min(1, Math.max(0, tuning.flickerProbability))
  const flickerLit = inhabited ? inhabitedFlickerLit(cell.ix, cell.iz, time, duty) : false

  let bulbGlow: number
  if (inhabited) {
    // Barely-held presence: clear on vs near-off, not continuous noise.
    bulbGlow = flickerLit
      ? fresh * 1.05 + settled * 0.58 + abandoned * 0.22
      : fresh * 0.06 + settled * 0.04 + abandoned * 0.02
  } else {
    // Vacated shells: steady by stage. No flicker — absence is the signal.
    bulbGlow = fresh * 1.15 + settled * 0.42 + abandoned * 0.04
  }

  const intensity = bulbGlow * 2.6

  return {
    intensity,
    bulbGlow,
    flickerLit,
    x: cx,
    y: bulbY,
    z: cz,
  }
}

function lightScore(
  cell: GridCell,
  layout: GridLayout,
  camX: number,
  camY: number,
  camZ: number,
  time: number,
  tuning: LightTuning,
) {
  const sample = stageLightSample(cell, layout, time, tuning)
  if (sample.intensity < 0.05) return -1
  const dx = sample.x - camX
  const dy = sample.y - camY
  const dz = sample.z - camZ
  const dist = Math.hypot(dx, dy, dz)
  return sample.intensity + 10 / (dist + 1.5)
}

/**
 * Fills a fixed point-light pool from the closest living stage lights.
 * Also emits flicker on/off process-log events when inhabited lamps change state.
 */
export function StageLightBudget({
  cellsRef,
  layout,
  decayRef,
  onFlickerEvent,
}: {
  cellsRef: { current: Map<string, GridCell> }
  layout: GridLayout
  decayRef: { current: DecayParams }
  /** Fired only when an inhabited cell’s discrete flicker state changes. */
  onFlickerEvent?: (line: string) => void
}) {
  const lights = useRef<Array<PointLight | null>>([])
  const layoutRef = useRef(layout)
  layoutRef.current = layout
  const prevLit = useRef<Map<string, boolean>>(new Map())
  const onFlickerRef = useRef(onFlickerEvent)
  onFlickerRef.current = onFlickerEvent

  useFrame(({ clock, camera }) => {
    const tuning = tuningFromDecay(decayRef.current)
    const time = clock.elapsedTime
    const log = onFlickerRef.current

    for (const cell of cellsRef.current.values()) {
      if (!cell.inhabited) continue
      const key = gridKey(cell.ix, cell.iz)
      const lit = inhabitedFlickerLit(cell.ix, cell.iz, time, tuning.flickerProbability)
      const prev = prevLit.current.get(key)
      if (prev === undefined) {
        prevLit.current.set(key, lit)
        continue
      }
      if (prev !== lit) {
        prevLit.current.set(key, lit)
        const line = `${cell.ix},${cell.iz}  flicker ${lit ? 'on' : 'off'}`
        console.info(`[weathering flicker] ${line}`)
        log?.(line)
      }
    }

    // Drop tracking for lots that were cleared (Reset Grid).
    if (prevLit.current.size > cellsRef.current.size) {
      for (const key of [...prevLit.current.keys()]) {
        if (!cellsRef.current.has(key)) prevLit.current.delete(key)
      }
    }

    const ranked = [...cellsRef.current.values()]
      .map((cell) => ({
        cell,
        score: lightScore(
          cell,
          layoutRef.current,
          camera.position.x,
          camera.position.y,
          camera.position.z,
          time,
          tuning,
        ),
      }))
      .filter((item) => item.score >= 0)
      .sort((a, b) => b.score - a.score || a.cell.ix - b.cell.ix || a.cell.iz - b.cell.iz)

    for (let i = 0; i < STAGE_LIGHT_BUDGET; i++) {
      const light = lights.current[i]
      if (!light) continue
      const pick = ranked[i]
      if (!pick) {
        light.intensity = 0
        continue
      }
      const sample = stageLightSample(pick.cell, layoutRef.current, time, tuning)
      light.position.set(sample.x, sample.y, sample.z)
      light.distance = 9 * Math.max(0.2, layoutRef.current.buildingScale ?? 1)
      light.color.copy(BULB)
      light.intensity = sample.intensity
    }
  })

  const slots = useMemo(() => Array.from({ length: STAGE_LIGHT_BUDGET }, (_, index) => index), [])

  return (
    <>
      {slots.map((index) => (
        <pointLight
          key={index}
          ref={(node) => {
            lights.current[index] = node
          }}
          color="#ffe2b8"
          intensity={0}
          distance={9}
          decay={2}
          castShadow={false}
        />
      ))}
    </>
  )
}
