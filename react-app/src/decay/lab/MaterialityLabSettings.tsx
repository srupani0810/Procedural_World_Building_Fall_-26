/**
 * Lab Materiality settings — colors, material kind, surface + geometry wear.
 * Shares the type draft with Architecture; Apply is shared. No Math.random.
 */

import { useState, type ReactNode } from 'react'
import type { BuildingTypeParams } from '../buildingTypeTable.ts'
import { HOUSE_BEFORE } from '../housePalette.ts'
import {
  MATERIAL_LABELS,
  MATERIAL_TONES,
  MIXED_RULE_COPY,
  type CompareMode,
  type GeoLayer,
  type MaterialityParams,
  type MaterialPick,
  type MixedAssignRule,
  type ShellMaterial,
  type SurfaceLayer,
  type WearMode,
} from '../materiality.ts'
import type { LabPreview } from './labDraft.ts'

type Props = {
  draft: BuildingTypeParams
  preview: LabPreview
  materiality: MaterialityParams
  dirty: boolean
  onDraft: (next: BuildingTypeParams) => void
  onPreview: (next: LabPreview) => void
  onMateriality: (next: MaterialityParams) => void
  onResetType: () => void
  onResetAll: () => void
  onApply: () => void
  onRevert: () => void
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
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={Number(value.toFixed(3))}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
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
      <div className="decay-lab-swatches" role="list">
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
            aria-label={`${label} ${hex}`}
            onClick={() => onPick(hex)}
          />
        ))}
      </div>
    </div>
  )
}

function patchColors(
  draft: BuildingTypeParams,
  patch: Partial<BuildingTypeParams['colors']>,
): BuildingTypeParams {
  return { ...draft, colors: { ...draft.colors, ...patch } }
}

function setSurface(
  mat: MaterialityParams,
  key: keyof Pick<
    MaterialityParams,
    'grime' | 'rainStreaks' | 'rust' | 'chalk' | 'salt' | 'moss'
  >,
  patch: Partial<SurfaceLayer>,
): MaterialityParams {
  return { ...mat, [key]: { ...mat[key], ...patch } }
}

function setGeo(
  mat: MaterialityParams,
  key: keyof Pick<
    MaterialityParams,
    'missingPanel' | 'debris' | 'tarp' | 'brokenPanes' | 'gutterDamage'
  >,
  patch: Partial<GeoLayer>,
): MaterialityParams {
  const next = { ...mat[key], ...patch }
  if (patch.startWear != null) next.startWear = Math.max(2, patch.startWear)
  if (patch.cap != null) next.cap = Math.max(0, Math.min(1, patch.cap))
  return { ...mat, [key]: next }
}

export function MaterialityLabSettings({
  draft,
  preview,
  materiality,
  dirty,
  onDraft,
  onPreview,
  onMateriality,
  onResetType,
  onResetAll,
  onApply,
  onRevert,
}: Props) {
  const editMat: ShellMaterial =
    materiality.material === 'mixed' ? 'brick' : materiality.material

  const wallOptions = MATERIAL_TONES.brick
  const trimOptions = [HOUSE_BEFORE.trim, HOUSE_BEFORE.cornice, HOUSE_BEFORE.stone]
  const roofOptions = [HOUSE_BEFORE.roof, '#3a342e', '#5a5048', '#2a2826']
  const doorOptions =
    draft.colors.doorTones.length > 0
      ? draft.colors.doorTones
      : [...HOUSE_BEFORE.doors]

  const matOrder: MaterialPick[] = [
    'brick',
    'concrete',
    'plaster',
    'metal',
    'mixed',
    'clapboard',
  ]

  return (
    <aside className="decay-lab-settings" aria-label="Materiality settings">
      <header className="decay-lab-settings-head">
        <div className="decay-lab-settings-title">
          <h2>{draft.label} · Materiality</h2>
          {dirty ? (
            <span className="decay-lab-dirty" title="Draft differs from the city">
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
        <Fold title="Materials and colors">
          <p className="decay-lab-hint">Material</p>
          <div className="decay-tools decay-tools-mat" role="tablist" aria-label="Material">
            {matOrder.map((id) => (
              <button
                key={id}
                type="button"
                className={materiality.material === id ? 'is-active' : undefined}
                onClick={() => onMateriality({ ...materiality, material: id })}
              >
                {MATERIAL_LABELS[id]}
              </button>
            ))}
          </div>
          {materiality.material === 'mixed' ? (
            <>
              <p className="decay-lab-hint">Mixed assign rule</p>
              <div className="decay-tools decay-tools-2" role="tablist">
                {(
                  [
                    ['byHeight', 'By height'],
                    ['byDistance', 'By distance'],
                  ] as [MixedAssignRule, string][]
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={materiality.mixedRule === id ? 'is-active' : undefined}
                    onClick={() =>
                      onMateriality({ ...materiality, mixedRule: id })
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="decay-lab-hint">{MIXED_RULE_COPY[materiality.mixedRule]}</p>
            </>
          ) : (
            <>
              <p className="decay-lab-hint">
                Base tone ({MATERIAL_LABELS[editMat]}) · Before palette
              </p>
              <SwatchRow
                label="Tone"
                options={MATERIAL_TONES[editMat]}
                value={
                  MATERIAL_TONES[editMat][materiality.toneIndex[editMat]] ??
                  MATERIAL_TONES[editMat][0]!
                }
                onPick={(hex) => {
                  const i = MATERIAL_TONES[editMat].findIndex(
                    (h) => h.toLowerCase() === hex.toLowerCase(),
                  )
                  onMateriality({
                    ...materiality,
                    toneIndex: {
                      ...materiality.toneIndex,
                      [editMat]: i >= 0 ? i : 0,
                    },
                  })
                  if (editMat === 'brick' || editMat === 'clapboard' || editMat === 'plaster') {
                    onDraft(patchColors(draft, { wall: hex }))
                  }
                }}
              />
            </>
          )}

          <p className="decay-lab-hint" style={{ marginTop: 8 }}>
            Type colors (Before palette)
          </p>
          <SwatchRow
            label="Wall"
            options={wallOptions}
            value={draft.colors.wall}
            onPick={(hex) => {
              onDraft(patchColors(draft, { wall: hex }))
              const i = MATERIAL_TONES.brick.findIndex(
                (h) => h.toLowerCase() === hex.toLowerCase(),
              )
              if (i >= 0) {
                onMateriality({
                  ...materiality,
                  toneIndex: { ...materiality.toneIndex, brick: i },
                })
              }
            }}
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
        </Fold>

        <Fold title="Weathering · Texture (surface)">
          <p className="decay-lab-hint">Shader only — never moves vertices.</p>
          {(
            [
              ['grime', 'Grime'],
              ['rainStreaks', 'Rain streaks'],
              ['rust', 'Rust'],
              ['chalk', 'Paint fade'],
              ['salt', 'Salt stains'],
              ['moss', 'Moss'],
            ] as const
          ).map(([key, label]) => {
            const layer = materiality[key]
            return (
              <div key={key} className="decay-layer-row">
                <label className="decay-check">
                  <span>{label}</span>
                  <input
                    type="checkbox"
                    checked={layer.on}
                    onChange={(e) =>
                      onMateriality(setSurface(materiality, key, { on: e.target.checked }))
                    }
                  />
                </label>
                <SliderField
                  label="Strength"
                  value={layer.strength}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(strength) =>
                    onMateriality(setSurface(materiality, key, { strength }))
                  }
                />
              </div>
            )
          })}
        </Fold>

        <Fold title="Weathering · Geometry (structure)">
          <p className="decay-lab-hint">
            Late, local, capped. Start wear never before 2. Shell stays legible.
          </p>
          {(
            [
              ['missingPanel', 'Missing wall panel'],
              ['debris', 'Base debris'],
              ['tarp', 'Tarp patch'],
              ['brokenPanes', 'Broken panes'],
              ['gutterDamage', 'Gutter damage'],
            ] as const
          ).map(([key, label]) => {
            const layer = materiality[key]
            return (
              <div key={key} className="decay-layer-row">
                <label className="decay-check">
                  <span>{label}</span>
                  <input
                    type="checkbox"
                    checked={layer.on}
                    onChange={(e) =>
                      onMateriality(setGeo(materiality, key, { on: e.target.checked }))
                    }
                  />
                </label>
                <SliderField
                  label="Strength"
                  value={layer.strength}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(strength) =>
                    onMateriality(setGeo(materiality, key, { strength }))
                  }
                />
                <SliderField
                  label="Cap"
                  value={layer.cap}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(cap) => onMateriality(setGeo(materiality, key, { cap }))}
                />
                <SliderField
                  label="Start wear"
                  value={layer.startWear}
                  min={2}
                  max={3}
                  step={0.05}
                  onChange={(startWear) =>
                    onMateriality(setGeo(materiality, key, { startWear }))
                  }
                />
              </div>
            )
          })}
        </Fold>

        <Fold title="Wear and era">
          <p className="decay-lab-hint">Wear preview mode</p>
          <div className="decay-tools decay-tools-2" role="tablist">
            {(
              [
                ['scrub', 'Scrub'],
                ['distance', 'Distance'],
              ] as [WearMode, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={materiality.wearMode === id ? 'is-active' : undefined}
                onClick={() => onMateriality({ ...materiality, wearMode: id })}
              >
                {label}
              </button>
            ))}
          </div>
          <SliderField
            label="Wear scrub"
            value={materiality.wear}
            min={0}
            max={3}
            step={0.05}
            onChange={(wear) => onMateriality({ ...materiality, wear })}
          />
          {materiality.wearMode === 'distance' ? (
            <SliderField
              label="Wear radius"
              value={materiality.wearRadius}
              min={60}
              max={320}
              step={5}
              onChange={(wearRadius) =>
                onMateriality({ ...materiality, wearRadius })
              }
            />
          ) : null}
          <SliderField
            label="Era (Before → After)"
            value={materiality.era}
            min={0}
            max={1}
            step={0.05}
            onChange={(era) => onMateriality({ ...materiality, era })}
          />
        </Fold>

        <Fold title="Compare mode">
          <div className="decay-tools decay-tools-2" role="tablist">
            {(
              [
                ['texture', 'Texture only'],
                ['geometry', 'Geometry only'],
                ['both', 'Both'],
                ['sideBySide', 'Side by side'],
              ] as [CompareMode, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={materiality.compareMode === id ? 'is-active' : undefined}
                onClick={() =>
                  onMateriality({ ...materiality, compareMode: id })
                }
              >
                {label}
              </button>
            ))}
          </div>
          <p className="decay-lab-hint">
            Side by side shows texture-only and geometry-only at the same wear.
          </p>
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
