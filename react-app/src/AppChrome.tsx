import type { RefObject } from 'react'
import { NOISE_OPTIONS, getNoiseOption } from './terrainParams.ts'
import type { NoiseId, TerrainParams, TwoDTab, ViewMode } from './terrainParams.ts'
import type { ErosionParams } from './erosion.ts'
import { ChromeSection } from './ChromeSection.tsx'
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
  firstPerson: boolean
  onJumpIn: () => void
  onExitFirstPerson: () => void
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
  firstPerson,
  onJumpIn,
  onExitFirstPerson,
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
            <ChromeSection
              title="Voxel world"
              tip="Chunk resolution, load distance, isolevel, volume, and bleed for the infinite voxel field."
              defaultOpen
            >
              <p className="chrome-hint">
                Infinite heightfield (same noise as 3D) streamed as chunks around the camera.
                Pan / orbit to load new chunks. Interactive: click to remove, shift-click to add.
              </p>
              <div className="chrome-actions">
                {firstPerson ? (
                  <button
                    type="button"
                    className="chrome-reset chrome-reset-full"
                    onClick={onExitFirstPerson}
                  >
                    Exit
                  </button>
                ) : (
                  <button
                    type="button"
                    className="chrome-reset chrome-reset-full"
                    onClick={onJumpIn}
                  >
                    Jump In
                  </button>
                )}
              </div>
              {firstPerson ? (
                <p className="chrome-hint">
                  WASD / arrows walk · click canvas to look (pointer lock) · Esc or Exit to leave
                </p>
              ) : null}
              <Slider
                label="Resolution"
                value={voxelParams.resolution}
                min={4}
                max={64}
                step={1}
                display={`${Math.round(voxelParams.resolution)}³ / chunk`}
                onChange={(resolution) => onVoxelChange({ resolution })}
              />
              <Slider
                label="Load radius"
                value={voxelParams.loadRadius}
                min={0}
                max={4}
                step={1}
                display={`${Math.round(voxelParams.loadRadius)} chunk`}
                onChange={(loadRadius) => onVoxelChange({ loadRadius })}
              />
              <Slider
                label="Isolevel"
                value={voxelParams.isolevel}
                min={-2}
                max={2}
                step={0.01}
                display={voxelParams.isolevel.toFixed(2)}
                onChange={(isolevel) => onVoxelChange({ isolevel })}
              />
              <Slider
                label="Volume"
                value={voxelParams.volume}
                min={0}
                max={2}
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
            </ChromeSection>

            <ChromeSection
              title="Meshing"
              tip="Choose Interactive or Marching Cubes, adjust cube overlap, and reset voxel settings."
            >
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
                min={0.5}
                max={2}
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
            </ChromeSection>

            <ChromeSection
              title="Height gradient"
              tip="Edit color stops that paint Interactive voxel faces by height (low → high)."
            >
              <p className="chrome-hint">
                Colors Interactive voxel faces by height. Add stops (0 = lowest, 1 = highest);
                the mesh updates live.
              </p>
              <GradientEditor stops={heightGradient} onChange={onHeightGradientChange} />
            </ChromeSection>
          </>
        ) : null}

        {showSim ? (
          <>
            <ChromeSection
              title="Hydraulic"
              tip="Start, stop, or reset the 2D hydraulic erosion simulation."
              defaultOpen
            >
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
            </ChromeSection>

            <ChromeSection
              title="Droplet"
              tip="How many water droplets run, and their lifetime, inertia, and gravity."
            >
              <Slider
                label="Droplets"
                value={erosion.droplets}
                min={1}
                max={500}
                step={1}
                display={String(Math.round(erosion.droplets))}
                onChange={(droplets) => onErosion({ droplets })}
              />
              <Slider
                label="Lifetime"
                value={erosion.lifetime}
                min={4}
                max={200}
                step={1}
                display={String(Math.round(erosion.lifetime))}
                onChange={(lifetime) => onErosion({ lifetime })}
              />
              <Slider
                label="Inertia"
                value={erosion.inertia}
                min={0}
                max={0.95}
                step={0.01}
                display={erosion.inertia.toFixed(2)}
                onChange={(inertia) => onErosion({ inertia })}
              />
              <Slider
                label="Gravity"
                value={erosion.gravity}
                min={0.1}
                max={24}
                step={0.1}
                display={erosion.gravity.toFixed(1)}
                onChange={(gravity) => onErosion({ gravity })}
              />
            </ChromeSection>

            <ChromeSection
              title="Sediment"
              tip="Erosion physics: capacity, erosion/deposition rates, evaporation, slope, and brush radius."
            >
              <Slider
                label="Capacity"
                value={erosion.capacity}
                min={0.1}
                max={24}
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
                max={0.3}
                step={0.001}
                display={erosion.evaporation.toFixed(3)}
                onChange={(evaporation) => onErosion({ evaporation })}
              />
              <Slider
                label="Min slope"
                value={erosion.minSlope}
                min={0}
                max={0.2}
                step={0.001}
                display={erosion.minSlope.toFixed(3)}
                onChange={(minSlope) => onErosion({ minSlope })}
              />
              <Slider
                label="Radius"
                value={erosion.radius}
                min={1}
                max={16}
                step={1}
                display={String(Math.round(erosion.radius))}
                onChange={(radius) => onErosion({ radius })}
              />
            </ChromeSection>

            <ChromeSection title="Map" tip="Live preview of the heightmap the erosion sim is carving.">
              <HeightMapView
                mapRef={mapRef}
                size={mapSize}
                running={running}
                erosion={erosion}
                revision={mapRevision}
                className="noise-preview"
              />
            </ChromeSection>
          </>
        ) : (
          <>
            <ChromeSection
              title="Noise"
              tip="Pick the noise algorithm and its extra parameter (lacunarity, gain, jitter, etc.)."
              defaultOpen
            >
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
            </ChromeSection>

            <ChromeSection
              title="Field"
              tip="Shape the shared terrain field: zoom, height, layers, and grid detail."
            >
              <Slider
                label="Zoom"
                value={params.zoom}
                min={0.1}
                max={24}
                step={0.1}
                display={params.zoom.toFixed(1)}
                onChange={(zoom) => onChange({ zoom })}
              />
              <Slider
                label="Height"
                value={params.height}
                min={0}
                max={4}
                step={0.01}
                display={params.height.toFixed(2)}
                onChange={(height) => onChange({ height })}
              />
              <Slider
                label="Layers"
                value={params.layers}
                min={1}
                max={12}
                step={1}
                display={String(Math.round(params.layers))}
                onChange={(layers) => onChange({ layers })}
              />
              <Slider
                label="Grid detail"
                value={params.detail}
                min={4}
                max={192}
                step={1}
                display={String(Math.round(params.detail))}
                onChange={(detail) => onChange({ detail })}
              />
            </ChromeSection>

            <ChromeSection
              title="Raw 2D"
              tip="Small preview of the raw 2D noise pattern used by the field."
            >
              <NoiseMap params={params} resolution={96} className="noise-preview" />
            </ChromeSection>
          </>
        )}
      </aside>
    </div>
  )
}
