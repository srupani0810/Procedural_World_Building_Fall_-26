/**
 * DECAY chrome — visual / layout shell over the live field.
 * Does not generate roads, plots, or settlement stages.
 */

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Slider } from '../Slider.tsx'
import './DecayChrome.css'
import type { BuildingHoverInfo } from './buildings.ts'
import type { FieldKind } from './fields.ts'
import { MaterialityPreview } from './MaterialityPreview.tsx'
import {
  MATERIAL_LABELS,
  MATERIAL_TONES,
  MIXED_RULE_COPY,
  resetMaterialSettings,
  type MaterialityParams,
  type MaterialPick,
  type MixedAssignRule,
  type ShellMaterial,
  type SurfaceLayer,
  type WearMode,
} from './materiality.ts'
import {
  INTRO_DURATION,
  type AbsenceClockParams,
  type StageCounts,
} from './timeline.ts'
import type {
  BuildingParams,
  DecayLogFilter,
  DecayScreen,
  DecaySelection,
  DecayViewParams,
  DecayViewTab,
  FloorMode,
  RoadCensus,
  RoadEditTool,
  RoadNetworkParams,
} from './params.ts'
import { DECAY_MORPH, DECAY_STAGE } from './params.ts'

type FoldProps = {
  title: string
  defaultOpen?: boolean
  children?: ReactNode
}

function Fold({ title, defaultOpen = true, children }: FoldProps) {
  const [open, setOpen] = useState(defaultOpen)
  const hasBody = children != null
  return (
    <div className="decay-fold">
      <button
        type="button"
        className="decay-fold-head"
        onClick={() => {
          if (hasBody) setOpen((v) => !v)
        }}
        disabled={!hasBody}
      >
        <span>{title}</span>
        <span className="decay-fold-toggle" aria-hidden>
          {hasBody ? (open ? '−' : '+') : '+'}
        </span>
      </button>
      {hasBody && open ? <div className="decay-fold-body">{children}</div> : null}
    </div>
  )
}

function BrandMark() {
  return (
    <div className="decay-brand">
      <span className="decay-brand-course">Design 6197</span>
      <span className="decay-brand-sep">·</span>
      <span className="decay-brand-course-sub">Procedural World Building</span>
    </div>
  )
}

function StageLegend({ title }: { title?: string }) {
  return (
    <div className="decay-legend-block">
      {title ? <p className="decay-legend-title">{title}</p> : null}
      <div className="decay-legend">
        <span className="decay-legend-item">
          <span className="decay-swatch is-new" /> new
        </span>
        <span className="decay-legend-item">
          <span className="decay-swatch is-settled" /> settled
        </span>
        <span className="decay-legend-item">
          <span className="decay-swatch is-abandoned" /> abandoned
        </span>
        <span className="decay-legend-item">
          <span className="decay-swatch is-reclaimed" /> reclaimed
        </span>
        <span className="decay-legend-item">
          <span className="decay-inhabited-dot" /> inhabited
        </span>
      </div>
    </div>
  )
}

function StageTimeChart({
  series,
  timelineT,
}: {
  series: { t: number; counts: StageCounts }[]
  timelineT: number
}) {
  const w = 320
  const h = 88
  const pad = 4
  const maxN = useMemo(() => {
    let m = 1
    for (const s of series) {
      const tot =
        s.counts.new + s.counts.settled + s.counts.abandoned + s.counts.reclaimed
      if (tot > m) m = tot
    }
    return m
  }, [series])

  const pathFor = (key: keyof StageCounts, color: string) => {
    if (series.length < 2) return null
    const pts = series.map((s, i) => {
      const x = pad + (i / (series.length - 1)) * (w - pad * 2)
      const y = h - pad - (s.counts[key] / maxN) * (h - pad * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    return (
      <polyline
        key={key}
        fill="none"
        stroke={color}
        strokeWidth={1.4}
        points={pts.join(' ')}
      />
    )
  }

  const playX =
    pad + (Math.max(0, Math.min(INTRO_DURATION, timelineT)) / INTRO_DURATION) * (w - pad * 2)

  return (
    <div className="decay-chart-frame">
      {series.length === 0 ? (
        <div className="decay-chart-empty">waiting for buildings</div>
      ) : (
        <svg
          className="decay-chart-svg"
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="none"
          aria-hidden
        >
          {pathFor('new', DECAY_STAGE.new)}
          {pathFor('settled', DECAY_STAGE.settled)}
          {pathFor('abandoned', DECAY_STAGE.abandoned)}
          {pathFor('reclaimed', DECAY_STAGE.reclaimed)}
          <line x1={playX} x2={playX} y1={0} y2={h} stroke="#e10600" strokeWidth={1} />
        </svg>
      )}
    </div>
  )
}

/** Decorative storyboard preview — not live settlement data. */
function EntryLotPreview() {
  // Pattern keys: n new, s settled, a abandoned, r reclaimed, . empty, i inhabited settled
  const rows = [
    '....nnss..',
    '..nnsssai.',
    '.nsssiiarr',
    'nssiiiaarr',
    'ssiiaaarrr',
    'siiaaarrrr',
    '.iaaarrr..',
    '..aarrr...',
  ]
  return (
    <div className="decay-entry-preview" aria-hidden>
      <div className="decay-entry-preview-grid">
        {rows.map((row, y) =>
          row.split('').map((cell, x) => {
            if (cell === '.') {
              return <span key={`${x}-${y}`} className="decay-lot is-void" />
            }
            const stage =
              cell === 'n'
                ? 'new'
                : cell === 's' || cell === 'i'
                  ? 'settled'
                  : cell === 'a'
                    ? 'abandoned'
                    : 'reclaimed'
            return (
              <span key={`${x}-${y}`} className={`decay-lot is-${stage}`}>
                {cell === 'i' ? <i className="decay-lot-dot" /> : null}
              </span>
            )
          }),
        )}
      </div>
      <div className="decay-entry-preview-fade" />
    </div>
  )
}

function PhaseRail({ active }: { active: 'phase1' | 'phase2' | 'entry' }) {
  return (
    <div className="decay-phase-rail" aria-label="Phases">
      <span className={active === 'phase1' || active === 'entry' ? 'is-on' : undefined}>
        Phase 1 · Timeline
      </span>
      <span className="decay-phase-rail-line" aria-hidden />
      <span className={active === 'phase2' ? 'is-on' : undefined}>Phase 2 · Continuous</span>
    </div>
  )
}

function filterLog(lines: string[], filter: DecayLogFilter) {
  if (filter === 'all') return lines
  const key =
    filter === 'stage'
      ? /stage|settled|abandoned|reclaimed|held|new\b/i
      : filter === 'rule'
        ? /rule|claim|neighbor|vacancy|max-block|bias|material|wear|grime|rust|chalk|moss|panel|debris|tarp/i
        : filter === 'glass'
          ? /glass|pane|window|crack/i
          : /lamp|flicker|inhabited/i
  return lines.filter((line) => key.test(line))
}

const TOOLS: { id: RoadEditTool; label: string }[] = [
  { id: 'edit', label: 'Edit' },
  { id: 'connect', label: 'Connect' },
  { id: 'delete', label: 'Delete' },
]

export function DecayShell({
  screen,
  onScreen,
  viewTab,
  onViewTab,
  roads,
  view,
  buildings,
  materiality,
  census,
  roadLog,
  selection,
  buildingHover,
  timelineT,
  timelinePlaying,
  absenceClock,
  stageCounts,
  stageSeries,
  onRoads,
  onView,
  onBuildings,
  onMateriality,
  onMaterialityReplace,
  onAppendLog,
  onTimelineT,
  onTimelinePlaying,
  onAbsenceClock,
  onResetField,
  onResetGraph,
  onLeaveApp,
}: {
  screen: DecayScreen
  onScreen: (s: DecayScreen) => void
  viewTab: DecayViewTab
  onViewTab: (t: DecayViewTab) => void
  roads: RoadNetworkParams
  view: DecayViewParams
  buildings: BuildingParams
  materiality: MaterialityParams
  census: RoadCensus
  roadLog: string[]
  selection: DecaySelection
  buildingHover: { info: BuildingHoverInfo | null; sx: number; sy: number }
  timelineT: number
  timelinePlaying: boolean
  absenceClock: AbsenceClockParams
  stageCounts: StageCounts
  stageSeries: { t: number; counts: StageCounts }[]
  onRoads: (patch: Partial<RoadNetworkParams>) => void
  onView: (patch: Partial<DecayViewParams>) => void
  onBuildings: (patch: Partial<BuildingParams>) => void
  onMateriality: (patch: Partial<MaterialityParams>) => void
  onMaterialityReplace: (next: MaterialityParams) => void
  onAppendLog: (lines: string[]) => void
  onTimelineT: (t: number) => void
  onTimelinePlaying: (playing: boolean) => void
  onAbsenceClock: (patch: Partial<AbsenceClockParams>) => void
  onResetField: (kind: FieldKind) => void
  onResetGraph: () => void
  onLeaveApp: () => void
}) {
  const [logFilter, setLogFilter] = useState<DecayLogFilter>('all')
  const filteredLog = useMemo(() => filterLog(roadLog, logFilter), [roadLog, logFilter])
  const fieldTab = buildings.activeField
  const editMat: ShellMaterial =
    materiality.material === 'mixed' ? 'brick' : materiality.material

  const setLayer = (key: keyof Pick<
    MaterialityParams,
    'grime' | 'rainStreaks' | 'rust' | 'chalk' | 'salt' | 'moss'
  >, patch: Partial<SurfaceLayer>, label: string) => {
    const prev = materiality[key]
    const next = { ...prev, ...patch }
    onMateriality({ [key]: next })
    if (patch.on != null) {
      onAppendLog([`[material] ${label} ${patch.on ? 'on' : 'off'} · rule layer toggle`])
    }
  }

  const angleFill = ((roads.angleDeg - 0) / 90) * 100

  return (
    <div className="decay-shell" data-screen={screen}>
      <div className="decay-top-left">
        <BrandMark />
        <div className="decay-exit">
          {screen !== 'entry' ? (
            <button type="button" onClick={() => onScreen('entry')}>
              Exit field
            </button>
          ) : null}
          <button type="button" onClick={onLeaveApp}>
            Leave DECAY
          </button>
        </div>
      </div>

      {screen !== 'entry' ? (
        <div className="decay-top-tabs" role="tablist" aria-label="View">
          <button
            type="button"
            role="tab"
            className={viewTab === '3d' ? 'is-active' : undefined}
            aria-selected={viewTab === '3d'}
            onClick={() => onViewTab('3d')}
          >
            3D
          </button>
          <button type="button" role="tab" disabled title="Not available — no 2D field map yet">
            2D
          </button>
          <button type="button" role="tab" disabled title="Not available — no first-person walk yet">
            Jump In
          </button>
        </div>
      ) : null}

      {screen === 'entry' ? (
        <div className="decay-entry">
          <div className="decay-entry-layout">
            <div className="decay-entry-copy">
              <h1 className="decay-wordmark">Decay</h1>
              <p className="decay-tagline">What stays standing after the upkeep stops.</p>
              <p className="decay-lede">
                A settlement grown by rules, then left to the absence of care. Watch it empty
                unevenly, then add new lots into what remains.
              </p>
              <ol className="decay-rules-num">
                <li>
                  <span className="decay-rules-num-idx">01</span>
                  <div>
                    <strong>Absence, not disaster</strong>
                    <span>Nothing explodes. Upkeep stops, one lot at a time.</span>
                  </div>
                </li>
                <li>
                  <span className="decay-rules-num-idx">02</span>
                  <div>
                    <strong>Never fully discarded</strong>
                    <span>
                      Shells stay legible. Late stages stain, open and mark them. They are never
                      erased.
                    </span>
                  </div>
                </li>
                <li>
                  <span className="decay-rules-num-idx">03</span>
                  <div>
                    <strong>You only add</strong>
                    <span>Claim empty lots and stack them. You cannot clear or restore anything.</span>
                  </div>
                </li>
              </ol>
              <div className="decay-entry-actions">
                <button
                  type="button"
                  className="decay-btn decay-btn-fill"
                  onClick={() => onScreen('roads')}
                >
                  Enter the Field
                </button>
                <button type="button" className="decay-btn decay-btn-ghost" onClick={() => onScreen('phase1')}>
                  Watch the Timeline · 48s
                </button>
              </div>
            </div>
            <EntryLotPreview />
          </div>
          <div className="decay-entry-foot">
            <StageLegend title="Lot stages" />
            <PhaseRail active="entry" />
          </div>
          <p className="decay-entry-note">
            Preview lots are storyboard illustration only — settlement stages are not on this tab
            yet.
          </p>
        </div>
      ) : null}

      {screen === 'phase1' ? (
        <>
          <aside className="decay-left" aria-label="Timeline">
            <Fold title="Timeline" defaultOpen>
              <p className="decay-panel-kicker">
                Phase 1 · Timeline intro · {timelineT.toFixed(1)}s / {INTRO_DURATION}s
              </p>
              <p className="decay-hint">
                Uneven vacating: rim / steep / small plots start earlier; core lasts longest.
                Stage flips one building at a time by onset rank.
              </p>
              <Slider
                label="Intro time"
                value={timelineT}
                min={0}
                max={INTRO_DURATION}
                step={0.1}
                display={`${timelineT.toFixed(1)}s / ${INTRO_DURATION}s`}
                onChange={(t) => {
                  onTimelinePlaying(false)
                  onTimelineT(t)
                }}
              />
              <div className="decay-btn-row">
                <button
                  type="button"
                  className="decay-btn decay-btn-fill"
                  onClick={() => {
                    if (timelineT >= INTRO_DURATION) onTimelineT(0)
                    onTimelinePlaying(!timelinePlaying)
                  }}
                >
                  {timelinePlaying ? 'Pause' : 'Play'}
                </button>
                <button
                  type="button"
                  className="decay-btn"
                  onClick={() => {
                    onTimelinePlaying(false)
                    onTimelineT(0)
                    onAppendLog(['[stage] rewind · t=0 · rule timeline'])
                  }}
                >
                  Rewind
                </button>
              </div>
              <button
                type="button"
                className="decay-btn"
                onClick={() => {
                  onTimelinePlaying(false)
                  onTimelineT(INTRO_DURATION)
                  onScreen('phase2')
                  onAppendLog(['[stage] skip to Phase 2 · t=48 · rule timeline'])
                }}
              >
                Skip to Phase 2
              </button>
            </Fold>
            <Fold title="Absence Clock" defaultOpen>
              <p className="decay-hint">
                Age thresholds (same shape as Weathering v3). Decay speed scales age after onset.
              </p>
              <Slider
                label="Decay speed"
                value={absenceClock.decaySpeed}
                min={0.25}
                max={4}
                step={0.05}
                display={absenceClock.decaySpeed.toFixed(2)}
                onChange={(decaySpeed) => onAbsenceClock({ decaySpeed })}
              />
              <Slider
                label="New → Settled"
                value={absenceClock.settledAt}
                min={0.5}
                max={Math.max(2, absenceClock.abandonedAt - 0.5)}
                step={0.5}
                display={`${absenceClock.settledAt.toFixed(1)}s`}
                onChange={(settledAt) => onAbsenceClock({ settledAt })}
              />
              <Slider
                label="Settled → Abandoned"
                value={absenceClock.abandonedAt}
                min={absenceClock.settledAt + 0.5}
                max={Math.max(absenceClock.settledAt + 1, absenceClock.reclaimedAt - 0.5)}
                step={0.5}
                display={`${absenceClock.abandonedAt.toFixed(1)}s`}
                onChange={(abandonedAt) => onAbsenceClock({ abandonedAt })}
              />
              <Slider
                label="Abandoned → Reclaimed"
                value={absenceClock.reclaimedAt}
                min={absenceClock.abandonedAt + 0.5}
                max={INTRO_DURATION}
                step={0.5}
                display={`${absenceClock.reclaimedAt.toFixed(1)}s`}
                onChange={(reclaimedAt) => onAbsenceClock({ reclaimedAt })}
              />
            </Fold>
            <Fold title="Roads" defaultOpen={false}>
              <button type="button" className="decay-btn" onClick={() => onScreen('roads')}>
                Open road graph
              </button>
            </Fold>
            <Fold title="Atmosphere" />
            <Fold title="Terrain" />
          </aside>
          <aside className="decay-right" aria-label="Process log">
            <Fold title="Process log" defaultOpen>
              <LogChips filter={logFilter} onFilter={setLogFilter} />
              <pre className="decay-log-pre">
                {filteredLog.length === 0
                  ? logFilter === 'all'
                    ? 'log — waiting for stage / road events'
                    : `log — no “${logFilter}” events`
                  : filteredLog.join('\n')}
              </pre>
            </Fold>
          </aside>
          <div className="decay-dock decay-dock-wide">
            <div className="decay-chart">
              <div className="decay-chart-head">
                <p className="decay-chart-title">Lots by stage over time</p>
                <div className="decay-chart-counts" aria-label="Stage counts">
                  <span>
                    <i className="decay-swatch is-new" /> new {stageCounts.new}
                  </span>
                  <span>
                    <i className="decay-swatch is-settled" /> settled {stageCounts.settled}
                  </span>
                  <span>
                    <i className="decay-swatch is-abandoned" /> abandoned {stageCounts.abandoned}
                  </span>
                  <span>
                    <i className="decay-swatch is-reclaimed" /> reclaimed {stageCounts.reclaimed}
                  </span>
                </div>
              </div>
              <StageTimeChart series={stageSeries} timelineT={timelineT} />
              <div className="decay-chart-foot">
                <span>0s</span>
                <span>{INTRO_DURATION}s</span>
              </div>
            </div>
          </div>
          {buildingHover.info ? (
            <div
              className="decay-hover-label"
              style={
                {
                  left: buildingHover.sx + 14,
                  top: buildingHover.sy + 14,
                  position: 'fixed',
                } as CSSProperties
              }
            >
              <div>plot p{buildingHover.info.plotId}</div>
              <div>stage {buildingHover.info.stage ?? '—'}</div>
              <div>age {(buildingHover.info.age ?? 0).toFixed(1)}s</div>
              <div>Height {buildingHover.info.heightField.toFixed(2)}</div>
              <div>Size {buildingHover.info.sizeField.toFixed(2)}</div>
            </div>
          ) : null}
        </>
      ) : null}

      {screen === 'phase2' ? (
        <>
          <aside className="decay-left" aria-label="Claim">
            <Fold title="Claim" defaultOpen>
              <p className="decay-hint">
                Click an empty open lot to claim it. Starts at stage new · 1 story. Add only —
                nothing can be cleared or restored.
              </p>
              <div className="decay-legend" style={{ justifyContent: 'flex-start' }}>
                {[DECAY_STAGE.new, DECAY_STAGE.settled, DECAY_STAGE.abandoned, DECAY_STAGE.reclaimed].map(
                  (c) => (
                    <span
                      key={c}
                      className="decay-swatch"
                      style={{ background: c, opacity: 0.35 }}
                      title="Swatch — not available yet"
                    />
                  ),
                )}
              </div>
              <label className="decay-slider" style={{ '--fill': '0%' } as CSSProperties}>
                <span className="decay-slider-row">
                  <span>Max stories</span>
                  <span>n/a</span>
                </span>
                <input type="range" min={1} max={8} value={1} disabled />
              </label>
            </Fold>
            <Fold title="Field Decay" defaultOpen>
              <p className="decay-row">
                <span>Town decay</span>
                <span>n/a</span>
              </p>
              <p className="decay-na">
                Not available — height-weighted town decay % next.
              </p>
              <p className="decay-hint">Add only. Nothing can be cleared or restored.</p>
            </Fold>
            <button type="button" className="decay-btn" onClick={() => onScreen('roads')}>
              Road graph
            </button>
            <button type="button" className="decay-btn" onClick={() => onScreen('phase1')}>
              Back to timeline
            </button>
          </aside>
          <aside className="decay-right" aria-label="Process log">
            <Fold title="Process log" defaultOpen>
              <LogChips filter={logFilter} onFilter={setLogFilter} />
              <pre className="decay-log-pre">
                {filteredLog.length === 0
                  ? 'log — claim / stack RULE lines next'
                  : filteredLog.join('\n')}
              </pre>
            </Fold>
          </aside>
          <div className="decay-dock">
            <div className="decay-chart">
              <p className="decay-chart-title">Lots by stage</p>
              <StageLegend />
              <p className="decay-na" style={{ marginBottom: 0 }}>
                Not available — live dock counts next.
              </p>
            </div>
          </div>
          {buildingHover.info ? (
            <div
              className="decay-hover-label"
              style={
                {
                  left: buildingHover.sx + 14,
                  top: buildingHover.sy + 14,
                  position: 'fixed',
                } as CSSProperties
              }
            >
              {buildingHover.info.stage === 'claimable' ? (
                <>
                  <div>plot p{buildingHover.info.plotId}</div>
                  <div>claimable</div>
                </>
              ) : (
                <>
                  <div>plot p{buildingHover.info.plotId}</div>
                  <div>stage {buildingHover.info.stage ?? '—'}</div>
                  <div>age {(buildingHover.info.age ?? 0).toFixed(1)}s</div>
                  <div>stories {buildingHover.info.stories}</div>
                </>
              )}
            </div>
          ) : null}
        </>
      ) : null}

      {screen === 'roads' ? (
        <>
          <aside className="decay-left" aria-label="Road controls">
            <Fold title="Roads" defaultOpen>
              <p className="decay-hint">
                Angle turns the whole grid. Lattice / tier stride rebuilds the graph; morphology
                sliders update plots only.
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
              <label className="decay-check">
                <span>Diagonal roads</span>
                <input
                  type="checkbox"
                  checked={roads.diagonals}
                  onChange={(e) => onRoads({ diagonals: e.target.checked })}
                />
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
                max={1}
                step={0.01}
                display={roads.slopeLimit.toFixed(2)}
                onChange={(slopeLimit) => onRoads({ slopeLimit })}
              />
              <label className="decay-check">
                <span>Editing</span>
                <input
                  type="checkbox"
                  checked={view.editingEnabled}
                  onChange={(e) => onView({ editingEnabled: e.target.checked })}
                />
              </label>
              <p className="decay-hint">
                Off = camera only. On = click nodes/roads to edit; drag empty ground to orbit.
                Drag a selected node to move it.
              </p>
              <p className="decay-hint">Tool</p>
              <div className="decay-tools" role="tablist" aria-label="Road edit">
                {TOOLS.map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    className={view.editTool === tool.id ? 'is-active' : undefined}
                    disabled={!view.editingEnabled}
                    onClick={() => onView({ editTool: tool.id })}
                  >
                    {tool.label}
                  </button>
                ))}
              </div>
              <button type="button" className="decay-btn" onClick={onResetGraph}>
                Reset graph
              </button>
            </Fold>
            <Fold title="Tiers" defaultOpen>
              <p className="decay-hint">Main every Nth lattice line; collectors every Mth.</p>
              <Slider
                label="Main every"
                value={roads.mainEvery}
                min={2}
                max={8}
                step={1}
                display={`${roads.mainEvery}`}
                onChange={(mainEvery) => onRoads({ mainEvery })}
              />
              <Slider
                label="Collector every"
                value={roads.collectorEvery}
                min={1}
                max={4}
                step={1}
                display={`${roads.collectorEvery}`}
                onChange={(collectorEvery) => onRoads({ collectorEvery })}
              />
              <Slider
                label="Main width"
                value={roads.mainWidth}
                min={0.4}
                max={1.8}
                step={0.01}
                display={roads.mainWidth.toFixed(2)}
                onChange={(mainWidth) => onRoads({ mainWidth })}
              />
              <Slider
                label="Collector width"
                value={roads.collectorWidth}
                min={0.3}
                max={1.4}
                step={0.01}
                display={roads.collectorWidth.toFixed(2)}
                onChange={(collectorWidth) => onRoads({ collectorWidth })}
              />
              <Slider
                label="Local width"
                value={roads.localWidth}
                min={0.2}
                max={1.1}
                step={0.01}
                display={roads.localWidth.toFixed(2)}
                onChange={(localWidth) => onRoads({ localWidth, roadWidth: localWidth })}
              />
            </Fold>
            <Fold title="Sidewalks / setbacks" defaultOpen>
              <Slider
                label="Sidewalk width"
                value={roads.sidewalkWidth}
                min={0}
                max={1.6}
                step={0.01}
                display={roads.sidewalkWidth.toFixed(2)}
                onChange={(sidewalkWidth) => onRoads({ sidewalkWidth })}
              />
              <Slider
                label="Front setback"
                value={roads.frontSetback}
                min={0}
                max={2.5}
                step={0.05}
                display={roads.frontSetback.toFixed(2)}
                onChange={(frontSetback) => onRoads({ frontSetback })}
              />
              <Slider
                label="Side setback"
                value={roads.sideSetback}
                min={0}
                max={1.5}
                step={0.05}
                display={roads.sideSetback.toFixed(2)}
                onChange={(sideSetback) => onRoads({ sideSetback })}
              />
              <Slider
                label="Back setback"
                value={roads.backSetback}
                min={0}
                max={2}
                step={0.05}
                display={roads.backSetback.toFixed(2)}
                onChange={(backSetback) => onRoads({ backSetback })}
              />
              <Slider
                label="Corner radius"
                value={roads.cornerRadius}
                min={0}
                max={2.5}
                step={0.05}
                display={roads.cornerRadius.toFixed(2)}
                onChange={(cornerRadius) => onRoads({ cornerRadius })}
              />
            </Fold>
            <Fold title="Blocks / plots" defaultOpen>
              <Slider
                label="Block size"
                value={roads.blockSize}
                min={12}
                max={64}
                step={1}
                display={roads.blockSize.toFixed(0)}
                onChange={(blockSize) => onRoads({ blockSize })}
              />
              <p className="decay-hint">Block shape</p>
              <div className="decay-tools decay-tools-2" role="tablist" aria-label="Block shape">
                <button
                  type="button"
                  className={roads.blockShape === 'square' ? 'is-active' : undefined}
                  onClick={() => onRoads({ blockShape: 'square' })}
                >
                  Square
                </button>
                <button
                  type="button"
                  className={roads.blockShape === 'long' ? 'is-active' : undefined}
                  onClick={() => onRoads({ blockShape: 'long' })}
                >
                  Long
                </button>
              </div>
              <Slider
                label="Plot frontage"
                value={roads.plotFrontage}
                min={4}
                max={20}
                step={0.5}
                display={roads.plotFrontage.toFixed(1)}
                onChange={(plotFrontage) => onRoads({ plotFrontage })}
              />
              <Slider
                label="Plot depth"
                value={roads.plotDepth}
                min={4}
                max={24}
                step={0.5}
                display={roads.plotDepth.toFixed(1)}
                onChange={(plotDepth) => onRoads({ plotDepth })}
              />
              <label className="decay-check">
                <span>Back lanes</span>
                <input
                  type="checkbox"
                  checked={roads.backLanes}
                  onChange={(e) => onRoads({ backLanes: e.target.checked })}
                />
              </label>
              <Slider
                label="Open plot share"
                value={roads.openPlotShare}
                min={0}
                max={0.35}
                step={0.01}
                display={`${Math.round(roads.openPlotShare * 100)}%`}
                onChange={(openPlotShare) => onRoads({ openPlotShare })}
              />
            </Fold>
            <Fold title="Fields" defaultOpen>
              <div className="decay-tools decay-tools-3" role="tablist" aria-label="Field">
                <button
                  type="button"
                  className={fieldTab === 'height' ? 'is-active' : undefined}
                  onClick={() => onBuildings({ activeField: 'height' })}
                >
                  Height
                </button>
                <button
                  type="button"
                  className={fieldTab === 'size' ? 'is-active' : undefined}
                  onClick={() => onBuildings({ activeField: 'size' })}
                >
                  Size
                </button>
                <button
                  type="button"
                  className={fieldTab === 'slope' ? 'is-active' : undefined}
                  onClick={() => onBuildings({ activeField: 'slope' })}
                >
                  Slope
                </button>
              </div>
              {fieldTab === 'height' ? (
                <>
                  <p className="decay-hint">Stories from the Height map (rule-based noise + paint).</p>
                  <Slider
                    label="Min stories"
                    value={buildings.minStories}
                    min={1}
                    max={6}
                    step={1}
                    display={String(buildings.minStories)}
                    onChange={(minStories) => onBuildings({ minStories })}
                  />
                  <Slider
                    label="Max stories"
                    value={buildings.maxStories}
                    min={2}
                    max={16}
                    step={1}
                    display={String(buildings.maxStories)}
                    onChange={(maxStories) => onBuildings({ maxStories })}
                  />
                  <Slider
                    label="Story height"
                    value={buildings.storyHeight}
                    min={2.4}
                    max={4.2}
                    step={0.1}
                    display={buildings.storyHeight.toFixed(1)}
                    onChange={(storyHeight) => onBuildings({ storyHeight })}
                  />
                </>
              ) : null}
              {fieldTab === 'size' ? (
                <>
                  <p className="decay-hint">Footprint fill inside the building line.</p>
                  <Slider
                    label="Min fill"
                    value={buildings.minSizeFill}
                    min={0.15}
                    max={0.7}
                    step={0.01}
                    display={buildings.minSizeFill.toFixed(2)}
                    onChange={(minSizeFill) => onBuildings({ minSizeFill })}
                  />
                  <Slider
                    label="Max fill"
                    value={buildings.maxSizeFill}
                    min={0.5}
                    max={1}
                    step={0.01}
                    display={buildings.maxSizeFill.toFixed(2)}
                    onChange={(maxSizeFill) => onBuildings({ maxSizeFill })}
                  />
                </>
              ) : null}
              {fieldTab === 'slope' ? (
                <>
                  <p className="decay-hint">Floor, foundation, terrace, and steep shrink.</p>
                  <p className="decay-hint">Floor mode</p>
                  <div className="decay-tools decay-tools-3" role="tablist" aria-label="Floor mode">
                    {(
                      [
                        ['lowest', 'Lowest'],
                        ['average', 'Average'],
                        ['highest', 'Highest'],
                      ] as [FloorMode, string][]
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        className={buildings.floorMode === id ? 'is-active' : undefined}
                        onClick={() => onBuildings({ floorMode: id })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <label className="decay-check">
                    <span>Terracing</span>
                    <input
                      type="checkbox"
                      checked={buildings.terrace}
                      onChange={(e) => onBuildings({ terrace: e.target.checked })}
                    />
                  </label>
                  <Slider
                    label="Terrace step"
                    value={buildings.terraceStep}
                    min={0.4}
                    max={3}
                    step={0.1}
                    display={buildings.terraceStep.toFixed(1)}
                    onChange={(terraceStep) => onBuildings({ terraceStep })}
                  />
                  <Slider
                    label="Steep shrink"
                    value={buildings.steepShrink}
                    min={0}
                    max={1.5}
                    step={0.05}
                    display={buildings.steepShrink.toFixed(2)}
                    onChange={(steepShrink) => onBuildings({ steepShrink })}
                  />
                </>
              ) : null}
              <p className="decay-hint" style={{ marginTop: 8 }}>
                Paint ({fieldTab})
              </p>
              <label className="decay-check">
                <span>Paint brush</span>
                <input
                  type="checkbox"
                  checked={buildings.painting}
                  onChange={(e) => onBuildings({ painting: e.target.checked })}
                />
              </label>
              <div className="decay-tools decay-tools-2" role="tablist" aria-label="Paint mode">
                <button
                  type="button"
                  className={buildings.paintMode === 'raise' ? 'is-active' : undefined}
                  onClick={() => onBuildings({ paintMode: 'raise' })}
                >
                  Raise
                </button>
                <button
                  type="button"
                  className={buildings.paintMode === 'lower' ? 'is-active' : undefined}
                  onClick={() => onBuildings({ paintMode: 'lower' })}
                >
                  Lower
                </button>
              </div>
              <Slider
                label="Brush size"
                value={buildings.brushRadius}
                min={4}
                max={48}
                step={1}
                display={buildings.brushRadius.toFixed(0)}
                onChange={(brushRadius) => onBuildings({ brushRadius })}
              />
              <Slider
                label="Brush strength"
                value={buildings.brushStrength}
                min={0.05}
                max={1}
                step={0.05}
                display={buildings.brushStrength.toFixed(2)}
                onChange={(brushStrength) => onBuildings({ brushStrength })}
              />
              <label className="decay-check">
                <span>Heat map</span>
                <input
                  type="checkbox"
                  checked={buildings.heatmap}
                  onChange={(e) => onBuildings({ heatmap: e.target.checked })}
                />
              </label>
              <button
                type="button"
                className="decay-btn"
                onClick={() => onResetField(fieldTab)}
              >
                Reset Field
              </button>
            </Fold>
            <Fold title="Materiality" defaultOpen>
              <p className="decay-hint">
                Surface wear is shader + world position (no bitmaps / UVs). Mass stays square —
                geometry bites only late and capped.
              </p>
              <p className="decay-hint">Material</p>
              <div className="decay-tools decay-tools-mat" role="tablist" aria-label="Material">
                {(
                  [
                    'brick',
                    'concrete',
                    'plaster',
                    'metal',
                    'mixed',
                  ] as MaterialPick[]
                ).map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={materiality.material === id ? 'is-active' : undefined}
                    onClick={() => {
                      onMateriality({ material: id })
                      onAppendLog([`[material] set ${MATERIAL_LABELS[id]} · rule picker`])
                    }}
                  >
                    {id === 'metal' ? 'Metal' : MATERIAL_LABELS[id]}
                  </button>
                ))}
              </div>
              {materiality.material === 'mixed' ? (
                <>
                  <p className="decay-hint">Mixed assign rule</p>
                  <div className="decay-tools decay-tools-2" role="tablist" aria-label="Mixed rule">
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
                        onClick={() => {
                          onMateriality({ mixedRule: id })
                          onAppendLog([`[material] mixed rule ${id} · rule assign`])
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="decay-hint">{MIXED_RULE_COPY[materiality.mixedRule]}</p>
                </>
              ) : (
                <>
                  <p className="decay-hint">Base tone ({MATERIAL_LABELS[editMat]})</p>
                  <div className="decay-swatch-row" role="list">
                    {MATERIAL_TONES[editMat].map((hex, i) => (
                      <button
                        key={hex}
                        type="button"
                        className={
                          materiality.toneIndex[editMat] === i
                            ? 'decay-tone is-active'
                            : 'decay-tone'
                        }
                        style={{ background: hex }}
                        aria-label={`Tone ${i + 1}`}
                        onClick={() =>
                          onMateriality({
                            toneIndex: { ...materiality.toneIndex, [editMat]: i },
                          })
                        }
                      />
                    ))}
                  </div>
                </>
              )}

              <p className="decay-hint" style={{ marginTop: 8 }}>
                Wear preview
              </p>
              <div className="decay-tools decay-tools-2" role="tablist" aria-label="Wear mode">
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
                    onClick={() => {
                      onMateriality({ wearMode: id })
                      onAppendLog([`[material] wear mode ${id} · rule preview`])
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <Slider
                label="Wear"
                value={materiality.wear}
                min={0}
                max={3}
                step={0.05}
                display={materiality.wear.toFixed(2)}
                onChange={(wear) => onMateriality({ wear })}
              />
              {materiality.wearMode === 'distance' ? (
                <>
                  <p className="decay-hint">
                    Distance mode: rim wears first (stand-in for uneven vacancy). Core stays
                    newer.
                  </p>
                  <Slider
                    label="Wear radius"
                    value={materiality.wearRadius}
                    min={60}
                    max={320}
                    step={5}
                    display={materiality.wearRadius.toFixed(0)}
                    onChange={(wearRadius) => onMateriality({ wearRadius })}
                  />
                </>
              ) : (
                <p className="decay-hint">Scrub applies the same wear to every shell (0 new → 3 reclaimed).</p>
              )}

              <p className="decay-hint" style={{ marginTop: 8 }}>
                Surface weathering (shader)
              </p>
              {(
                [
                  ['grime', 'Grime (base / roof edge)', materiality.grime],
                  ['rainStreaks', 'Rain streaks', materiality.rainStreaks],
                  ['rust', 'Rust', materiality.rust],
                  ['chalk', 'Paint loss / chalking', materiality.chalk],
                  ['salt', 'Salt stains (brick)', materiality.salt],
                  ['moss', 'Moss / weeds at base', materiality.moss],
                ] as const
              ).map(([key, label, layer]) => (
                <div key={key} className="decay-layer-row">
                  <label className="decay-check">
                    <span>{label}</span>
                    <input
                      type="checkbox"
                      checked={layer.on}
                      onChange={(e) => setLayer(key, { on: e.target.checked }, label)}
                    />
                  </label>
                  <Slider
                    label="Strength"
                    value={layer.strength}
                    min={0}
                    max={1}
                    step={0.05}
                    display={layer.strength.toFixed(2)}
                    onChange={(strength) => setLayer(key, { strength }, label)}
                  />
                </div>
              ))}

              <p className="decay-hint" style={{ marginTop: 8 }}>
                Geometry weathering (late / capped)
              </p>
              <label className="decay-check">
                <span>Missing wall panel (exposed side)</span>
                <input
                  type="checkbox"
                  checked={materiality.missingPanel}
                  onChange={(e) => {
                    onMateriality({ missingPanel: e.target.checked })
                    onAppendLog([
                      `[material] missing panel ${e.target.checked ? 'on' : 'off'} · rule layer toggle`,
                    ])
                  }}
                />
              </label>
              <label className="decay-check">
                <span>Base debris (one side)</span>
                <input
                  type="checkbox"
                  checked={materiality.debris}
                  onChange={(e) => {
                    onMateriality({ debris: e.target.checked })
                    onAppendLog([
                      `[material] debris ${e.target.checked ? 'on' : 'off'} · rule layer toggle`,
                    ])
                  }}
                />
              </label>
              <label className="decay-check">
                <span>Tarp patch (one side)</span>
                <input
                  type="checkbox"
                  checked={materiality.tarp}
                  onChange={(e) => {
                    onMateriality({ tarp: e.target.checked })
                    onAppendLog([
                      `[material] tarp ${e.target.checked ? 'on' : 'off'} · rule layer toggle`,
                    ])
                  }}
                />
              </label>
              <p className="decay-hint decay-na">
                Broken windows — not available until windows exist.
              </p>

              <p className="decay-hint" style={{ marginTop: 8 }}>
                Stage preview
              </p>
              <MaterialityPreview materiality={materiality} />

              <button
                type="button"
                className="decay-btn"
                onClick={() => {
                  const next = resetMaterialSettings(materiality, editMat)
                  onMaterialityReplace(next)
                  onAppendLog([`[material] reset ${MATERIAL_LABELS[editMat]} settings · rule reset`])
                }}
              >
                Reset {MATERIAL_LABELS[editMat]} settings
              </button>
            </Fold>
            <Fold title="View" defaultOpen>
              <label className="decay-check">
                <span>Show roads</span>
                <input
                  type="checkbox"
                  checked={view.showRoads}
                  onChange={(e) => onView({ showRoads: e.target.checked })}
                />
              </label>
              <label className="decay-check">
                <span>Show sidewalks</span>
                <input
                  type="checkbox"
                  checked={view.showSidewalks}
                  onChange={(e) => onView({ showSidewalks: e.target.checked })}
                />
              </label>
              <label className="decay-check">
                <span>Show plots</span>
                <input
                  type="checkbox"
                  checked={view.showPlots}
                  onChange={(e) => onView({ showPlots: e.target.checked })}
                />
              </label>
              <label className="decay-check">
                <span>Show buildings</span>
                <input
                  type="checkbox"
                  checked={view.showBuildings}
                  onChange={(e) => onView({ showBuildings: e.target.checked })}
                />
              </label>
              <label className="decay-check">
                <span>Show building line</span>
                <input
                  type="checkbox"
                  checked={view.showBuildingLine}
                  onChange={(e) => onView({ showBuildingLine: e.target.checked })}
                />
              </label>
              <label className="decay-check">
                <span>Show corner plots</span>
                <input
                  type="checkbox"
                  checked={view.showCornerPlots}
                  onChange={(e) => onView({ showCornerPlots: e.target.checked })}
                />
              </label>
              <label className="decay-check">
                <span>Show open plots</span>
                <input
                  type="checkbox"
                  checked={view.showOpenPlots}
                  onChange={(e) => onView({ showOpenPlots: e.target.checked })}
                />
              </label>
              <label className="decay-check">
                <span>Show nodes</span>
                <input
                  type="checkbox"
                  checked={view.showNodes}
                  onChange={(e) => onView({ showNodes: e.target.checked })}
                />
              </label>
              <Slider
                label="Fog density"
                value={view.fogDensity}
                min={0.01}
                max={0.15}
                step={0.001}
                display={view.fogDensity.toFixed(3)}
                onChange={(fogDensity) => onView({ fogDensity })}
              />
            </Fold>
            <button type="button" className="decay-btn" onClick={() => onScreen('phase1')}>
              Timeline (preview)
            </button>
          </aside>

          <aside className="decay-right" aria-label="Road stats and log">
            <Fold title="Stats" defaultOpen>
              <div className="decay-row">
                <span>Nodes</span>
                <span>{census.nodes}</span>
              </div>
              <div className="decay-row">
                <span>Roads</span>
                <span>{census.roads}</span>
              </div>
              <div className="decay-row">
                <span>Junctions</span>
                <span>{census.junctions}</span>
              </div>
              <div className="decay-row">
                <span>Dead ends</span>
                <span>{census.deadEnds}</span>
              </div>
              <div className="decay-row">
                <span>Blocks</span>
                <span>{census.blocks}</span>
              </div>
              <div className="decay-row">
                <span>Plots</span>
                <span>{census.plots}</span>
              </div>
              <div className="decay-row">
                <span>Corner plots</span>
                <span>{census.cornerPlots}</span>
              </div>
              <div className="decay-row">
                <span>Open plots</span>
                <span>{census.openPlots}</span>
              </div>
              <div className="decay-row">
                <span>Avg plot size</span>
                <span>{census.avgPlotArea.toFixed(0)}</span>
              </div>
              <div className="decay-row">
                <span>Road land</span>
                <span>{(census.roadShare * 100).toFixed(1)}%</span>
              </div>
              <div className="decay-row">
                <span>Sidewalk land</span>
                <span>{(census.sidewalkShare * 100).toFixed(1)}%</span>
              </div>
              <div className="decay-row">
                <span>Plot land</span>
                <span>{(census.plotShare * 100).toFixed(1)}%</span>
              </div>
              <p className="decay-hint" style={{ marginTop: 8 }}>
                Angle {Math.round(roads.angleDeg)}° · fill {angleFill.toFixed(0)}%
              </p>
            </Fold>
            <Fold title="Layout legend" defaultOpen>
              <div className="decay-plot-legend">
                <div className="decay-row">
                  <span>
                    <i className="decay-swatch" style={{ background: DECAY_MORPH.sidewalk }} /> sidewalk
                  </span>
                </div>
                <div className="decay-row">
                  <span>
                    <i className="decay-swatch" style={{ background: DECAY_MORPH.buildingLine }} />{' '}
                    building line
                  </span>
                </div>
                <div className="decay-row">
                  <span>
                    <i className="decay-swatch" style={{ background: DECAY_MORPH.cornerPlot }} /> corner
                    plot
                  </span>
                </div>
                <div className="decay-row">
                  <span>
                    <i className="decay-swatch" style={{ background: DECAY_MORPH.openPlot }} /> open plot
                  </span>
                </div>
              </div>
              <p className="decay-hint">Boxes from Height / Size fields · open plots stay empty.</p>
            </Fold>
            <Fold title="Process log" defaultOpen>
              <LogChips filter={logFilter} onFilter={setLogFilter} />
              <pre className="decay-log-pre">
                {filteredLog.length === 0
                  ? logFilter === 'all'
                    ? 'log — waiting for roads'
                    : `log — no “${logFilter}” lines in the road log`
                  : filteredLog.join('\n')}
              </pre>
            </Fold>
          </aside>

          <div className="decay-dock">
            <div className="decay-chart">
              <p className="decay-chart-title">Morphology</p>
              <p className="decay-hint" style={{ marginBottom: 0 }}>
                Edge-packed plots · field-driven boxes · foundation follows slope. No decay
                stages yet.
              </p>
            </div>
          </div>

          {buildingHover.info ? (
            <div
              className="decay-hover-label"
              style={
                {
                  left: buildingHover.sx + 14,
                  top: buildingHover.sy + 14,
                  position: 'fixed',
                } as CSSProperties
              }
            >
              <div>plot p{buildingHover.info.plotId}</div>
              <div>stage {buildingHover.info.stage ?? '—'}</div>
              <div>age {(buildingHover.info.age ?? 0).toFixed(1)}s</div>
              <div>Height {buildingHover.info.heightField.toFixed(2)}</div>
              <div>Size {buildingHover.info.sizeField.toFixed(2)}</div>
              <div>slope {buildingHover.info.slope.toFixed(3)}</div>
              <div>floor {buildingHover.info.floorY.toFixed(2)}</div>
              <div>foundation {buildingHover.info.foundationHeight.toFixed(2)}</div>
              <div>shrink {buildingHover.info.shrink.toFixed(2)}</div>
              <div>{buildingHover.info.stories} stories</div>
            </div>
          ) : null}

          {selection.draggingId != null ? (
            <div className="decay-tip">dragging n{selection.draggingId}</div>
          ) : selection.selectedId != null ? (
            <div className="decay-tip">selected n{selection.selectedId}</div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function LogChips({
  filter,
  onFilter,
}: {
  filter: DecayLogFilter
  onFilter: (f: DecayLogFilter) => void
}) {
  const chips: DecayLogFilter[] = ['all', 'stage', 'rule', 'glass', 'lamp']
  return (
    <div className="decay-log-chips" role="tablist" aria-label="Log filter">
      {chips.map((c) => (
        <button
          key={c}
          type="button"
          className={filter === c ? 'is-active' : undefined}
          onClick={() => onFilter(c)}
        >
          {c}
        </button>
      ))}
    </div>
  )
}
