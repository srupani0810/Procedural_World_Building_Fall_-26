/**
 * DECAY controls — road graph + terrain.
 */

import { ChromeSection } from '../ChromeSection.tsx'
import { Slider } from '../Slider.tsx'
import { NOISE_OPTIONS, getNoiseOption, type NoiseId, type TerrainParams } from '../terrainParams.ts'
import type { DecayViewParams, RoadCensus, RoadEditTool, RoadNetworkParams } from './params.ts'

const TOOLS: { id: RoadEditTool; label: string }[] = [
  { id: 'edit', label: 'Edit' },
  { id: 'connect', label: 'Connect' },
  { id: 'delete', label: 'Delete' },
]

export function DecayPanel({
  terrain,
  view,
  roads,
  onTerrain,
  onView,
  onRoads,
  onResetTerrain,
  onResetGraph,
  census,
}: {
  terrain: TerrainParams
  view: DecayViewParams
  roads: RoadNetworkParams
  onTerrain: (patch: Partial<TerrainParams>) => void
  onView: (patch: Partial<DecayViewParams>) => void
  onRoads: (patch: Partial<RoadNetworkParams>) => void
  onResetTerrain: () => void
  onResetGraph: () => void
  census: RoadCensus
}) {
  const option = getNoiseOption(terrain.noiseId)
  const extra = terrain.extras[terrain.noiseId]

  return (
    <>
      <ChromeSection
        title="Stance"
        tip="Circulation graph first — buildings come later on these plots."
        defaultOpen
      >
        <p className="chrome-hint">
          Road graph fills the 520×520 terrain square (not endless). Nodes on the ground,
          roads as segments. Tilted grids are built oversized then clipped to that square.
          Steep ground is skipped. Closed loops become inset plots. No buildings yet.
        </p>
      </ChromeSection>

      <ChromeSection
        title="Roads"
        tip="Each slider rebuilds the lattice. Hand edits are discarded."
        defaultOpen
      >
        <p className="chrome-hint">
          {census.nodes} nodes · {census.roads} roads · {census.plots} plots
        </p>
        <p className="chrome-hint">
          Moving a slider deletes the graph and plots and rebuilds from these values. Hand
          edits are lost on rebuild.
        </p>
        <Slider
          label="Spacing"
          value={roads.spacing}
          min={8}
          max={36}
          step={1}
          display={roads.spacing.toFixed(0)}
          onChange={(spacing) => onRoads({ spacing })}
        />
        <Slider
          label="Angle"
          value={roads.angleDeg}
          min={0}
          max={90}
          step={1}
          display={`${Math.round(roads.angleDeg)}°`}
          onChange={(angleDeg) => onRoads({ angleDeg })}
        />
        <label className="chrome-check">
          <input
            type="checkbox"
            checked={roads.diagonals}
            onChange={(e) => onRoads({ diagonals: e.target.checked })}
          />
          Diagonal roads
        </label>
        <Slider
          label="Diagonal spacing"
          value={roads.diagonalSpacing}
          min={8}
          max={48}
          step={1}
          display={roads.diagonalSpacing.toFixed(0)}
          onChange={(diagonalSpacing) => onRoads({ diagonalSpacing })}
        />
        <Slider
          label="Slope limit"
          value={roads.slopeLimit}
          min={0.1}
          max={1.0}
          step={0.01}
          display={roads.slopeLimit.toFixed(2)}
          onChange={(slopeLimit) => onRoads({ slopeLimit })}
        />
        <Slider
          label="Road width"
          value={roads.roadWidth}
          min={0.25}
          max={1.2}
          step={0.01}
          display={roads.roadWidth.toFixed(2)}
          onChange={(roadWidth) => onRoads({ roadWidth })}
        />
        <p className="chrome-hint">
          Edit: drag a node, click a road to split. Connect: two nodes. Delete: node or road.
        </p>
        <div className="chrome-modes chrome-modes-3 chrome-road-tools" role="tablist" aria-label="Road edit">
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              type="button"
              className={view.editTool === tool.id ? 'is-active' : undefined}
              onClick={() => onView({ editTool: tool.id })}
            >
              {tool.label}
            </button>
          ))}
        </div>
        <button type="button" className="chrome-reset chrome-reset-full" onClick={onResetGraph}>
          Reset graph
        </button>
      </ChromeSection>

      <ChromeSection title="Terrain" tip="Independent FastNoise heightfield — roads drape onto it.">
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
