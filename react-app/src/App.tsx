import { useCallback, useRef, useState } from 'react'
import AppChrome from './AppChrome.tsx'
import HeightMapView from './HeightMapView.tsx'
import NoiseMap from './NoiseMap.tsx'
import Scene from './Scene.tsx'
import VoxelScene from './VoxelScene.tsx'
import { HEIGHTMAP_SIZE, createHeightmap, defaultErosionParams } from './erosion.ts'
import type { ErosionParams } from './erosion.ts'
import { defaultTerrainParams } from './terrainParams.ts'
import type { TerrainParams, TwoDTab, ViewMode } from './terrainParams.ts'
import { defaultVoxelParams } from './voxelParams.ts'
import type { VoxelParams } from './voxelParams.ts'
import './App.css'

function App() {
  const [mode, setMode] = useState<ViewMode>('3d')
  const [twoDTab, setTwoDTab] = useState<TwoDTab>('field')
  const [params, setParams] = useState<TerrainParams>(defaultTerrainParams)
  const [voxelParams, setVoxelParams] = useState<VoxelParams>(defaultVoxelParams)
  const [erosion, setErosion] = useState<ErosionParams>(defaultErosionParams)
  const [running, setRunning] = useState(false)
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
          <VoxelScene terrain={params} voxel={voxelParams} />
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
      <AppChrome
        mode={mode}
        twoDTab={twoDTab}
        params={params}
        voxelParams={voxelParams}
        erosion={erosion}
        running={running}
        mapRef={mapRef}
        mapRevision={mapRevision}
        mapSize={HEIGHTMAP_SIZE}
        onMode={handleMode}
        onTwoDTab={handleTwoDTab}
        onChange={(patch) => setParams((current) => ({ ...current, ...patch }))}
        onVoxelChange={(patch) => setVoxelParams((current) => ({ ...current, ...patch }))}
        onErosion={(patch) => setErosion((current) => ({ ...current, ...patch }))}
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
    </div>
  )
}

export default App
