import { useCallback, useEffect, useRef, useState } from 'react'
import AppChrome from './AppChrome.tsx'
import HeightMapView from './HeightMapView.tsx'
import NoiseMap from './NoiseMap.tsx'
import Scene from './Scene.tsx'
import VoxelScene from './VoxelScene.tsx'
import ShaderScene from './ShaderScene.tsx'
import ExperientialScene from './ExperientialScene.tsx'
import WeatheringScene from './weathering/WeatheringScene.tsx'
import WeatheringV2Scene from './weatheringV2/WeatheringV2Scene.tsx'
import WeatheringV3Scene from './weatheringV3/WeatheringV3Scene.tsx'
import type { TownPhase } from './weatheringV3/timeline.ts'
import { INTRO_DURATION } from './weatheringV3/timeline.ts'
import DecayScene from './decay/DecayScene.tsx'
import { DecayShell } from './decay/DecayShell.tsx'
import type { BuildingHoverInfo } from './decay/buildings.ts'
import type { PlayerClaim } from './decay/claims.ts'
import { createDefaultFieldMaps, resetField, type FieldMaps } from './decay/fields.ts'
import {
  createDefaultMateriality,
  type MaterialityParams,
} from './decay/materiality.ts'
import {
  defaultAbsenceClock,
  emptyStageCounts,
  INTRO_DURATION as DECAY_INTRO_DURATION,
  INTRO_PLAY_SPEED as DECAY_INTRO_PLAY_SPEED,
  type AbsenceClockParams,
  type StageCounts,
} from './decay/timeline.ts'
import {
  createDefaultDecayTerrain,
  defaultBuildingParams,
  defaultDecayView,
  defaultRoadNetwork,
  emptyRoadCensus,
} from './decay/params.ts'
import type {
  BuildingParams,
  DecayScreen,
  DecaySelection,
  DecayViewParams,
  DecayViewTab,
  RoadCensus,
  RoadNetworkParams,
} from './decay/params.ts'
import { defaultV2Params } from './weatheringV2/params.ts'
import type { V2Params } from './weatheringV2/params.ts'
import { createDefaultV2Terrain, createDefaultV2Voxel } from './weatheringV2/worldDefaults.ts'
import { HEIGHTMAP_SIZE, createHeightmap, defaultErosionParams } from './erosion.ts'
import type { ErosionParams } from './erosion.ts'
import {
  createDefaultEpTerrain,
  createDefaultEpVoxel,
  defaultEpParams,
} from './epParams.ts'
import type { EpParams } from './epParams.ts'
import {
  createDefaultEpTerrain as createDefaultShiftTerrain,
  createDefaultEpVoxel as createDefaultShiftVoxel,
  defaultDecayParams,
  defaultEpParams as defaultShiftParams,
} from './weathering/epParams.ts'
import type { DecayParams, EpParams as ShiftEpParams } from './weathering/epParams.ts'
import {
  createDefaultEpTerrain as createDefaultV3Terrain,
  createDefaultEpVoxel as createDefaultV3Voxel,
  defaultDecayParams as defaultV3DecayParams,
  defaultEpParams as defaultV3Params,
} from './weatheringV3/epParams.ts'
import type {
  DecayParams as V3DecayParams,
  EpParams as V3EpParams,
} from './weatheringV3/epParams.ts'
import { defaultTerrainParams, normalizeTerrainPatch } from './terrainParams.ts'
import type { TerrainParams, TwoDTab, ViewMode } from './terrainParams.ts'
import { defaultHeightGradient } from './heightGradient.ts'
import type { GradientStop } from './heightGradient.ts'
import { defaultVoxelParams } from './voxelParams.ts'
import type { VoxelParams, VoxelRenderMode } from './voxelParams.ts'
import type { ShaderStudyId } from './shaderStudies.ts'
import './App.css'

function App() {
  const [mode, setMode] = useState<ViewMode>('3d')
  const [twoDTab, setTwoDTab] = useState<TwoDTab>('field')
  const [params, setParams] = useState<TerrainParams>(defaultTerrainParams)
  const [voxelParams, setVoxelParams] = useState<VoxelParams>(defaultVoxelParams)
  const [shaderStudy, setShaderStudy] = useState<ShaderStudyId>('displace')
  /** Shaders-tab meshing only — does not change Voxels `voxelParams.renderMode`. */
  const [shaderMeshMode, setShaderMeshMode] = useState<VoxelRenderMode>('marching')
  const [epParams, setEpParams] = useState<EpParams>(defaultEpParams)
  /** Fully detached EP world — not shared with Voxels / Shaders / main Noise. */
  const [epTerrain, setEpTerrain] = useState<TerrainParams>(() => createDefaultEpTerrain())
  const [epVoxel, setEpVoxel] = useState<VoxelParams>(() => createDefaultEpVoxel())
  const [epFirstPerson, setEpFirstPerson] = useState(false)
  const [gridReset, setGridReset] = useState(0)
  const [shiftParams, setShiftParams] = useState<ShiftEpParams>(defaultShiftParams)
  const [shiftTerrain, setShiftTerrain] = useState<TerrainParams>(() => createDefaultShiftTerrain())
  const [shiftVoxel, setShiftVoxel] = useState<VoxelParams>(() => createDefaultShiftVoxel())
  const [shiftFirstPerson, setShiftFirstPerson] = useState(false)
  const [shiftGridReset, setShiftGridReset] = useState(0)
  const [decayParams, setDecayParams] = useState<DecayParams>(defaultDecayParams)
  const [decayReset, setDecayReset] = useState(0)
  const [townDecay, setTownDecay] = useState(0)
  const [ageReadout, setAgeReadout] = useState<{ lines: string[]; waterNote: boolean }>({
    lines: [],
    waterNote: false,
  })
  const onAgeReadout = useCallback((lines: string[], waterNote: boolean) => {
    setAgeReadout({ lines, waterNote })
  }, [])
  const [v2Params, setV2Params] = useState<V2Params>(defaultV2Params)
  const [v2Terrain, setV2Terrain] = useState<TerrainParams>(() => createDefaultV2Terrain())
  const [v2Voxel, setV2Voxel] = useState<VoxelParams>(() => createDefaultV2Voxel())
  const [v2GridReset, setV2GridReset] = useState(0)
  const [v2StepToken, setV2StepToken] = useState(0)
  const [v2Log, setV2Log] = useState<string[]>([])
  const [v2Census, setV2Census] = useState('')
  /** Weathering v3 — independent clone of Weathering state (not shared with shift / v2). */
  const [v3Params, setV3Params] = useState<V3EpParams>(defaultV3Params)
  const [v3Terrain, setV3Terrain] = useState<TerrainParams>(() => createDefaultV3Terrain())
  const [v3Voxel, setV3Voxel] = useState<VoxelParams>(() => createDefaultV3Voxel())
  const [v3FirstPerson, setV3FirstPerson] = useState(false)
  const [v3GridReset, setV3GridReset] = useState(0)
  const [v3DecayParams, setV3DecayParams] = useState<V3DecayParams>(defaultV3DecayParams)
  const [v3DecayReset, setV3DecayReset] = useState(0)
  const [v3TownDecay, setV3TownDecay] = useState(0)
  const [v3AgeReadout, setV3AgeReadout] = useState<{ lines: string[]; waterNote: boolean }>({
    lines: [],
    waterNote: false,
  })
  const onV3AgeReadout = useCallback((lines: string[], waterNote: boolean) => {
    setV3AgeReadout({ lines, waterNote })
  }, [])
  const [v3Phase, setV3Phase] = useState<TownPhase>('intro')
  const [v3TimelineT, setV3TimelineT] = useState(0)
  const [v3TimelinePlaying, setV3TimelinePlaying] = useState(false)
  /** DECAY tab — greenfield; terrain + fields + buildings (not shared with Weathering / v2 / v3). */
  const [decayTerrain, setDecayTerrain] = useState<TerrainParams>(() => createDefaultDecayTerrain())
  const [decayView, setDecayView] = useState<DecayViewParams>(defaultDecayView)
  const [decayRoads, setDecayRoads] = useState<RoadNetworkParams>(defaultRoadNetwork)
  const [decayBuildings, setDecayBuildings] = useState<BuildingParams>(defaultBuildingParams)
  const [decayMateriality, setDecayMateriality] = useState<MaterialityParams>(() =>
    createDefaultMateriality(),
  )
  const [decayFields, setDecayFields] = useState<FieldMaps>(() =>
    createDefaultFieldMaps(createDefaultDecayTerrain()),
  )
  const [decayFieldRevision, setDecayFieldRevision] = useState(0)
  const [decayRoadLog, setDecayRoadLog] = useState<string[]>([])
  const [decayTimelineT, setDecayTimelineT] = useState(0)
  const [decayTimelinePlaying, setDecayTimelinePlaying] = useState(false)
  const [decayAbsenceClock, setDecayAbsenceClock] =
    useState<AbsenceClockParams>(defaultAbsenceClock)
  const [decayStageCounts, setDecayStageCounts] = useState<StageCounts>(emptyStageCounts)
  const [decayStageSeries, setDecayStageSeries] = useState<
    { t: number; counts: StageCounts }[]
  >([])
  const [decayClaims, setDecayClaims] = useState<PlayerClaim[]>([])
  const decayTimelineTRef = useRef(0)
  decayTimelineTRef.current = decayTimelineT
  const appendDecayLog = useCallback((lines: string[]) => {
    setDecayRoadLog((prev) => {
      const next = [...prev, ...lines]
      return next.length > 400 ? next.slice(next.length - 400) : next
    })
  }, [])
  const onDecayClaim = useCallback((plotId: number) => {
    setDecayClaims((prev) => {
      if (prev.some((c) => c.plotId === plotId)) return prev
      return [
        ...prev,
        { plotId, stories: 1, claimTime: decayTimelineTRef.current },
      ]
    })
  }, [])

  useEffect(() => {
    if (!decayTimelinePlaying || mode !== 'decay') return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      setDecayTimelineT((t) => {
        const next = Math.min(DECAY_INTRO_DURATION, t + dt * DECAY_INTRO_PLAY_SPEED)
        if (next >= DECAY_INTRO_DURATION) setDecayTimelinePlaying(false)
        return next
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [decayTimelinePlaying, mode])
  const [decayCensus, setDecayCensus] = useState<RoadCensus>(emptyRoadCensus)
  const [decayGraphReset, setDecayGraphReset] = useState(0)
  const [decayScreen, setDecayScreen] = useState<DecayScreen>('entry')
  const [decayViewTab, setDecayViewTab] = useState<DecayViewTab>('3d')
  const [decaySelection, setDecaySelection] = useState<DecaySelection>({
    draggingId: null,
    selectedId: null,
  })
  const [decayBuildingHover, setDecayBuildingHover] = useState<{
    info: BuildingHoverInfo | null
    sx: number
    sy: number
  }>({ info: null, sx: 0, sy: 0 })
  const onDecayBuildingHover = useCallback(
    (info: BuildingHoverInfo | null, sx: number, sy: number) => {
      setDecayBuildingHover((prev) => {
        if (
          prev.info?.plotId === info?.plotId &&
          prev.info == null &&
          info == null &&
          Math.abs(prev.sx - sx) < 1 &&
          Math.abs(prev.sy - sy) < 1
        ) {
          return prev
        }
        return { info, sx, sy }
      })
    },
    [],
  )
  const [heightGradient, setHeightGradient] = useState<GradientStop[]>(() =>
    defaultHeightGradient.map((stop) => ({ ...stop })),
  )
  const [erosion, setErosion] = useState<ErosionParams>(defaultErosionParams)
  const [running, setRunning] = useState(false)
  const [firstPerson, setFirstPerson] = useState(false)
  const [mapRevision, setMapRevision] = useState(0)
  const mapRef = useRef<Float32Array | null>(null)
  const paramsRef = useRef(params)
  paramsRef.current = params

  const ensureMap = useCallback(() => {
    if (!mapRef.current) {
      mapRef.current = createHeightmap(paramsRef.current, HEIGHTMAP_SIZE)
      setMapRevision((value) => value + 1)
    }
  }, [])

  const resetMap = useCallback(() => {
    mapRef.current = createHeightmap(paramsRef.current, HEIGHTMAP_SIZE)
    setMapRevision((value) => value + 1)
  }, [])

  const handleMode = (next: ViewMode) => {
    setMode(next)
    if (next !== '2d') {
      setRunning(false)
    }
    if (next !== 'voxels') {
      setFirstPerson(false)
    }
    if (next !== 'ep') {
      setEpFirstPerson(false)
    }
    if (next !== 'shift') {
      setShiftFirstPerson(false)
    }
    if (next !== 'shift3') {
      setV3FirstPerson(false)
    }
  }

  const handleTwoDTab = (tab: TwoDTab) => {
    setTwoDTab(tab)
    if (tab === 'sim') {
      ensureMap()
    } else {
      setRunning(false)
    }
  }

  const showSim = mode === '2d' && twoDTab === 'sim'

  return (
    <div className="app">
      <div className="viewport">
        {mode === '3d' ? (
          <Scene params={params} />
        ) : mode === 'voxels' ? (
          <VoxelScene
            terrain={params}
            voxel={voxelParams}
            gradient={heightGradient}
            firstPerson={firstPerson}
            onExitFirstPerson={() => setFirstPerson(false)}
          />
        ) : mode === 'shaders' ? (
          <ShaderScene
            terrain={params}
            voxel={voxelParams}
            study={shaderStudy}
            meshMode={shaderMeshMode}
            gradient={heightGradient}
          />
        ) : mode === 'ep' ? (
          <ExperientialScene
            terrain={epTerrain}
            voxel={epVoxel}
            ep={epParams}
            firstPerson={epFirstPerson}
            onExitFirstPerson={() => setEpFirstPerson(false)}
            gridReset={gridReset}
          />
        ) : mode === 'shift' ? (
          <WeatheringScene
            terrain={shiftTerrain}
            voxel={shiftVoxel}
            ep={shiftParams}
            firstPerson={shiftFirstPerson}
            onExitFirstPerson={() => setShiftFirstPerson(false)}
            gridReset={shiftGridReset}
            decay={decayParams}
            decayReset={decayReset}
            onTownDecay={setTownDecay}
            onAgeReadout={onAgeReadout}
          />
        ) : mode === 'shift2' ? (
          <WeatheringV2Scene
            terrain={v2Terrain}
            voxel={v2Voxel}
            params={v2Params}
            gridReset={v2GridReset}
            stepToken={v2StepToken}
            onLog={setV2Log}
            onCensus={setV2Census}
          />
        ) : mode === 'shift3' ? (
          <WeatheringV3Scene
            terrain={v3Terrain}
            voxel={v3Voxel}
            ep={v3Params}
            firstPerson={v3FirstPerson}
            onExitFirstPerson={() => setV3FirstPerson(false)}
            gridReset={v3GridReset}
            decay={v3DecayParams}
            decayReset={v3DecayReset}
            onTownDecay={setV3TownDecay}
            onAgeReadout={onV3AgeReadout}
            phase={v3Phase}
            timelineT={v3TimelineT}
            timelinePlaying={v3TimelinePlaying}
            onTimelineT={(t) => {
              const clamped = Math.max(0, Math.min(INTRO_DURATION, t))
              setV3TimelineT(clamped)
              if (clamped >= INTRO_DURATION) {
                setV3TimelinePlaying(false)
                setV3Phase('ongoing')
              }
            }}
            onPhase={setV3Phase}
            onTimelinePlaying={setV3TimelinePlaying}
          />
        ) : mode === 'decay' ? (
          <DecayScene
            terrain={decayTerrain}
            view={decayView}
            roads={decayRoads}
            graphReset={decayGraphReset}
            fields={decayFields}
            fieldRevision={decayFieldRevision}
            buildings={decayBuildings}
            materiality={decayMateriality}
            timelineT={decayTimelineT}
            absenceClock={decayAbsenceClock}
            stageTint={decayScreen === 'phase1' || decayScreen === 'phase2'}
            onRoadLog={setDecayRoadLog}
            onCensus={setDecayCensus}
            onSelection={setDecaySelection}
            onFieldsPainted={() => setDecayFieldRevision((n) => n + 1)}
            onBuildingHover={onDecayBuildingHover}
            onAppendLog={appendDecayLog}
            onStageCensus={setDecayStageCounts}
            onStageSeries={setDecayStageSeries}
            claims={decayClaims}
            claimEnabled={decayScreen === 'phase2'}
            onClaim={onDecayClaim}
          />
        ) : showSim ? (
          <HeightMapView
            mapRef={mapRef}
            size={HEIGHTMAP_SIZE}
            running={running}
            simulate
            erosion={erosion}
            revision={mapRevision}
            className="noise-view"
          />
        ) : (
          <NoiseMap params={params} resolution={256} className="noise-view" />
        )}
      </div>
      {mode === 'decay' ? (
        <DecayShell
          screen={decayScreen}
          onScreen={setDecayScreen}
          viewTab={decayViewTab}
          onViewTab={setDecayViewTab}
          roads={decayRoads}
          view={decayView}
          buildings={decayBuildings}
          materiality={decayMateriality}
          census={decayCensus}
          roadLog={decayRoadLog}
          selection={decaySelection}
          buildingHover={decayBuildingHover}
          timelineT={decayTimelineT}
          timelinePlaying={decayTimelinePlaying}
          absenceClock={decayAbsenceClock}
          stageCounts={decayStageCounts}
          stageSeries={decayStageSeries}
          onRoads={(patch) => setDecayRoads((c) => ({ ...c, ...patch }))}
          onView={(patch) => setDecayView((c) => ({ ...c, ...patch }))}
          onBuildings={(patch) => setDecayBuildings((c) => ({ ...c, ...patch }))}
          onMateriality={(patch) => setDecayMateriality((c) => ({ ...c, ...patch }))}
          onMaterialityReplace={setDecayMateriality}
          onAppendLog={appendDecayLog}
          onTimelineT={setDecayTimelineT}
          onTimelinePlaying={setDecayTimelinePlaying}
          onAbsenceClock={(patch) => setDecayAbsenceClock((c) => ({ ...c, ...patch }))}
          onResetField={(kind) => {
            setDecayFields((maps) => resetField(maps, kind, decayTerrain))
            setDecayFieldRevision((n) => n + 1)
          }}
          onResetGraph={() => {
            setDecayClaims([])
            setDecayGraphReset((n) => n + 1)
          }}
          onLeaveApp={() => {
            setDecayScreen('entry')
            handleMode('3d')
          }}
        />
      ) : null}
      {mode === 'decay' ? null : (
      <AppChrome
        mode={mode}
        twoDTab={twoDTab}
        params={params}
        voxelParams={voxelParams}
        heightGradient={heightGradient}
        erosion={erosion}
        running={running}
        mapRef={mapRef}
        mapRevision={mapRevision}
        mapSize={HEIGHTMAP_SIZE}
        onMode={handleMode}
        onTwoDTab={handleTwoDTab}
        onChange={(patch) =>
          setParams((current) => ({ ...current, ...normalizeTerrainPatch(patch) }))
        }
        onVoxelChange={(patch) => setVoxelParams((current) => ({ ...current, ...patch }))}
        onHeightGradientChange={setHeightGradient}
        onErosion={(patch) => setErosion((current) => ({ ...current, ...patch }))}
        shaderStudy={shaderStudy}
        onShaderStudy={setShaderStudy}
        shaderMeshMode={shaderMeshMode}
        onShaderMeshMode={setShaderMeshMode}
        epParams={epParams}
        onEpChange={(patch) => setEpParams((current) => ({ ...current, ...patch }))}
        epTerrain={epTerrain}
        onEpTerrainChange={(patch) =>
          setEpTerrain((current) => ({ ...current, ...normalizeTerrainPatch(patch) }))
        }
        epVoxel={epVoxel}
        onEpVoxelChange={(patch) => setEpVoxel((current) => ({ ...current, ...patch }))}
        shiftParams={shiftParams}
        onShiftChange={(patch) => setShiftParams((current) => ({ ...current, ...patch }))}
        shiftTerrain={shiftTerrain}
        onShiftTerrainChange={(patch) =>
          setShiftTerrain((current) => ({ ...current, ...normalizeTerrainPatch(patch) }))
        }
        shiftVoxel={shiftVoxel}
        onShiftVoxelChange={(patch) => setShiftVoxel((current) => ({ ...current, ...patch }))}
        onResetShiftGrid={() => setShiftGridReset((value) => value + 1)}
        decayParams={decayParams}
        onDecayChange={(patch) => setDecayParams((current) => ({ ...current, ...patch }))}
        onResetDecay={() => setDecayReset((value) => value + 1)}
        townDecay={townDecay}
        ageReadout={ageReadout}
        v2Params={v2Params}
        onV2Change={(patch) => setV2Params((current) => ({ ...current, ...patch }))}
        v2Terrain={v2Terrain}
        onV2TerrainChange={(patch) =>
          setV2Terrain((current) => ({ ...current, ...normalizeTerrainPatch(patch) }))
        }
        v2Voxel={v2Voxel}
        onV2VoxelChange={(patch) => setV2Voxel((current) => ({ ...current, ...patch }))}
        onResetV2Grid={() => setV2GridReset((value) => value + 1)}
        onV2Step={() => setV2StepToken((value) => value + 1)}
        v2Log={v2Log}
        v2Census={v2Census}
        v3Params={v3Params}
        onV3Change={(patch) => setV3Params((current) => ({ ...current, ...patch }))}
        v3Terrain={v3Terrain}
        onV3TerrainChange={(patch) =>
          setV3Terrain((current) => ({ ...current, ...normalizeTerrainPatch(patch) }))
        }
        v3Voxel={v3Voxel}
        onV3VoxelChange={(patch) => setV3Voxel((current) => ({ ...current, ...patch }))}
        onResetV3Grid={() => {
          setV3Phase('intro')
          setV3TimelineT(0)
          setV3TimelinePlaying(false)
          setV3GridReset((value) => value + 1)
        }}
        v3DecayParams={v3DecayParams}
        onV3DecayChange={(patch) => setV3DecayParams((current) => ({ ...current, ...patch }))}
        onResetV3Decay={() => {
          if (v3Phase === 'intro') {
            setV3TimelineT(0)
            setV3TimelinePlaying(false)
          }
          setV3DecayReset((value) => value + 1)
        }}
        v3TownDecay={v3TownDecay}
        v3AgeReadout={v3AgeReadout}
        v3Phase={v3Phase}
        v3TimelineT={v3TimelineT}
        v3TimelinePlaying={v3TimelinePlaying}
        onV3TimelineT={(t) => {
          const clamped = Math.max(0, Math.min(INTRO_DURATION, t))
          setV3TimelineT(clamped)
          if (clamped >= INTRO_DURATION) {
            setV3TimelinePlaying(false)
            setV3Phase('ongoing')
          } else if (v3Phase === 'ongoing' && clamped < INTRO_DURATION) {
            // Scrubbing backward from the end returns to intro watch mode.
            setV3Phase('intro')
          }
        }}
        onV3TimelinePlaying={setV3TimelinePlaying}
        onV3EnterOngoing={() => {
          setV3TimelineT(INTRO_DURATION)
          setV3TimelinePlaying(false)
          setV3Phase('ongoing')
        }}
        decayTerrain={decayTerrain}
        onDecayTerrain={(patch) =>
          setDecayTerrain((current) => ({ ...current, ...normalizeTerrainPatch(patch) }))
        }
        onResetDecayTerrain={() => setDecayTerrain(createDefaultDecayTerrain())}
        decayView={decayView}
        onDecayView={(patch) => setDecayView((c) => ({ ...c, ...patch }))}
        decayRoads={decayRoads}
        onDecayRoads={(patch) => setDecayRoads((c) => ({ ...c, ...patch }))}
        onResetDecayGraph={() => setDecayGraphReset((n) => n + 1)}
        decayRoadLog={decayRoadLog}
        decayCensus={decayCensus}
        firstPerson={
          mode === 'ep'
            ? epFirstPerson
            : mode === 'shift'
              ? shiftFirstPerson
              : mode === 'shift3'
                ? v3FirstPerson
                : firstPerson
        }
        onJumpIn={() => {
          if (mode === 'ep') setEpFirstPerson(true)
          else if (mode === 'shift') setShiftFirstPerson(true)
          else if (mode === 'shift3') setV3FirstPerson(true)
          else setFirstPerson(true)
        }}
        onExitFirstPerson={() => {
          if (mode === 'ep') setEpFirstPerson(false)
          else if (mode === 'shift') setShiftFirstPerson(false)
          else if (mode === 'shift3') setV3FirstPerson(false)
          else setFirstPerson(false)
        }}
        onResetGrid={() => setGridReset((value) => value + 1)}
        onStart={() => {
          ensureMap()
          setRunning(true)
        }}
        onStop={() => setRunning(false)}
        onReset={() => {
          setRunning(false)
          resetMap()
        }}
      />
      )}
    </div>
  )
}

export default App
