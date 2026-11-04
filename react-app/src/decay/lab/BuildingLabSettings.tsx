/**
 * Building Lab settings — draft of buildingTypeTable row.
 * Slider + number per value; collapsible groups; Apply / Revert / Reset.
 */

import { useState, type ReactNode } from 'react'
import type { BuildingTypeParams, RoofKind } from '../buildingTypeTable.ts'
import type { LabPreview } from './labDraft.ts'

type Props = {
  draft: BuildingTypeParams
  preview: LabPreview
  dirty: boolean
  onDraft: (next: BuildingTypeParams) => void
  onPreview: (next: LabPreview) => void
  onResetType: () => void
  onResetAll: () => void
  onApply: () => void
  onRevert: () => void
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
function Fold({
  title,
  defaultOpen = true,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="decay-lab-group">
      <button
        type="button"
        className="decay-lab-group-head"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <h3>{title}</h3>
        <span aria-hidden>{open ? '−' : '+'}</span>
      </button>
      {open ? <div className="decay-lab-group-body">{children}</div> : null}
    </section>
  )
}

function SliderField({
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
    <label className="decay-lab-field decay-lab-slider-field">
      <span>{label}</span>
      <div className="decay-lab-slider-row">
        <input
          type="range"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
        />
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
      </div>
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

export function BuildingLabSettings({
  draft,
  preview,
  dirty,
  onDraft,
  onPreview,
  onResetType,
  onResetAll,
  onApply,
  onRevert,
}: Props) {
  const roofKindUi: 'gableOrFlat' | 'gable' | 'flatCornice' =
    draft.roof.kind === 'flatCornice'
      ? 'flatCornice'
      : draft.roof.kind === 'gable'
        ? 'gable'
        : 'gableOrFlat'

  return (
    <aside className="decay-lab-settings" aria-label="Architecture settings">
      <header className="decay-lab-settings-head">
        <div className="decay-lab-settings-title">
          <h2>{draft.label} · Architecture</h2>
          {dirty ? (
            <span className="decay-lab-dirty" title="Draft differs from the city table">
              Draft has changes
            </span>
          ) : null}
        </div>
        <div className="decay-lab-settings-resets">
          <button type="button" className="decay-lab-reset" onClick={onResetType}>
            Reset type
          </button>
          <button type="button" className="decay-lab-reset" onClick={onResetAll}>
            Reset all
          </button>
        </div>
      </header>

      <div className="decay-lab-settings-scroll">
        <Fold title="Size">
          <SliderField
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
                onPreview({ ...preview, stories: storyMin as 2 | 3 | 4 })
              }
            }}
          />
          <SliderField
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
                onPreview({ ...preview, stories: storyMax as 2 | 3 | 4 })
              }
            }}
          />
          <SliderField
            label="Width ×"
            value={draft.size.widthMult}
            min={0.5}
            max={2}
            step={0.05}
            onChange={(n) => onDraft(patchSize(draft, { widthMult: n }))}
          />
          <SliderField
            label="Depth ×"
            value={draft.size.depthMult}
            min={0.5}
            max={2}
            step={0.05}
            onChange={(n) => onDraft(patchSize(draft, { depthMult: n }))}
          />
          <SliderField
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
        </Fold>

        <Fold title="Roof">
          <label className="decay-lab-field">
            <span>Type</span>
            <select
              value={roofKindUi}
              onChange={(e) => {
                const kind = e.target.value as RoofKind
                onDraft(patchRoof(draft, { kind }))
              }}
            >
              <option value="gableOrFlat">Roof: Mixed</option>
              <option value="gable">Gable</option>
              <option value="flatCornice">Flat with cornice</option>
            </select>
          </label>
          <SliderField
            label="Pitch"
            value={draft.roof.pitch}
            min={0}
            max={0.8}
            step={0.05}
            onChange={(n) => onDraft(patchRoof(draft, { pitch: n }))}
          />
          <SliderField
            label="Overhang"
            value={draft.roof.overhang}
            min={0}
            max={0.2}
            step={0.01}
            onChange={(n) => onDraft(patchRoof(draft, { overhang: n }))}
          />
          <SliderField
            label="Parapet height"
            value={draft.roof.parapetHeight}
            min={0}
            max={0.4}
            step={0.02}
            onChange={(n) => onDraft(patchRoof(draft, { parapetHeight: n }))}
          />
          <SliderField
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
        </Fold>

        <Fold title="Windows">
          <SliderField
            label="Columns"
            value={draft.windows.columns}
            min={1}
            max={4}
            step={1}
            onChange={(n) =>
              onDraft(patchWindows(draft, { columns: Math.floor(n) }))
            }
          />
          <SliderField
            label="Rows"
            value={draft.windows.rows}
            min={1}
            max={6}
            step={1}
            onChange={(n) =>
              onDraft(patchWindows(draft, { rows: Math.floor(n) }))
            }
          />
          <SliderField
            label="Size W"
            value={draft.windows.sizeW}
            min={0.08}
            max={0.3}
            step={0.01}
            onChange={(n) => onDraft(patchWindows(draft, { sizeW: n }))}
          />
          <SliderField
            label="Size H"
            value={draft.windows.sizeH}
            min={0.1}
            max={0.4}
            step={0.01}
            onChange={(n) => onDraft(patchWindows(draft, { sizeH: n }))}
          />
          <SliderField
            label="Frame depth"
            value={draft.windows.frameDepth}
            min={0.01}
            max={0.08}
            step={0.005}
            onChange={(n) => onDraft(patchWindows(draft, { frameDepth: n }))}
          />
          <SliderField
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
        </Fold>

        <Fold title="Entrance">
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
          <SliderField
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
        </Fold>
      </div>

      <footer className="decay-lab-settings-foot">
        <button
          type="button"
          className="decay-lab-apply"
          onClick={onApply}
          disabled={!dirty}
        >
          Apply to city
        </button>
        <button
          type="button"
          className="decay-lab-revert"
          onClick={onRevert}
          disabled={!dirty}
        >
          Revert draft
        </button>
      </footer>
    </aside>
  )
}
