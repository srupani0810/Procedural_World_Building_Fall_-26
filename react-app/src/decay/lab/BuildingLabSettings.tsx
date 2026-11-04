/**
 * Building Lab settings — edits a local draft of buildingTypeTable row.
 * Does not write the live city table.
 */

import type { BuildingTypeParams, RoofKind } from '../buildingTypeTable.ts'
import { HOUSE_BEFORE } from '../housePalette.ts'
import type { LabPreview } from './labDraft.ts'

type Props = {
  draft: BuildingTypeParams
  preview: LabPreview
  onDraft: (next: BuildingTypeParams) => void
  onPreview: (next: LabPreview) => void
  onReset: () => void
}

function patchSize(
  draft: BuildingTypeParams,
  patch: Partial<BuildingTypeParams['size']>,
): BuildingTypeParams {
  return { ...draft, size: { ...draft.size, ...patch } }
}
function patchRoof(
  draft: BuildingTypeParams,
  patch: Partial<BuildingTypeParams['roof']>,
): BuildingTypeParams {
  return { ...draft, roof: { ...draft.roof, ...patch } }
}
function patchWindows(
  draft: BuildingTypeParams,
  patch: Partial<BuildingTypeParams['windows']>,
): BuildingTypeParams {
  return { ...draft, windows: { ...draft.windows, ...patch } }
}
function patchEntrance(
  draft: BuildingTypeParams,
  patch: Partial<BuildingTypeParams['entrance']>,
): BuildingTypeParams {
  return { ...draft, entrance: { ...draft.entrance, ...patch } }
}
function patchColors(
  draft: BuildingTypeParams,
  patch: Partial<BuildingTypeParams['colors']>,
): BuildingTypeParams {
  return { ...draft, colors: { ...draft.colors, ...patch } }
}

function Num({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (n: number) => void
}) {
  return (
    <label className="decay-lab-field">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isFinite(n)) onChange(n)
        }}
      />
    </label>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="decay-lab-field decay-lab-toggle">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  )
}

function SwatchRow({
  label,
  options,
  value,
  onPick,
}: {
  label: string
  options: readonly string[]
  value: string
  onPick: (hex: string) => void
}) {
  return (
    <div className="decay-lab-swatch-row">
      <span>{label}</span>
      <div className="decay-lab-swatches">
        {options.map((hex) => (
          <button
            key={hex}
            type="button"
            className={
              hex.toLowerCase() === value.toLowerCase()
                ? 'decay-lab-swatch is-active'
                : 'decay-lab-swatch'
            }
            style={{ background: hex }}
            title={hex}
            aria-label={`${label} ${hex}`}
            onClick={() => onPick(hex)}
          />
        ))}
      </div>
    </div>
  )
}

export function BuildingLabSettings({
  draft,
  preview,
  onDraft,
  onPreview,
  onReset,
}: Props) {
  const roofKindUi: 'gable' | 'flatCornice' =
    draft.roof.kind === 'flatCornice' ? 'flatCornice' : 'gable'

  const wallOptions =
    draft.colors.wallTones.length > 0
      ? draft.colors.wallTones
      : [HOUSE_BEFORE.brick, HOUSE_BEFORE.plaster, ...HOUSE_BEFORE.walkupBodies]
  const trimOptions = [HOUSE_BEFORE.trim, HOUSE_BEFORE.cornice, HOUSE_BEFORE.stone]
  const roofOptions = [HOUSE_BEFORE.roof, '#3a342e', '#5a5048', '#2a2826']
  const doorOptions =
    draft.colors.doorTones.length > 0
      ? draft.colors.doorTones
      : [...HOUSE_BEFORE.doors]

  return (
    <aside className="decay-lab-settings" aria-label="Type settings">
      <header className="decay-lab-settings-head">
        <h2>{draft.label}</h2>
        <button type="button" className="decay-lab-reset" onClick={onReset}>
          Reset type
        </button>
      </header>

      <section className="decay-lab-group">
        <h3>Size</h3>
        <Num
          label="Stories min"
          value={draft.size.storyMin}
          min={1}
          max={8}
          step={1}
          onChange={(n) => {
            const storyMin = Math.max(1, Math.min(8, Math.floor(n)))
            onDraft(
              patchSize(draft, {
                storyMin,
                storyMax: Math.max(storyMin, draft.size.storyMax),
              }),
            )
            if (preview.stories < storyMin) {
              onPreview({
                ...preview,
                stories: storyMin as 2 | 3 | 4,
              })
            }
          }}
        />
        <Num
          label="Stories max"
          value={draft.size.storyMax}
          min={1}
          max={8}
          step={1}
          onChange={(n) => {
            const storyMax = Math.max(1, Math.min(8, Math.floor(n)))
            onDraft(
              patchSize(draft, {
                storyMax,
                storyMin: Math.min(storyMax, draft.size.storyMin),
              }),
            )
            if (preview.stories > storyMax) {
              onPreview({
                ...preview,
                stories: storyMax as 2 | 3 | 4,
              })
            }
          }}
        />
        <Num
          label="Width ×"
          value={draft.size.widthMult}
          min={0.5}
          max={2}
          step={0.05}
          onChange={(n) => onDraft(patchSize(draft, { widthMult: n }))}
        />
        <Num
          label="Depth ×"
          value={draft.size.depthMult}
          min={0.5}
          max={2}
          step={0.05}
          onChange={(n) => onDraft(patchSize(draft, { depthMult: n }))}
        />
        <Num
          label="Preview stories"
          value={preview.stories}
          min={draft.size.storyMin}
          max={draft.size.storyMax}
          step={1}
          onChange={(n) =>
            onPreview({
              ...preview,
              stories: Math.max(
                draft.size.storyMin,
                Math.min(draft.size.storyMax, Math.floor(n)),
              ) as 2 | 3 | 4,
            })
          }
        />
      </section>

      <section className="decay-lab-group">
        <h3>Roof</h3>
        <label className="decay-lab-field">
          <span>Type</span>
          <select
            value={roofKindUi}
            onChange={(e) => {
              const kind = e.target.value as RoofKind
              onDraft(patchRoof(draft, { kind }))
            }}
          >
            <option value="gable">Gable</option>
            <option value="flatCornice">Flat with cornice</option>
          </select>
        </label>
        <Num
          label="Pitch"
          value={draft.roof.pitch}
          min={0}
          max={0.8}
          step={0.05}
          onChange={(n) => onDraft(patchRoof(draft, { pitch: n }))}
        />
        <Num
          label="Overhang"
          value={draft.roof.overhang}
          min={0}
          max={0.2}
          step={0.01}
          onChange={(n) => onDraft(patchRoof(draft, { overhang: n }))}
        />
        <Num
          label="Parapet height"
          value={draft.roof.parapetHeight}
          min={0}
          max={0.4}
          step={0.02}
          onChange={(n) => onDraft(patchRoof(draft, { parapetHeight: n }))}
        />
        <Num
          label="Chimney count"
          value={draft.entrance.chimneyCount}
          min={0}
          max={2}
          step={1}
          onChange={(n) =>
            onDraft(
              patchEntrance(draft, {
                chimneyCount: Math.max(0, Math.min(2, Math.floor(n))),
              }),
            )
          }
        />
      </section>

      <section className="decay-lab-group">
        <h3>Windows</h3>
        <Num
          label="Columns"
          value={draft.windows.columns}
          min={1}
          max={4}
          step={1}
          onChange={(n) =>
            onDraft(patchWindows(draft, { columns: Math.floor(n) }))
          }
        />
        <Num
          label="Rows"
          value={draft.windows.rows}
          min={1}
          max={6}
          step={1}
          onChange={(n) =>
            onDraft(patchWindows(draft, { rows: Math.floor(n) }))
          }
        />
        <Num
          label="Size W"
          value={draft.windows.sizeW}
          min={0.08}
          max={0.3}
          step={0.01}
          onChange={(n) => onDraft(patchWindows(draft, { sizeW: n }))}
        />
        <Num
          label="Size H"
          value={draft.windows.sizeH}
          min={0.1}
          max={0.4}
          step={0.01}
          onChange={(n) => onDraft(patchWindows(draft, { sizeH: n }))}
        />
        <Num
          label="Frame depth"
          value={draft.windows.frameDepth}
          min={0.01}
          max={0.08}
          step={0.005}
          onChange={(n) => onDraft(patchWindows(draft, { frameDepth: n }))}
        />
        <Num
          label="Sill depth"
          value={draft.windows.sillDepth}
          min={0.02}
          max={0.12}
          step={0.01}
          onChange={(n) => onDraft(patchWindows(draft, { sillDepth: n }))}
        />
        <Toggle
          label="Lintel"
          checked={draft.windows.lintel}
          onChange={(v) => onDraft(patchWindows(draft, { lintel: v }))}
        />
        <Toggle
          label="Bay"
          checked={draft.windows.bayAllowed}
          onChange={(v) => {
            onDraft(patchWindows(draft, { bayAllowed: v }))
            if (!v && preview.windows === 'bay') {
              onPreview({ ...preview, windows: 'even' })
            }
          }}
        />
      </section>

      <section className="decay-lab-group">
        <h3>Entrance</h3>
        <label className="decay-lab-field">
          <span>Door side</span>
          <select
            value={preview.doorSide < 0 ? 'L' : 'R'}
            onChange={(e) =>
              onPreview({
                ...preview,
                doorSide: e.target.value === 'L' ? -1 : 1,
              })
            }
          >
            <option value="L">Left</option>
            <option value="R">Right</option>
          </select>
        </label>
        <Num
          label="Stoop steps"
          value={draft.entrance.stoopSteps}
          min={0}
          max={5}
          step={1}
          onChange={(n) =>
            onDraft(
              patchEntrance(draft, {
                stoopSteps: Math.max(0, Math.min(5, Math.floor(n))),
              }),
            )
          }
        />
        <Toggle
          label="Porch roof"
          checked={draft.entrance.porchRoof}
          onChange={(v) => onDraft(patchEntrance(draft, { porchRoof: v }))}
        />
      </section>

      <section className="decay-lab-group">
        <h3>Colors</h3>
        <p className="decay-lab-hint">Before palette</p>
        <SwatchRow
          label="Wall"
          options={wallOptions}
          value={draft.colors.wall}
          onPick={(hex) => onDraft(patchColors(draft, { wall: hex }))}
        />
        <SwatchRow
          label="Trim"
          options={trimOptions}
          value={draft.colors.trim}
          onPick={(hex) => onDraft(patchColors(draft, { trim: hex }))}
        />
        <SwatchRow
          label="Roof"
          options={roofOptions}
          value={draft.colors.roof}
          onPick={(hex) => onDraft(patchColors(draft, { roof: hex }))}
        />
        <SwatchRow
          label="Door"
          options={doorOptions}
          value={
            doorOptions[preview.doorColorIndex] ??
            doorOptions[0] ??
            HOUSE_BEFORE.doors[0]
          }
          onPick={(hex) => {
            const idx = doorOptions.findIndex(
              (h) => h.toLowerCase() === hex.toLowerCase(),
            )
            onPreview({
              ...preview,
              doorColorIndex: idx >= 0 ? idx : 0,
            })
          }}
        />
      </section>
    </aside>
  )
}
