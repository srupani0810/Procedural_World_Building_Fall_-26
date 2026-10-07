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
import { SHADER_STUDIES, getShaderStudy } from './shaderStudies.ts'
import type { ShaderStudyId } from './shaderStudies.ts'
import type { EpParams } from './epParams.ts'
import { createDefaultEpTerrain, createDefaultEpVoxel } from './epParams.ts'

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
  shaderStudy: ShaderStudyId
  onShaderStudy: (study: ShaderStudyId) => void
  shaderMeshMode: VoxelRenderMode
  onShaderMeshMode: (mode: VoxelRenderMode) => void
  epParams: EpParams
  onEpChange: (patch: Partial<EpParams>) => void
  epTerrain: TerrainParams
  onEpTerrainChange: (patch: Partial<TerrainParams>) => void
  epVoxel: VoxelParams
  onEpVoxelChange: (patch: Partial<VoxelParams>) => void
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
  shaderStudy,
  onShaderStudy,
  shaderMeshMode,
  onShaderMeshMode,
  epParams,
  onEpChange,
  epTerrain,
  onEpTerrainChange,
  epVoxel,
  onEpVoxelChange,
  firstPerson,
  onJumpIn,
  onExitFirstPerson,
  onStart,
  onStop,
  onReset,
}: AppChromeProps) {
  const option = getNoiseOption(params.noiseId)
  const extra = params.extras[params.noiseId]
  const epOption = getNoiseOption(epTerrain.noiseId)
  const epExtra = epTerrain.extras[epTerrain.noiseId]
  const showSim = mode === '2d' && twoDTab === 'sim'
  const showVoxels = mode === 'voxels'
  const showShaders = mode === 'shaders'
  const showEp = mode === 'ep'
  const study = getShaderStudy(shaderStudy)
  const renderLabel =
    VOXEL_RENDER_OPTIONS.find((item) => item.id === voxelParams.renderMode)?.label ?? '—'
  const shaderMeshLabel =
    VOXEL_RENDER_OPTIONS.find((item) => item.id === shaderMeshMode)?.label ?? '—'

  return (
    <div className="chrome">
      <header className="chrome-title">
        <p className="chrome-kicker">DESIGN 6197</p>
        <h1>Procedural World Building</h1>
      </header>

      <aside className="chrome-panel" aria-label="Parameters">
        <div className="chrome-panel-header">
          <h2>
            {showEp
              ? 'Playground'
              : showVoxels
                ? 'Voxels'
                : showShaders
                  ? 'Shaders'
                  : 'Terrain'}
          </h2>
        </div>

        <div className="chrome-modes chrome-modes-4" role="tablist" aria-label="View">
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
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'shaders'}
            className={mode === 'shaders' ? 'is-active' : undefined}
            onClick={() => onMode('shaders')}
          >
            Shaders
          </button>
        </div>

        <div className="chrome-modes chrome-modes-ep" role="tablist" aria-label="Experiential">
          <button
            type="button"
            role="tab"
            aria-selected={showEp}
            className={showEp ? 'is-active' : undefined}
            onClick={() => onMode('ep')}
          >
            Experiential Playground | EP
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

        {showEp ? (
          <>
            <ChromeSection
              title="Atmosphere"
              tip="Dark mist and filigree. Noise shapes the ground; you place every voxel."
              defaultOpen
            >
              <p className="chrome-hint">
                Orbit: light haze only at the field rim. Jump In: stronger endless horizon fog.
                Density thickens the walk fade. Click ground or a face to add; hold (~400ms) to
                remove.
              </p>
              <Slider
                label="Fog density"
                value={epParams.fogDensity}
                min={0.02}
                max={0.15}
                step={0.001}
                display={epParams.fogDensity.toFixed(3)}
                onChange={(fogDensity) => onEpChange({ fogDensity })}
              />
              <Slider
                label="Filigree"
                value={epParams.glitchIntensity}
                min={0}
                max={2}
                step={0.01}
                display={epParams.glitchIntensity.toFixed(2)}
                onChange={(glitchIntensity) => onEpChange({ glitchIntensity })}
              />
            </ChromeSection>

            <ChromeSection
              title="World"
              tip="EP-only: noise shapes the ground mesh; resolution/load radius are for your placed voxels."
              defaultOpen
            >
              <label className="chrome-field">
                <span className="chrome-slider-row">
                  <span>Noise</span>
                  <span className="chrome-slider-value">{epOption.label}</span>
                </span>
                <select
                  value={epTerrain.noiseId}
                  onChange={(event) =>
                    onEpTerrainChange({ noiseId: event.target.value as NoiseId })
                  }
                >
                  {NOISE_OPTIONS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <Slider
                label={epOption.extraLabel}
                value={epExtra}
                min={epOption.min}
                max={epOption.max}
                step={epOption.step}
                display={epExtra.toFixed(2)}
                onChange={(value) =>
                  onEpTerrainChange({
                    extras: { ...epTerrain.extras, [epTerrain.noiseId]: value },
                  })
                }
              />
              <Slider
                label="Frequency"
                value={epTerrain.frequency}
                min={0.02}
                max={1.5}
                step={0.01}
                display={epTerrain.frequency.toFixed(2)}
                onChange={(frequency) => onEpTerrainChange({ frequency })}
              />
              <Slider
                label="Amplitude"
                value={epTerrain.amplitude}
                min={0}
                max={4}
                step={0.01}
                display={epTerrain.amplitude.toFixed(2)}
                onChange={(amplitude) => onEpTerrainChange({ amplitude })}
              />
              <Slider
                label="Resolution"
                value={epVoxel.resolution}
                min={4}
                max={64}
                step={1}
                display={`${Math.round(epVoxel.resolution)}³ / chunk`}
                onChange={(resolution) => onEpVoxelChange({ resolution })}
              />
              <Slider
                label="Load radius"
                value={epVoxel.loadRadius}
                min={1}
                max={4}
                step={1}
                display={`${Math.round(epVoxel.loadRadius)} chunk`}
                onChange={(loadRadius) => onEpVoxelChange({ loadRadius })}
              />
              <p className="chrome-hint">
                Voxel edit radius around the camera. Ground streaming follows fog independently.
              </p>
              <Slider
                label="Isolevel"
                value={epVoxel.isolevel}
                min={-2}
                max={2}
                step={0.01}
                display={epVoxel.isolevel.toFixed(2)}
                onChange={(isolevel) => onEpVoxelChange({ isolevel })}
              />
              <button
                type="button"
                className="chrome-reset chrome-reset-full"
                onClick={() => {
                  onEpTerrainChange(createDefaultEpTerrain())
                  onEpVoxelChange(createDefaultEpVoxel())
                }}
              >
                Reset EP world
              </button>
            </ChromeSection>

            <ChromeSection
              title="Walk"
              tip="EP-only first-person Jump In — separate from the Voxels tab camera."
              defaultOpen
            >
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
                  WASD / arrows walk · click canvas to look · Esc or Exit to leave
                </p>
              ) : (
                <p className="chrome-hint">Orbit to explore, or Jump In for first-person.</p>
              )}
            </ChromeSection>
          </>
        ) : null}

        {showShaders ? (
          <>
            <ChromeSection
              title="Shader study"
              tip="Swap live ShaderMaterial studies on the same voxel-derived terrain mesh."
              defaultOpen
            >
              <p className="chrome-hint">
                Shader materials on a voxel-derived study mesh. Isolated from Voxels edit /
                chunk streaming.
              </p>
              <label className="chrome-field">
                <span className="chrome-slider-row">
                  <span>Study</span>
                  <span className="chrome-slider-value">{study.label}</span>
                </span>
                <select
                  value={shaderStudy}
                  onChange={(event) => onShaderStudy(event.target.value as ShaderStudyId)}
                >
                  {SHADER_STUDIES.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="chrome-hint chrome-hint-study">{study.description}</p>
            </ChromeSection>

            <ChromeSection
              title="Meshing"
              tip="Choose Marching Cubes or Interactive geometry for the shader study (Shaders tab only)."
            >
              <label className="chrome-field">
                <span className="chrome-slider-row">
                  <span>Mode</span>
                  <span className="chrome-slider-value">{shaderMeshLabel}</span>
                </span>
                <select
                  value={shaderMeshMode}
                  onChange={(event) =>
                    onShaderMeshMode(event.target.value as VoxelRenderMode)
                  }
                >
                  {VOXEL_RENDER_OPTIONS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="chrome-hint">
                Reuses the same meshing builders as Voxels. Does not change the Voxels tab
                mode.
              </p>
            </ChromeSection>

            <ChromeSection
              title="Study mesh"
              tip="Resolution, isolevel, volume, and bleed for the shader study chunk (reuses voxel builders)."
            >
              <Slider
                label="Resolution"
                value={voxelParams.resolution}
                min={4}
                max={64}
                step={1}
                display={`${Math.round(voxelParams.resolution)}³`}
                onChange={(resolution) => onVoxelChange({ resolution })}
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
              title="Height gradient"
              tip="Edit color stops that paint Interactive study-mesh faces by height (low → high). Shared with the Voxels tab."
            >
              <p className="chrome-hint">
                Colors Interactive study-mesh faces by height. Add stops (0 = lowest, 1 =
                highest); the mesh updates live. Same gradient as Voxels.
              </p>
              <GradientEditor stops={heightGradient} onChange={onHeightGradientChange} />
            </ChromeSection>
          </>
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
        ) : showEp ? null : (
          <>
            <ChromeSection
              title="Noise"
              tip="Noise type plus frequency, amplitude, octaves, and persistence — live on the shared terrain field."
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
              <Slider
                label="Frequency"
                value={params.frequency}
                min={0.02}
                max={1.5}
                step={0.01}
                display={params.frequency.toFixed(2)}
                onChange={(frequency) => onChange({ frequency })}
              />
              <Slider
                label="Amplitude"
                value={params.amplitude}
                min={0}
                max={4}
                step={0.01}
                display={params.amplitude.toFixed(2)}
                onChange={(amplitude) => onChange({ amplitude })}
              />
              <Slider
                label="Octaves"
                value={params.octaves}
                min={1}
                max={12}
                step={1}
                display={String(Math.round(params.octaves))}
                onChange={(octaves) => onChange({ octaves })}
              />
              <Slider
                label="Persistence"
                value={params.persistence}
                min={0.05}
                max={1}
                step={0.01}
                display={params.persistence.toFixed(2)}
                onChange={(persistence) => onChange({ persistence })}
              />
            </ChromeSection>

            <ChromeSection
              title="Field"
              tip="Mesh sampling density for the 3D heightfield view (voxels use Resolution instead)."
            >
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
