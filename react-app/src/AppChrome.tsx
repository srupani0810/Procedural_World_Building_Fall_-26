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
import {
  AUTO_GROW_FAST_SECONDS,
  AUTO_GROW_SLOW_SECONDS,
  createDefaultEpTerrain,
  createDefaultEpVoxel,
  formatAutoGrow,
} from './epParams.ts'
import { ShiftPanel } from './weathering/ShiftPanel.tsx'
import type { DecayParams, EpParams as ShiftEpParams } from './weathering/epParams.ts'
import { WeatheringV2Panel } from './weatheringV2/WeatheringV2Panel.tsx'
import type { V2Params } from './weatheringV2/params.ts'
import { WeatheringV3Panel } from './weatheringV3/WeatheringV3Panel.tsx'
import type {
  DecayParams as V3DecayParams,
  EpParams as V3EpParams,
} from './weatheringV3/epParams.ts'

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
  shiftParams: ShiftEpParams
  onShiftChange: (patch: Partial<ShiftEpParams>) => void
  shiftTerrain: TerrainParams
  onShiftTerrainChange: (patch: Partial<TerrainParams>) => void
  shiftVoxel: VoxelParams
  onShiftVoxelChange: (patch: Partial<VoxelParams>) => void
  onResetShiftGrid: () => void
  decayParams: DecayParams
  onDecayChange: (patch: Partial<DecayParams>) => void
  onResetDecay: () => void
  townDecay: number
  ageReadout: { lines: string[]; waterNote: boolean }
  v2Params: V2Params
  onV2Change: (patch: Partial<V2Params>) => void
  v2Terrain: TerrainParams
  onV2TerrainChange: (patch: Partial<TerrainParams>) => void
  v2Voxel: VoxelParams
  onV2VoxelChange: (patch: Partial<VoxelParams>) => void
  onResetV2Grid: () => void
  onV2Step: () => void
  v2Log: string[]
  v2Census: string
  v3Params: V3EpParams
  onV3Change: (patch: Partial<V3EpParams>) => void
  v3Terrain: TerrainParams
  onV3TerrainChange: (patch: Partial<TerrainParams>) => void
  v3Voxel: VoxelParams
  onV3VoxelChange: (patch: Partial<VoxelParams>) => void
  onResetV3Grid: () => void
  v3DecayParams: V3DecayParams
  onV3DecayChange: (patch: Partial<V3DecayParams>) => void
  onResetV3Decay: () => void
  v3TownDecay: number
  v3AgeReadout: { lines: string[]; waterNote: boolean }
  firstPerson: boolean
  onJumpIn: () => void
  onExitFirstPerson: () => void
  onResetGrid: () => void
  onStart: () => void
  onStop: () => void
  onReset: () => void
}

const TELEMETRY_STAGE = /\b(abandoned|reclaimed|settled|inhabited)\b/g

/** Stage words use the panel accent. Cell ids, ages, and “new” stay in the body color. */
function colorTelemetryStages(text: string) {
  const parts = text.split(TELEMETRY_STAGE)
  return parts.map((part, index) =>
    part === 'abandoned' || part === 'reclaimed' || part === 'settled' || part === 'inhabited' ? (
      <span key={index} className="chrome-telemetry-stage">
        {part}
      </span>
    ) : (
      part
    ),
  )
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
  shiftParams,
  onShiftChange,
  shiftTerrain,
  onShiftTerrainChange,
  shiftVoxel,
  onShiftVoxelChange,
  onResetShiftGrid,
  decayParams,
  onDecayChange,
  onResetDecay,
  townDecay,
  ageReadout,
  v2Params,
  onV2Change,
  v2Terrain,
  onV2TerrainChange,
  v2Voxel,
  onV2VoxelChange,
  onResetV2Grid,
  onV2Step,
  v2Log,
  v2Census,
  v3Params,
  onV3Change,
  v3Terrain,
  onV3TerrainChange,
  v3Voxel,
  onV3VoxelChange,
  onResetV3Grid,
  v3DecayParams,
  onV3DecayChange,
  onResetV3Decay,
  v3TownDecay,
  v3AgeReadout,
  firstPerson,
  onJumpIn,
  onExitFirstPerson,
  onResetGrid,
  onStart,
  onStop,
  onReset,
}: AppChromeProps) {
  const option = getNoiseOption(params.noiseId)
  const extra = params.extras[params.noiseId]
  const epOption = getNoiseOption(epTerrain.noiseId)
  const epExtra = epTerrain.extras[epTerrain.noiseId]
  const showShift2 = mode === 'shift2'
  const showShift3 = mode === 'shift3'
  const showSim = mode === '2d' && twoDTab === 'sim'
  const showVoxels = mode === 'voxels'
  const showShaders = mode === 'shaders'
  const showEp = mode === 'ep'
  const showShift = mode === 'shift'
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

      {showShift ? (
        <aside className="chrome-panel chrome-telemetry" aria-label="Town age">
          <ChromeSection title="Town age" tip="Show or hide the age and stage readout." defaultOpen>
            {ageReadout.waterNote ? <div className="chrome-telemetry-alert">water — no build</div> : null}
            <pre className="chrome-telemetry-readout">
              {ageReadout.lines.length === 0
                ? 'age — no claimed cells'
                : colorTelemetryStages(`age (s) · stage\n${ageReadout.lines.join('\n')}`)}
            </pre>
          </ChromeSection>
        </aside>
      ) : null}

      {showShift3 ? (
        <aside className="chrome-panel chrome-telemetry" aria-label="Town age">
          <ChromeSection title="Town age" tip="Show or hide the age and stage readout." defaultOpen>
            {v3AgeReadout.waterNote ? (
              <div className="chrome-telemetry-alert">water — no build</div>
            ) : null}
            <pre className="chrome-telemetry-readout">
              {v3AgeReadout.lines.length === 0
                ? 'age — no claimed cells'
                : colorTelemetryStages(`age (s) · stage\n${v3AgeReadout.lines.join('\n')}`)}
            </pre>
          </ChromeSection>
        </aside>
      ) : null}

      {showShift2 ? (
        <aside className="chrome-panel chrome-telemetry" aria-label="Process log">
          <ChromeSection
            title="Process log"
            tip="Claims, neighbor rules, and vacating stage changes as events."
            defaultOpen
          >
            <pre className="chrome-telemetry-readout">
              {v2Log.length === 0 ? 'log — waiting for generation' : v2Log.join('\n')}
            </pre>
          </ChromeSection>
        </aside>
      ) : null}

      <aside className="chrome-panel" aria-label="Parameters">
        <div className="chrome-panel-header">
          <h2>
            {showShift3
              ? 'Weathering v3'
              : showShift2
                ? 'Weathering v2'
                : showShift
                  ? 'Weathering'
                  : showEp
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
          <button
            type="button"
            role="tab"
            aria-selected={showShift}
            className={showShift ? 'is-active' : undefined}
            onClick={() => onMode('shift')}
          >
            Weathering
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={showShift2}
            className={showShift2 ? 'is-active' : undefined}
            onClick={() => onMode('shift2')}
          >
            Weathering v2
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={showShift3}
            className={showShift3 ? 'is-active' : undefined}
            onClick={() => onMode('shift3')}
          >
            Weathering v3
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
              title="Grid"
              tip="Wavy quad cells for click-to-build. Separate from voxel resolution."
              defaultOpen
            >
              <p className="chrome-hint">
                Invisible until toggled. Cell ids stay put when size or warp changes. Autonomous
                growth claims neighboring lots on a timer. Reset Grid clears claimed lots only.
              </p>
              <Slider
                label="Cell size"
                value={epParams.cellSize}
                min={1}
                max={6}
                step={0.05}
                display={epParams.cellSize.toFixed(2)}
                onChange={(cellSize) => onEpChange({ cellSize })}
              />
              <Slider
                label="Grid warp"
                value={epParams.gridWarp}
                min={0}
                max={1.5}
                step={0.01}
                display={epParams.gridWarp.toFixed(2)}
                onChange={(gridWarp) => onEpChange({ gridWarp })}
              />
              <label className="chrome-check">
                <span>Autonomous growth</span>
                <input
                  type="checkbox"
                  checked={epParams.autoGrow}
                  onChange={(event) => onEpChange({ autoGrow: event.target.checked })}
                />
              </label>
              <Slider
                label="Build rate"
                value={AUTO_GROW_SLOW_SECONDS + AUTO_GROW_FAST_SECONDS - epParams.autoGrowSeconds}
                min={AUTO_GROW_FAST_SECONDS}
                max={AUTO_GROW_SLOW_SECONDS}
                step={1}
                display={formatAutoGrow(epParams.autoGrowSeconds)}
                onChange={(rate) =>
                  onEpChange({
                    autoGrowSeconds: AUTO_GROW_SLOW_SECONDS + AUTO_GROW_FAST_SECONDS - rate,
                  })
                }
              />
              <label className="chrome-check">
                <span>Grid visibility</span>
                <input
                  type="checkbox"
                  checked={epParams.gridVisible}
                  onChange={(event) => onEpChange({ gridVisible: event.target.checked })}
                />
              </label>
              <button type="button" className="chrome-reset chrome-reset-full" onClick={onResetGrid}>
                Reset Grid
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

        {showShift ? (
          <ShiftPanel
            params={shiftParams}
            terrain={shiftTerrain}
            voxel={shiftVoxel}
            firstPerson={firstPerson}
            onChange={onShiftChange}
            onTerrainChange={onShiftTerrainChange}
            onVoxelChange={onShiftVoxelChange}
            onJumpIn={onJumpIn}
            onExitFirstPerson={onExitFirstPerson}
            onResetGrid={onResetShiftGrid}
            decay={decayParams}
            onDecayChange={onDecayChange}
            onResetDecay={onResetDecay}
            townDecay={townDecay}
          />
        ) : null}

        {showShift2 ? (
          <WeatheringV2Panel
            params={v2Params}
            onChange={onV2Change}
            terrain={v2Terrain}
            onTerrainChange={onV2TerrainChange}
            voxel={v2Voxel}
            onVoxelChange={onV2VoxelChange}
            onResetGrid={onResetV2Grid}
            onStep={onV2Step}
            census={v2Census}
          />
        ) : null}

        {showShift3 ? (
          <WeatheringV3Panel
            params={v3Params}
            terrain={v3Terrain}
            voxel={v3Voxel}
            firstPerson={firstPerson}
            onChange={onV3Change}
            onTerrainChange={onV3TerrainChange}
            onVoxelChange={onV3VoxelChange}
            onJumpIn={onJumpIn}
            onExitFirstPerson={onExitFirstPerson}
            onResetGrid={onResetV3Grid}
            decay={v3DecayParams}
            onDecayChange={onV3DecayChange}
            onResetDecay={onResetV3Decay}
            townDecay={v3TownDecay}
          />
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
        ) : showEp || showShift || showShift2 || showShift3 ? null : (
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
