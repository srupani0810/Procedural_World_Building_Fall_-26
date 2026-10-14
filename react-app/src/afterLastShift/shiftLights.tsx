import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, type Group, type Mesh, type MeshStandardMaterial, type PointLight } from 'three'
import { cellCentroid, cellHasBarrel, cellWear, stageMarks, type GridCell, type GridLayout, type StageThresholds } from './epGrid.ts'
import type { DecayParams } from './epParams.ts'

/** Real point lights the stage system may turn on at once. The pool size stays fixed. */
export const STAGE_LIGHT_BUDGET = 8

const STORY = 1.05
const BULB = new Color('#ffe2b8')
const FIRE = new Color('#ff6a1a')
const scratch = new Color()

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

export type StageLightSample = {
  intensity: number
  /** 0 = incandescent bulb, 1 = barrel fire. */
  fireMix: number
  bulbGlow: number
  fireGlow: number
  x: number
  y: number
  z: number
}

export type LightTuning = {
  thresholds: StageThresholds
  flickerProbability: number
  fireBarrelChance: number
}

export function tuningFromDecay(decay: DecayParams): LightTuning {
  return {
    thresholds: stageMarks(decay.settledAt, decay.abandonedAt, decay.reclaimedAt),
    flickerProbability: decay.flickerProbability,
    fireBarrelChance: decay.fireBarrelChance,
  }
}

/** Bulb hangs in the story; a barrel sits on the ground just outside the cell. */
export function stageLightSample(
  cell: GridCell,
  layout: GridLayout,
  time: number,
  tuning: LightTuning,
): StageLightSample {
  const wear = cellWear(cell.age, tuning.thresholds)
  const [cx, cz] = cellCentroid(cell.ix, cell.iz, layout)
  const bulbY = cell.baseY + Math.max(cell.height, 1) * STORY * 0.78
  const ox = ((cell.ix * 17 + cell.iz * 3) % 5) - 2
  const oz = ((cell.iz * 13 + cell.ix) % 5) - 2
  const barrelX = cx + ox * 0.18
  const barrelZ = cz + oz * 0.18
  const barrelY = cell.baseY + 0.42

  const flutter = Math.abs(
    Math.sin(time * 21 + cell.ix * 1.7) * Math.sin(time * 13.4 + cell.iz * 2.2),
  )
  const flicker = Math.min(1, Math.max(0, tuning.flickerProbability))
  const dimSteady = 0.62
  const flickering = 0.28 + 0.72 * flutter
  const settledFlicker = dimSteady * (1 - flicker) + flickering * flicker
  const failing = flutter > 0.9 ? 0.42 : 0.05
  const fireFlicker = 0.62 + 0.38 * flutter

  const fresh = 1 - smoothstep(0.2, 1, wear)
  const settled = smoothstep(0.25, 0.85, wear) * (1 - smoothstep(1.15, 1.85, wear))
  const abandoned = smoothstep(1.2, 1.85, wear) * (1 - smoothstep(2.15, 2.95, wear))
  const inhabited = cellHasBarrel(cell.ix, cell.iz, tuning.fireBarrelChance)

  const bulbGlow =
    fresh * 1.15 + settled * settledFlicker * 0.7 + (inhabited ? abandoned * 0.08 : abandoned * failing)
  const fireGlow = inhabited ? abandoned * fireFlicker : 0
  const intensity = bulbGlow * 2.6 + fireGlow * 3.4
  const fireMix = intensity > 0.04 ? fireGlow / (bulbGlow + fireGlow + 0.0001) : 0

  return {
    intensity,
    fireMix,
    bulbGlow,
    fireGlow,
    x: cx + (barrelX - cx) * fireMix,
    y: bulbY + (barrelY - bulbY) * fireMix,
    z: cz + (barrelZ - cz) * fireMix,
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
 * Ambient, hemisphere, and directional lights in the scene stay as they are.
 */
export function StageLightBudget({
  cellsRef,
  layout,
  decayRef,
}: {
  cellsRef: { current: Map<string, GridCell> }
  layout: GridLayout
  decayRef: { current: DecayParams }
}) {
  const lights = useRef<Array<PointLight | null>>([])
  const layoutRef = useRef(layout)
  layoutRef.current = layout

  useFrame(({ clock, camera }) => {
    const tuning = tuningFromDecay(decayRef.current)
    const ranked = [...cellsRef.current.values()]
      .map((cell) => ({
        cell,
        score: lightScore(
          cell,
          layoutRef.current,
          camera.position.x,
          camera.position.y,
          camera.position.z,
          clock.elapsedTime,
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
      const sample = stageLightSample(pick.cell, layoutRef.current, clock.elapsedTime, tuning)
      light.position.set(sample.x, sample.y, sample.z)
      light.color.copy(scratch.copy(BULB).lerp(FIRE, sample.fireMix))
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

/** The visible bulb or barrel. Illumination itself comes from the shared budget. */
export function CellStageFixture({
  cell,
  cellSize,
  warp,
  decayRef,
}: {
  cell: GridCell
  cellSize: number
  warp: number
  decayRef: { current: DecayParams }
}) {
  const bulbMat = useRef<MeshStandardMaterial>(null)
  const bulbMesh = useRef<Mesh>(null)
  const fireMat = useRef<MeshStandardMaterial>(null)
  const barrel = useRef<Group>(null)
  const flames = useRef<Group>(null)
  const layout = useMemo(() => ({ cellSize, warp }), [cellSize, warp])
  const [cx, cz] = cellCentroid(cell.ix, cell.iz, layout)
  const bulbY = cell.baseY + Math.max(cell.height, 1) * STORY * 0.78
  const ox = ((cell.ix * 17 + cell.iz * 3) % 5) - 2
  const oz = ((cell.iz * 13 + cell.ix) % 5) - 2

  useFrame(({ clock }) => {
    const sample = stageLightSample(cell, layout, clock.elapsedTime, tuningFromDecay(decayRef.current))
    if (bulbMat.current) {
      bulbMat.current.emissiveIntensity = sample.bulbGlow * 2.2
      bulbMat.current.emissive.set('#ffe2b8')
    }
    if (bulbMesh.current) bulbMesh.current.visible = sample.bulbGlow > 0.04
    if (fireMat.current) {
      fireMat.current.emissiveIntensity = sample.fireGlow * 1.4
    }
    if (barrel.current) barrel.current.visible = sample.fireGlow > 0.04
    if (flames.current) {
      const pulse = 0.75 + 0.35 * Math.abs(Math.sin(clock.elapsedTime * 14 + cell.ix))
      flames.current.visible = sample.fireGlow > 0.04
      flames.current.scale.setScalar(sample.fireGlow * pulse)
    }
  })

  return (
    <group>
      <mesh ref={bulbMesh} position={[cx, bulbY, cz]} raycast={() => null}>
        <sphereGeometry args={[0.07, 10, 8]} />
        <meshStandardMaterial
          ref={bulbMat}
          color="#1a140e"
          emissive="#ffe2b8"
          emissiveIntensity={1}
          roughness={0.4}
          metalness={0}
        />
      </mesh>
      <group ref={barrel} visible={false} position={[cx + ox * 0.18, cell.baseY, cz + oz * 0.18]}>
        <mesh position={[0, 0.16, 0]} raycast={() => null}>
          <cylinderGeometry args={[0.16, 0.18, 0.32, 8]} />
          <meshStandardMaterial ref={fireMat} color="#2a211c" emissive="#ff6a1a" emissiveIntensity={0} roughness={1} metalness={0} />
        </mesh>
        <group ref={flames} position={[0, 0.36, 0]}>
          <mesh position={[0, 0.12, 0]} raycast={() => null}>
            <coneGeometry args={[0.09, 0.28, 6]} />
            <meshBasicMaterial color="#ffb15a" transparent opacity={0.9} />
          </mesh>
          <mesh position={[0.04, 0.2, 0]} raycast={() => null}>
            <coneGeometry args={[0.05, 0.18, 5]} />
            <meshBasicMaterial color="#ff6a1a" transparent opacity={0.85} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
