import type { RefObject } from 'react'
import { NOISE_OPTIONS, getNoiseOption } from './terrainParams.ts'
import type { NoiseId, TerrainParams, TwoDTab, ViewMode } from './terrainParams.ts'
import type { ErosionParams } from './erosion.ts'
import GradientEditor from './GradientEditor.tsx'
import type { GradientStop } from './heightGradient.ts'
import HeightMapView from './HeightMapView.tsx'
import NoiseMap from './NoiseMap.tsx'
import { Slider } from './Slider.tsx'
import { VOXEL_RENDER_OPTIONS, defaultVoxelParams } from './voxelParams.ts'
import type { VoxelParams, VoxelRenderMode } from './voxelParams.ts'

type AppChromeProps = {
  mode: ViewMode
  twoDTab: TwoDTab
  params: TerrainParams
  voxelParams: VoxelParams
  heightGradient: GradientStop[]
  erosion: ErosionParams
  running: boolean
  mapRef: RefObject<Float32Array | null>
  mapRevision: number
  mapSize: number
  onMode: (mode: ViewMode) => void
  onTwoDTab: (tab: TwoDTab) => void
  onChange: (patch: Partial<TerrainParams>) => void
  onVoxelChange: (patch: Partial<VoxelParams>) => void
  onHeightGradientChange: (stops: GradientStop[]) => void
  onErosion: (patch: Partial<ErosionParams>) => void
  onStart: () => void
  onStop: () => void
  onReset: () => void
}

export default function AppChrome({
  mode,
  twoDTab,
  params,
  voxelParams,
  heightGradient,
  erosion,
  running,
  mapRef,
  mapRevision,
  mapSize,
  onMode,
  onTwoDTab,
  onChange,
  onVoxelChange,
  onHeightGradientChange,
  onErosion,
  onStart,
  onStop,
  onReset,
}: AppChromeProps) {
  const option = getNoiseOption(params.noiseId)
  const extra = params.extras[params.noiseId]
  const showSim = mode === '2d' && twoDTab === 'sim'
  const showVoxels = mode === 'voxels'
  const renderLabel =
    VOXEL_RENDER_OPTIONS.find((item) => item.id === voxelParams.renderMode)?.label ?? '—'

  return (
    <div className="chrome">
      <header className="chrome-title">
        <p className="chrome-kicker">DESIGN 6197</p>
        <h1>Procedural World Building</h1>
      </header>

      <aside className="chrome-panel" aria-label="Parameters">
        <div className="chrome-panel-header">
          <h2>{showVoxels ? 'Voxels' : 'Terrain'}</h2>
        </div>

        <div className="chrome-modes chrome-modes-3" role="tablist" aria-label="View">
          <button
            type="button"
            role="tab"
            aria-selected={mode === '3d'}
            className={mode === '3d' ? 'is-active' : undefined}
            onClick={() => onMode('3d')}
          >
            3D
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === '2d'}
            className={mode === '2d' ? 'is-active' : undefined}
            onClick={() => onMode('2d')}
          >
            2D
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'voxels'}
            className={mode === 'voxels' ? 'is-active' : undefined}
            onClick={() => onMode('voxels')}
          >
            Voxels
          </button>
        </div>

        {mode === '2d' ? (
          <div className="chrome-modes" role="tablist" aria-label="2D">
            <button
              type="button"
              role="tab"
              aria-selected={twoDTab === 'field'}
              className={twoDTab === 'field' ? 'is-active' : undefined}
              onClick={() => onTwoDTab('field')}
            >
              Field
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={twoDTab === 'sim'}
              className={twoDTab === 'sim' ? 'is-active' : undefined}
              onClick={() => onTwoDTab('sim')}
            >
              Sim
            </button>
          </div>
        ) : null}

        {showVoxels ? (
          <>
            <section className="chrome-group">
              <h3>Voxel grid</h3>
              <p className="chrome-hint">
                Step 1 builds an N³ density grid from density(x, y, z). Step 2 meshes that
                same grid with Marching Cubes or Interactive blocks. In Interactive: click a
                face to remove a voxel, shift-click to add one beside it.
              </p>
              <Slider
                label="Resolution"
                value={voxelParams.resolution}
                min={8}
                max={40}
                step={1}
                display={`${Math.round(voxelParams.resolution)}³`}
                onChange={(resolution) => onVoxelChange({ resolution })}
              />
              <Slider
                label="Isolevel"
                value={voxelParams.isolevel}
                min={-1}
                max={1}
                step={0.01}
                display={voxelParams.isolevel.toFixed(2)}
                onChange={(isolevel) => onVoxelChange({ isolevel })}
              />
              <Slider
                label="Volume"
                value={voxelParams.volume}
                min={0}
                max={1.5}
                step={0.01}
                display={voxelParams.volume.toFixed(2)}
                onChange={(volume) => onVoxelChange({ volume })}
              />
              <Slider
                label="Bleed"
                value={voxelParams.bleed}
                min={0}
                max={1}
                step={0.01}
                display={voxelParams.bleed.toFixed(2)}
                onChange={(bleed) => onVoxelChange({ bleed })}
              />
            </section>

            <section className="chrome-group">
              <h3>Meshing</h3>
              <label className="chrome-field">
                <span className="chrome-slider-row">
                  <span>Mode</span>
                  <span className="chrome-slider-value">{renderLabel}</span>
                </span>
                <select
                  value={voxelParams.renderMode}
                  onChange={(event) =>
                    onVoxelChange({ renderMode: event.target.value as VoxelRenderMode })
                  }
                >
                  {VOXEL_RENDER_OPTIONS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <Slider
                label="Overlap"
                value={voxelParams.overlap}
                min={0.7}
                max={1.2}
                step={0.01}
                display={voxelParams.overlap.toFixed(2)}
                onChange={(overlap) => onVoxelChange({ overlap })}
              />
              <button
                type="button"
                className="chrome-reset chrome-reset-full"
                onClick={() => onVoxelChange(defaultVoxelParams)}
              >
                Reset voxels
              </button>
            </section>

            <section className="chrome-group">
              <h3>Height gradient</h3>
              <p className="chrome-hint">
                Colors Interactive voxel faces by height. Add stops (0 = lowest, 1 = highest);
                the mesh updates live.
              </p>
              <GradientEditor stops={heightGradient} onChange={onHeightGradientChange} />
            </section>
          </>
        ) : null}

        {showSim ? (
          <>
            <section className="chrome-group">
              <h3>Hydraulic</h3>
              <div className="chrome-actions">
                <button type="button" className="chrome-reset" onClick={onStart} disabled={running}>
                  Start
                </button>
                <button type="button" className="chrome-reset" onClick={onStop} disabled={!running}>
                  Stop
                </button>
              </div>
              <button type="button" className="chrome-reset chrome-reset-full" onClick={onReset}>
                Reset
              </button>
              <p className="chrome-hint">Reset rebuilds the map from the current noise field.</p>
            </section>

            <section className="chrome-group">
              <h3>Droplet</h3>
              <Slider
                label="Droplets"
                value={erosion.droplets}
                min={1}
                max={200}
                step={1}
                display={String(Math.round(erosion.droplets))}
                onChange={(droplets) => onErosion({ droplets })}
              />
              <Slider
                label="Lifetime"
                value={erosion.lifetime}
                min={4}
                max={80}
                step={1}
                display={String(Math.round(erosion.lifetime))}
                onChange={(lifetime) => onErosion({ lifetime })}
              />
              <Slider
                label="Inertia"
                value={erosion.inertia}
                min={0}
                max={0.8}
                step={0.01}
                display={erosion.inertia.toFixed(2)}
                onChange={(inertia) => onErosion({ inertia })}
              />
              <Slider
                label="Gravity"
                value={erosion.gravity}
                min={0.2}
                max={12}
                step={0.1}
                display={erosion.gravity.toFixed(1)}
                onChange={(gravity) => onErosion({ gravity })}
              />
            </section>

            <section className="chrome-group">
              <h3>Sediment</h3>
              <Slider
                label="Capacity"
                value={erosion.capacity}
                min={0.2}
                max={12}
                step={0.1}
                display={erosion.capacity.toFixed(1)}
                onChange={(capacity) => onErosion({ capacity })}
              />
              <Slider
                label="Erosion"
                value={erosion.erosion}
                min={0}
                max={1}
                step={0.01}
                display={erosion.erosion.toFixed(2)}
                onChange={(value) => onErosion({ erosion: value })}
              />
              <Slider
                label="Deposition"
                value={erosion.deposition}
                min={0}
                max={1}
                step={0.01}
                display={erosion.deposition.toFixed(2)}
                onChange={(deposition) => onErosion({ deposition })}
              />
              <Slider
                label="Evaporation"
                value={erosion.evaporation}
                min={0.001}
                max={0.12}
                step={0.001}
                display={erosion.evaporation.toFixed(3)}
                onChange={(evaporation) => onErosion({ evaporation })}
              />
              <Slider
                label="Min slope"
                value={erosion.minSlope}
                min={0}
                max={0.08}
                step={0.001}
                display={erosion.minSlope.toFixed(3)}
                onChange={(minSlope) => onErosion({ minSlope })}
              />
              <Slider
                label="Radius"
                value={erosion.radius}
                min={1}
                max={8}
                step={1}
                display={String(Math.round(erosion.radius))}
                onChange={(radius) => onErosion({ radius })}
              />
            </section>

            <section className="chrome-group">
              <h3>Map</h3>
              <HeightMapView
                mapRef={mapRef}
                size={mapSize}
                running={running}
                erosion={erosion}
                revision={mapRevision}
                className="noise-preview"
              />
            </section>
          </>
        ) : (
          <>
            <section className="chrome-group">
              <h3>Noise</h3>
              <label className="chrome-field">
                <span className="chrome-slider-row">
                  <span>Type</span>
                  <span className="chrome-slider-value">{option.label}</span>
                </span>
                <select
                  value={params.noiseId}
                  onChange={(event) => onChange({ noiseId: event.target.value as NoiseId })}
                >
                  {NOISE_OPTIONS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <Slider
                label={option.extraLabel}
                value={extra}
                min={option.min}
                max={option.max}
                step={option.step}
                display={extra.toFixed(2)}
                onChange={(value) =>
                  onChange({
                    extras: { ...params.extras, [params.noiseId]: value },
                  })
                }
              />
            </section>

            <section className="chrome-group">
              <h3>Field</h3>
              <Slider
                label="Zoom"
                value={params.zoom}
                min={0.4}
                max={12}
                step={0.1}
                display={params.zoom.toFixed(1)}
                onChange={(zoom) => onChange({ zoom })}
              />
              <Slider
                label="Height"
                value={params.height}
                min={0}
                max={1.6}
                step={0.01}
                display={params.height.toFixed(2)}
                onChange={(height) => onChange({ height })}
              />
              <Slider
                label="Layers"
                value={params.layers}
                min={1}
                max={8}
                step={1}
                display={String(Math.round(params.layers))}
                onChange={(layers) => onChange({ layers })}
              />
              <Slider
                label="Grid detail"
                value={params.detail}
                min={8}
                max={96}
                step={1}
                display={String(Math.round(params.detail))}
                onChange={(detail) => onChange({ detail })}
              />
            </section>

            <section className="chrome-group">
              <h3>Raw 2D</h3>
              <NoiseMap params={params} resolution={96} className="noise-preview" />
            </section>
          </>
        )}
      </aside>
    </div>
  )
}
