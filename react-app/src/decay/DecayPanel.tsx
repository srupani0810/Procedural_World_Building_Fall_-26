/**
 * DECAY controls — terrain only until settlement is rebuilt.
 */

import { ChromeSection } from '../ChromeSection.tsx'
import { Slider } from '../Slider.tsx'
import { NOISE_OPTIONS, getNoiseOption, type NoiseId, type TerrainParams } from '../terrainParams.ts'
import type { DecayViewParams } from './params.ts'

export function DecayPanel({
  terrain,
  view,
  onTerrain,
  onView,
  onResetTerrain,
}: {
  terrain: TerrainParams
  view: DecayViewParams
  onTerrain: (patch: Partial<TerrainParams>) => void
  onView: (patch: Partial<DecayViewParams>) => void
  onResetTerrain: () => void
}) {
  const option = getNoiseOption(terrain.noiseId)
  const extra = terrain.extras[terrain.noiseId]

  return (
    <>
      <ChromeSection
        title="Stance"
        tip="Future deindustrialization leftovers — settlement comes back next, on this field."
        defaultOpen
      >
        <p className="chrome-hint">
          Empty noise terrain only for now. No seed city, claims, or process log — add settlement
          incrementally from here. See decay.md.
        </p>
      </ChromeSection>

      <ChromeSection
        title="Terrain"
        tip="Same FastNoise heightfield path as Weathering — independent defaults for this tab."
        defaultOpen
      >
        <label className="chrome-field">
          <span className="chrome-slider-row">
            <span>Noise</span>
            <span className="chrome-slider-value">{option.label}</span>
          </span>
          <select
            value={terrain.noiseId}
            onChange={(event) => onTerrain({ noiseId: event.target.value as NoiseId })}
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
            onTerrain({
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
          onChange={(frequency) => onTerrain({ frequency })}
        />
        <Slider
          label="Amplitude"
          value={terrain.amplitude}
          min={0}
          max={4}
          step={0.01}
          display={terrain.amplitude.toFixed(2)}
          onChange={(amplitude) => onTerrain({ amplitude })}
        />
        <Slider
          label="Octaves"
          value={terrain.octaves}
          min={1}
          max={8}
          step={1}
          display={`${Math.round(terrain.octaves)}`}
          onChange={(octaves) => onTerrain({ octaves: Math.round(octaves) })}
        />
        <Slider
          label="Persistence"
          value={terrain.persistence}
          min={0.1}
          max={1}
          step={0.01}
          display={terrain.persistence.toFixed(2)}
          onChange={(persistence) => onTerrain({ persistence })}
        />
        <Slider
          label="Grid detail"
          value={terrain.detail}
          min={16}
          max={96}
          step={1}
          display={`${Math.round(terrain.detail)}`}
          onChange={(detail) => onTerrain({ detail: Math.round(detail) })}
        />
        <Slider
          label="Fog density"
          value={view.fogDensity}
          min={0.01}
          max={0.15}
          step={0.001}
          display={view.fogDensity.toFixed(3)}
          onChange={(fogDensity) => onView({ fogDensity })}
        />
        <button type="button" className="chrome-reset chrome-reset-full" onClick={onResetTerrain}>
          Reset terrain
        </button>
      </ChromeSection>
    </>
  )
}
