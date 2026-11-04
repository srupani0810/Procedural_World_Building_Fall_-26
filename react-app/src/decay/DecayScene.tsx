/**
 * DECAY tab — noise terrain + editable draped road graph + building fields.
 */

import { useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { TerrainParams } from '../terrainParams.ts'
import type { BuildingFormCensus, BuildingHoverInfo } from './buildings.ts'
import type { PlayerClaim } from './claims.ts'
import type { FieldMaps } from './fields.ts'
import type { LandUseViewMode } from './landUse.ts'
import type { MaterialityParams } from './materiality.ts'
import { DecayFog, DecaySky, StreamedNoiseGround } from './noiseGround.tsx'
import type { JumpDebugInfo } from './DecayFirstPerson.tsx'
import { RoadNetwork } from './RoadNetwork.tsx'
import {
  DECAY_SKY,
  JUMP_SKY,
  type BuildingParams,
  type DecaySelection,
  type DecayViewParams,
  type RoadCensus,
  type RoadNetworkParams,
} from './params.ts'
import type { AbsenceClockParams, StageCounts } from './timeline.ts'

/** Expose camera/controls for tooling / screenshots (window.__decayView). */
function DecayViewApi() {
  const { camera, controls } = useThree()
  useEffect(() => {
    ;(window as unknown as { __decayView?: unknown }).__decayView = { camera, controls }
    return () => {
      delete (window as unknown as { __decayView?: unknown }).__decayView
    }
  }, [camera, controls])
  return null
}

export type DecaySceneProps = {
  terrain: TerrainParams
  view: DecayViewParams
  roads: RoadNetworkParams
  graphReset: number
  fields: FieldMaps
  fieldRevision: number
  buildings: BuildingParams
  materiality: MaterialityParams
  timelineT: number
  absenceClock: AbsenceClockParams
  tintMode?: LandUseViewMode
  onRoadLog: (lines: string[]) => void
  onCensus: (census: RoadCensus) => void
  onSelection?: (sel: DecaySelection) => void
  onFieldsPainted: () => void
  onBuildingHover: (info: BuildingHoverInfo | null, sx: number, sy: number) => void
  onAppendLog: (lines: string[]) => void
  onStageCensus: (counts: StageCounts) => void
  onStageSeries: (series: { t: number; counts: StageCounts }[]) => void
  claims?: PlayerClaim[]
  claimEnabled?: boolean
  onClaim?: (plotId: number) => void
  onFormCensus?: (census: BuildingFormCensus) => void
  /** Jump In first-person walk. */
  jumpIn?: boolean
  onExitJumpIn?: () => void
  onJumpFail?: (reason: string) => void
  onAppendJumpLog?: (line: string) => void
  onJumpDebug?: (info: JumpDebugInfo) => void
}

export default function DecayScene({
  terrain,
  view,
  roads,
  graphReset,
  fields,
  fieldRevision,
  buildings,
  materiality,
  timelineT,
  absenceClock,
  tintMode = 'normal',
  onRoadLog,
  onCensus,
  onSelection,
  onFieldsPainted,
  onBuildingHover,
  onAppendLog,
  onStageCensus,
  onStageSeries,
  claims = [],
  claimEnabled = false,
  onClaim,
  onFormCensus,
  jumpIn = false,
  onExitJumpIn,
  onJumpFail,
  onAppendJumpLog,
  onJumpDebug,
}: DecaySceneProps) {
  const graphKey = [
    graphReset,
    roads.spacing,
    roads.angleDeg,
    roads.diagonals ? 1 : 0,
    roads.diagonalSpacing,
    roads.slopeLimit,
    roads.halfExtent,
    roads.mainEvery,
    roads.collectorEvery,
    terrain.noiseId,
    terrain.frequency,
    terrain.amplitude,
    terrain.extras[terrain.noiseId],
  ].join('|')

  return (
    <Canvas
      className="viewport-canvas"
      camera={{ position: [0, 340, 12], fov: 62, near: 0.05, far: 4000 }}
      gl={{ antialias: true }}
      dpr={[1, 1.75]}
    >
      <color attach="background" args={[jumpIn ? JUMP_SKY : DECAY_SKY]} />
      <DecaySky jumpIn={jumpIn} />
      <DecayFog density={view.fogDensity} jumpIn={jumpIn} />
      <ambientLight intensity={jumpIn ? 0.55 : 0.32} color={jumpIn ? '#d8d2c6' : '#c8c2b8'} />
      <directionalLight
        position={[6, 10, 3]}
        intensity={jumpIn ? 1.2 : 1.05}
        color={jumpIn ? '#f0e6d4' : '#e0e4ea'}
      />
      <directionalLight
        position={[-4, 3, -5]}
        intensity={jumpIn ? 0.38 : 0.3}
        color={jumpIn ? '#a8b0b8' : '#8a949e'}
      />
      <StreamedNoiseGround terrain={terrain} fogDensity={view.fogDensity} />
      <RoadNetwork
        key={graphKey}
        terrain={terrain}
        roads={roads}
        view={view}
        resetToken={graphReset}
        onLog={onRoadLog}
        onCensus={onCensus}
        onSelection={onSelection}
        fields={fields}
        fieldRevision={fieldRevision}
        buildings={buildings}
        materiality={materiality}
        timelineT={timelineT}
        absenceClock={absenceClock}
        tintMode={tintMode}
        onFieldsPainted={onFieldsPainted}
        onBuildingHover={onBuildingHover}
        onAppendLog={onAppendLog}
        onStageCensus={onStageCensus}
        onStageSeries={onStageSeries}
        claims={claims}
        claimEnabled={claimEnabled && !jumpIn}
        onClaim={onClaim}
        onFormCensus={onFormCensus}
        jumpIn={jumpIn}
        onExitJumpIn={onExitJumpIn}
        onJumpFail={onJumpFail}
        onAppendJumpLog={onAppendJumpLog}
        onJumpDebug={onJumpDebug}
      />
      <OrbitControls
        makeDefault
        enabled={!jumpIn}
        enableRotate={!jumpIn}
        enablePan={!jumpIn}
        enableZoom={!jumpIn}
        // Arrow keys are for Jump In walk — never pan the orbit camera with them here.
        keyEvents={false}
        target={[0, 2, 0]}
        maxPolarAngle={Math.PI * 0.495}
        minPolarAngle={0}
        minDistance={6}
        maxDistance={480}
      />
      <DecayViewApi />
    </Canvas>
  )
}
