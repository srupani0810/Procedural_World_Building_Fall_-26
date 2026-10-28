import { ChromeSection } from '../ChromeSection.tsx'
import { Slider } from '../Slider.tsx'
import { NOISE_OPTIONS, getNoiseOption } from '../terrainParams.ts'
import type { NoiseId, TerrainParams } from '../terrainParams.ts'
import type { VoxelParams } from '../voxelParams.ts'
import type { BackgroundStageBias, DecayParams, EpParams } from './epParams.ts'
import {
  AUTO_GROW_FAST_SECONDS,
  AUTO_GROW_SLOW_SECONDS,
  createDefaultEpTerrain,
  createDefaultEpVoxel,
  formatAutoGrow,
} from './epParams.ts'

type WeatheringV3PanelProps = {
  params: EpParams
  terrain: TerrainParams
  voxel: VoxelParams
  firstPerson: boolean
  onChange: (patch: Partial<EpParams>) => void
  onTerrainChange: (patch: Partial<TerrainParams>) => void
  onVoxelChange: (patch: Partial<VoxelParams>) => void
  onJumpIn: () => void
  onExitFirstPerson: () => void
  onResetGrid: () => void
  decay: DecayParams
  onDecayChange: (patch: Partial<DecayParams>) => void
  onResetDecay: () => void
  /** 0–1 height-weighted wear across claimed lots. */
  townDecay: number
}

/** Side controls for Weathering v3. Independent copy of Weathering's ShiftPanel. */
export function WeatheringV3Panel({
  params,
  terrain,
  voxel,
  firstPerson,
  onChange,
  onTerrainChange,
  onVoxelChange,
  onJumpIn,
  onExitFirstPerson,
  onResetGrid,
  decay,
  onDecayChange,
  onResetDecay,
  townDecay,
}: WeatheringV3PanelProps) {
  const option = getNoiseOption(terrain.noiseId)
  const extra = terrain.extras[terrain.noiseId]

  return (
    <>
      <ChromeSection
        title="Atmosphere"
        tip="Dark mist and filigree. Noise shapes the ground; you place every voxel."
        defaultOpen
      >
        <p className="chrome-hint">
          Orbit: light haze only at the field rim. Jump In: stronger endless horizon fog.
          Density thickens the walk fade. It stays the baseline; town decay adds haze on
          top. Click ground or a face to add; hold (~400ms) to remove.
        </p>
        <Slider
          label="Fog density"
          value={params.fogDensity}
          min={0.02}
          max={0.15}
          step={0.001}
          display={params.fogDensity.toFixed(3)}
          onChange={(fogDensity) => onChange({ fogDensity })}
        />
        <Slider
          label="Filigree"
          value={params.glitchIntensity}
          min={0}
          max={2}
          step={0.01}
          display={params.glitchIntensity.toFixed(2)}
          onChange={(glitchIntensity) => onChange({ glitchIntensity })}
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
            <span className="chrome-slider-value">{option.label}</span>
          </span>
          <select
            value={terrain.noiseId}
            onChange={(event) =>
              onTerrainChange({ noiseId: event.target.value as NoiseId })
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
          label={option.extraLabel}
          value={extra}
          min={option.min}
          max={option.max}
          step={option.step}
          display={extra.toFixed(2)}
          onChange={(value) =>
            onTerrainChange({
              extras: { ...terrain.extras, [terrain.noiseId]: value },
            })
          }
        />
        <Slider
          label="Frequency"
          value={terrain.frequency}
          min={0.02}
          max={1.5}
          step={0.01}
          display={terrain.frequency.toFixed(2)}
          onChange={(frequency) => onTerrainChange({ frequency })}
        />
        <Slider
          label="Amplitude"
          value={terrain.amplitude}
          min={0}
          max={4}
          step={0.01}
          display={terrain.amplitude.toFixed(2)}
          onChange={(amplitude) => onTerrainChange({ amplitude })}
        />
        <Slider
          label="Resolution"
          value={voxel.resolution}
          min={4}
          max={64}
          step={1}
          display={`${Math.round(voxel.resolution)}³ / chunk`}
          onChange={(resolution) => onVoxelChange({ resolution })}
        />
        <Slider
          label="Load radius"
          value={voxel.loadRadius}
          min={1}
          max={4}
          step={1}
          display={`${Math.round(voxel.loadRadius)} chunk`}
          onChange={(loadRadius) => onVoxelChange({ loadRadius })}
        />
        <p className="chrome-hint">
          Voxel edit radius around the camera. Ground streaming follows fog independently.
        </p>
        <Slider
          label="Isolevel"
          value={voxel.isolevel}
          min={-2}
          max={2}
          step={0.01}
          display={voxel.isolevel.toFixed(2)}
          onChange={(isolevel) => onVoxelChange({ isolevel })}
        />
        <button
          type="button"
          className="chrome-reset chrome-reset-full"
          onClick={() => {
            onTerrainChange(createDefaultEpTerrain())
            onVoxelChange(createDefaultEpVoxel())
          }}
        >
          Reset world
        </button>
      </ChromeSection>

      <ChromeSection
        title="Grid"
        tip="Wavy quad cells for click-to-build. Separate from voxel resolution."
        defaultOpen
      >
        <p className="chrome-hint">
          Invisible until toggled. Cell ids stay put when size or warp changes. Building
          scale changes the house height, not the lot spacing or the footprint. Click a lot
          to stack another story, up to Max height. Autonomous growth claims a neighboring
          lot and picks a height from 1 through Max height. Reset Grid clears claimed lots only.
        </p>
        <Slider
          label="Cell size"
          value={params.cellSize}
          min={1}
          max={6}
          step={0.05}
          display={params.cellSize.toFixed(2)}
          onChange={(cellSize) => onChange({ cellSize })}
        />
        <Slider
          label="Building scale"
          value={params.buildingScale ?? 3}
          min={1}
          max={8}
          step={0.05}
          display={`×${(params.buildingScale ?? 3).toFixed(2)}`}
          onChange={(buildingScale) => onChange({ buildingScale })}
        />
        <Slider
          label="Max height"
          value={params.maxStories ?? 8}
          min={1}
          max={16}
          step={1}
          display={`${Math.round(params.maxStories ?? 8)} stories`}
          onChange={(maxStories) => onChange({ maxStories: Math.round(maxStories) })}
        />
        <Slider
          label="Grid warp"
          value={params.gridWarp}
          min={0}
          max={1.5}
          step={0.01}
          display={params.gridWarp.toFixed(2)}
          onChange={(gridWarp) => onChange({ gridWarp })}
        />
        <label className="chrome-check">
          <span>Autonomous growth</span>
          <input
            type="checkbox"
            checked={params.autoGrow}
            onChange={(event) => onChange({ autoGrow: event.target.checked })}
          />
        </label>
        <Slider
          label="Build rate"
          value={AUTO_GROW_SLOW_SECONDS + AUTO_GROW_FAST_SECONDS - params.autoGrowSeconds}
          min={AUTO_GROW_FAST_SECONDS}
          max={AUTO_GROW_SLOW_SECONDS}
          step={1}
          display={formatAutoGrow(params.autoGrowSeconds)}
          onChange={(rate) =>
            onChange({
              autoGrowSeconds: AUTO_GROW_SLOW_SECONDS + AUTO_GROW_FAST_SECONDS - rate,
            })
          }
        />
        <label className="chrome-check">
          <span>Grid visibility</span>
          <input
            type="checkbox"
            checked={params.gridVisible}
            onChange={(event) => onChange({ gridVisible: event.target.checked })}
          />
        </label>
        <button type="button" className="chrome-reset chrome-reset-full" onClick={onResetGrid}>
          Reset Grid
        </button>
      </ChromeSection>

      <ChromeSection
        title="Background Buildings"
        tip="Neighborhoods of voxel columns around the camera. Separate from lots you click."
        defaultOpen
      >
        <p className="chrome-hint">
          Scenery only. Density, distance, height, and stage bias rebuild neighborhoods
          inside the ring around the camera. A block shares a street, a story count, and
          a decay stage, with open ground between blocks. Building scale starts at the
          same ×3 as the Grid slider and changes only these houses. They stay out of the
          age readout. Regenerate rerolls placement and leaves clicked buildings and the
          terrain where they are.
        </p>
        <Slider
          label="Density"
          value={params.backgroundDensity ?? 22}
          min={0}
          max={64}
          step={1}
          display={`${Math.round(params.backgroundDensity ?? 22)}`}
          onChange={(backgroundDensity) => onChange({ backgroundDensity })}
        />
        <Slider
          label="Building scale"
          value={params.backgroundBuildingScale ?? params.buildingScale ?? 3}
          min={1}
          max={8}
          step={0.05}
          display={`×${(params.backgroundBuildingScale ?? params.buildingScale ?? 3).toFixed(2)}`}
          onChange={(backgroundBuildingScale) => onChange({ backgroundBuildingScale })}
        />
        <Slider
          label="Near distance"
          value={params.backgroundMinDistance ?? 36}
          min={12}
          max={180}
          step={1}
          display={`${Math.round(params.backgroundMinDistance ?? 36)}`}
          onChange={(backgroundMinDistance) => {
            const far = params.backgroundMaxDistance ?? 110
            onChange({
              backgroundMinDistance,
              backgroundMaxDistance: Math.max(far, backgroundMinDistance + 8),
            })
          }}
        />
        <Slider
          label="Far distance"
          value={params.backgroundMaxDistance ?? 110}
          min={24}
          max={260}
          step={1}
          display={`${Math.round(params.backgroundMaxDistance ?? 110)}`}
          onChange={(backgroundMaxDistance) => {
            const near = params.backgroundMinDistance ?? 36
            onChange({
              backgroundMaxDistance,
              backgroundMinDistance: Math.min(near, backgroundMaxDistance - 8),
            })
          }}
        />
        <Slider
          label="Min stories"
          value={params.backgroundMinStories ?? 2}
          min={1}
          max={12}
          step={1}
          display={`${Math.round(params.backgroundMinStories ?? 2)}`}
          onChange={(backgroundMinStories) => {
            const maxStories = params.backgroundMaxStories ?? 7
            onChange({
              backgroundMinStories,
              backgroundMaxStories: Math.max(maxStories, backgroundMinStories),
            })
          }}
        />
        <Slider
          label="Max stories"
          value={params.backgroundMaxStories ?? 7}
          min={1}
          max={16}
          step={1}
          display={`${Math.round(params.backgroundMaxStories ?? 7)}`}
          onChange={(backgroundMaxStories) => {
            const minStories = params.backgroundMinStories ?? 2
            onChange({
              backgroundMaxStories,
              backgroundMinStories: Math.min(minStories, backgroundMaxStories),
            })
          }}
        />
        <label className="chrome-field">
          <span className="chrome-slider-row">
            <span>Decay stage bias</span>
            <span className="chrome-slider-value">
              {(params.backgroundStageBias ?? 'random').replace(/^./, (letter) => letter.toUpperCase())}
            </span>
          </span>
          <select
            value={params.backgroundStageBias ?? 'random'}
            onChange={(event) =>
              onChange({ backgroundStageBias: event.target.value as BackgroundStageBias })
            }
          >
            {(
              [
                ['random', 'Random'],
                ['new', 'New'],
                ['settled', 'Settled'],
                ['abandoned', 'Abandoned'],
                ['reclaimed', 'Reclaimed'],
              ] as const
            ).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="chrome-reset chrome-reset-full"
          onClick={() => onChange({ backgroundSeed: (params.backgroundSeed ?? 1) + 1 })}
        >
          Regenerate
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
            <button type="button" className="chrome-reset chrome-reset-full" onClick={onJumpIn}>
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

      <ChromeSection
        title="Decay"
        tip="How fast claimed cells age, when each stage begins, and how strong the wear and lights are."
        defaultOpen
      >
        <p className="chrome-slider-row">
          <span>Town decay</span>
          <span className="chrome-slider-value">{Math.round(townDecay * 100)}%</span>
        </p>
        <p className="chrome-hint">
          Height-weighted average wear of claimed lots. New stays near 0%. Abandoned and
          reclaimed pull it up. This share thickens fog on top of the Fog density slider.
          Speed and thresholds change the clock. Wear intensity only changes rust, stains, and
          cracks. Reset Decay returns every lot to New and leaves the buildings in place.
        </p>
        <Slider
          label="Decay speed"
          value={decay.decaySpeed}
          min={0.1}
          max={6}
          step={0.05}
          display={`×${decay.decaySpeed.toFixed(2)}`}
          onChange={(decaySpeed) => onDecayChange({ decaySpeed })}
        />
        <Slider
          label="New → Settled"
          value={decay.settledAt}
          min={1}
          max={Math.max(2, decay.abandonedAt - 1)}
          step={0.5}
          display={`${decay.settledAt.toFixed(1)}s`}
          onChange={(settledAt) => onDecayChange({ settledAt })}
        />
        <Slider
          label="Settled → Abandoned"
          value={decay.abandonedAt}
          min={decay.settledAt + 1}
          max={Math.max(decay.settledAt + 2, decay.reclaimedAt - 1)}
          step={0.5}
          display={`${decay.abandonedAt.toFixed(1)}s`}
          onChange={(abandonedAt) => onDecayChange({ abandonedAt })}
        />
        <Slider
          label="Abandoned → Reclaimed"
          value={decay.reclaimedAt}
          min={decay.abandonedAt + 1}
          max={240}
          step={0.5}
          display={`${decay.reclaimedAt.toFixed(1)}s`}
          onChange={(reclaimedAt) => onDecayChange({ reclaimedAt })}
        />
        <Slider
          label="Rust/wear intensity"
          value={decay.wearIntensity}
          min={0}
          max={2.5}
          step={0.05}
          display={`×${decay.wearIntensity.toFixed(2)}`}
          onChange={(wearIntensity) => onDecayChange({ wearIntensity })}
        />
        <Slider
          label="Flicker probability"
          value={decay.flickerProbability}
          min={0}
          max={1}
          step={0.01}
          display={`${Math.round(decay.flickerProbability * 100)}%`}
          onChange={(flickerProbability) => onDecayChange({ flickerProbability })}
        />
        <Slider
          label="Fire-barrel chance"
          value={decay.fireBarrelChance}
          min={0}
          max={1}
          step={0.01}
          display={`${Math.round(decay.fireBarrelChance * 100)}%`}
          onChange={(fireBarrelChance) => onDecayChange({ fireBarrelChance })}
        />
        <button type="button" className="chrome-reset chrome-reset-full" onClick={onResetDecay}>
          Reset Decay
        </button>
      </ChromeSection>
    </>
  )
}
