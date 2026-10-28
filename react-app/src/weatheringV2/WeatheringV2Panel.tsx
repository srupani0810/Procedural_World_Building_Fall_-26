import { ChromeSection } from '../ChromeSection.tsx'
import { Slider } from '../Slider.tsx'
import { NOISE_OPTIONS, getNoiseOption } from '../terrainParams.ts'
import type { NoiseId, TerrainParams } from '../terrainParams.ts'
import type { VoxelParams } from '../voxelParams.ts'
import type { V2Params } from './params.ts'
import { IMPACT_LABEL, STAGE_COLOR, STAGE_LABEL } from './stages.ts'
import { createDefaultV2Terrain, createDefaultV2Voxel } from './worldDefaults.ts'

type Props = {
  params: V2Params
  onChange: (patch: Partial<V2Params>) => void
  terrain: TerrainParams
  onTerrainChange: (patch: Partial<TerrainParams>) => void
  voxel: VoxelParams
  onVoxelChange: (patch: Partial<VoxelParams>) => void
  onResetGrid: () => void
  onStep: () => void
  census: string
}

/** Controls for Weathering v2 — clarity over scope. */
export function WeatheringV2Panel({
  params,
  onChange,
  terrain,
  onTerrainChange,
  voxel,
  onVoxelChange,
  onResetGrid,
  onStep,
  census,
}: Props) {
  const option = getNoiseOption(terrain.noiseId)
  const extra = terrain.extras[terrain.noiseId]

  return (
    <>
      <p className="chrome-hint">
        Future vacating under automation: shells remain while upkeep withdraws. Watch the process
        log and in-world labels — generation rules and stage changes are events, not mood. See
        decay.md.
      </p>

      <ChromeSection
        title="World"
        tip="Noise shapes the rolling ground mesh (copied from Weathering). No water, no fog."
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
          Same World control set as Weathering. Noise / amplitude shape the ground heightfield.
          Resolution, load radius, and isolevel are kept for parity with that panel.
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
            onTerrainChange(createDefaultV2Terrain())
            onVoxelChange(createDefaultV2Voxel())
          }}
        >
          Reset world
        </button>
      </ChromeSection>

      <ChromeSection title="Legend" tip="Stage colors match in-world labels." defaultOpen>
        <ul className="chrome-hint" style={{ paddingLeft: 14, margin: '0 0 8px' }}>
          {(Object.keys(STAGE_LABEL) as Array<keyof typeof STAGE_LABEL>).map((key) => (
            <li key={key} style={{ marginBottom: 4 }}>
              <span style={{ color: STAGE_COLOR[key], fontWeight: 600 }}>{key}</span>
              {' — '}
              {STAGE_LABEL[key]}
            </li>
          ))}
        </ul>
        <p className="chrome-hint" style={{ marginBottom: 0 }}>
          Impact sequence on one shell: intact → paint → rust → partial (shell still stands).
        </p>
        <ul className="chrome-hint" style={{ paddingLeft: 14, margin: '6px 0 0' }}>
          {(Object.keys(IMPACT_LABEL) as Array<keyof typeof IMPACT_LABEL>).map((key) => (
            <li key={key}>
              {key}: {IMPACT_LABEL[key]}
            </li>
          ))}
        </ul>
      </ChromeSection>

      <ChromeSection title="Vacating clock" tip="Absence of upkeep advances stages. No disaster event." defaultOpen>
        <Slider
          label="Decay speed"
          value={params.decaySpeed}
          min={0.2}
          max={4}
          step={0.05}
          display={`×${params.decaySpeed.toFixed(2)}`}
          onChange={(decaySpeed) => onChange({ decaySpeed })}
        />
        <Slider
          label="Held → thinning"
          value={params.thinningAt}
          min={2}
          max={30}
          step={0.5}
          display={`${params.thinningAt.toFixed(1)}s`}
          onChange={(thinningAt) =>
            onChange({
              thinningAt,
              vacatedAt: Math.max(params.vacatedAt, thinningAt + 2),
              impactedAt: Math.max(params.impactedAt, Math.max(params.vacatedAt, thinningAt + 2) + 4),
            })
          }
        />
        <Slider
          label="Thinning → vacated"
          value={params.vacatedAt}
          min={4}
          max={60}
          step={0.5}
          display={`${params.vacatedAt.toFixed(1)}s`}
          onChange={(vacatedAt) =>
            onChange({
              vacatedAt: Math.max(vacatedAt, params.thinningAt + 2),
              impactedAt: Math.max(params.impactedAt, Math.max(vacatedAt, params.thinningAt + 2) + 4),
            })
          }
        />
        <Slider
          label="Vacated → impacted"
          value={params.impactedAt}
          min={8}
          max={90}
          step={0.5}
          display={`${params.impactedAt.toFixed(1)}s`}
          onChange={(impactedAt) =>
            onChange({ impactedAt: Math.max(impactedAt, params.vacatedAt + 4) })
          }
        />
      </ChromeSection>

      <ChromeSection title="Generation" tip="Neighbor rules claim and stack shells. Concurrent with vacating." defaultOpen>
        <p className="chrome-hint">{census || 'no shells yet'}</p>
        <Slider
          label="Cell size"
          value={params.cellSize}
          min={1.4}
          max={3.5}
          step={0.05}
          display={params.cellSize.toFixed(2)}
          onChange={(cellSize) => onChange({ cellSize })}
        />
        <Slider
          label="Max stories"
          value={params.maxStories}
          min={1}
          max={8}
          step={1}
          display={`${params.maxStories}`}
          onChange={(maxStories) => onChange({ maxStories })}
        />
        <label className="chrome-check">
          <input
            type="checkbox"
            checked={params.autoGrow}
            onChange={(event) => onChange({ autoGrow: event.target.checked })}
          />
          Auto growth (attention relocating)
        </label>
        <Slider
          label="Grow every"
          value={params.growEvery}
          min={1}
          max={20}
          step={0.5}
          display={`${params.growEvery.toFixed(1)}s`}
          onChange={(growEvery) => onChange({ growEvery })}
        />
        <label className="chrome-check">
          <input
            type="checkbox"
            checked={params.steppedGeneration}
            onChange={(event) => onChange({ steppedGeneration: event.target.checked })}
          />
          Stepped generation (pause auto; use Step)
        </label>
        <button type="button" className="chrome-reset chrome-reset-full" onClick={onStep}>
          Step once
        </button>
        <button type="button" className="chrome-reset chrome-reset-full" onClick={onResetGrid}>
          Reset grid
        </button>
        <p className="chrome-hint">Click ground to claim or stack. Each action logs its neighbor rules.</p>
      </ChromeSection>
    </>
  )
}
