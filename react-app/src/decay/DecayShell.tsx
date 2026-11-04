/**
 * DECAY chrome — visual / layout shell over the live field.
 * Does not generate roads, plots, or settlement stages.
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { Slider } from '../Slider.tsx'
import './DecayChrome.css'
import type { BuildingHoverInfo } from './buildings.ts'
import {
  HEIGHT_NOISE_OPTIONS,
  type FieldKind,
  type FieldMaps,
  type HeightHeatView,
  type HeightNoiseId,
  type HeightNoiseSpec,
} from './fields.ts'
import type { LabPage } from './lab/BuildingLab.tsx'
import {
  INTRO_DURATION,
  type AbsenceClockParams,
  type StageCounts,
} from './timeline.ts'
import {
  LAND_USE_COLORS,
  LAND_USE_ORDER,
  LAND_USE_RULE_TEXT,
  type LandUseViewMode,
} from './landUse.ts'
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
import { DECAY_STAGE } from './params.ts'

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
  labPage = 'architecture',
  onLabPage,
  jumpFailMessage = null,
  onDismissJumpFail,
  jumpDebugLine = null,
  roads,
  view,
  debugEnabled = false,
  onDebugEnabled,
  buildings,
  census,
  roadLog,
  selection,
  buildingHover,
  timelineT,
  timelinePlaying,
  absenceClock,
  stageCounts,
  stageSeries,
  tintMode,
  onTintMode,
  onRoads,
  onView,
  onBuildings,
  onAppendLog,
  onTimelineT,
  onTimelinePlaying,
  onAbsenceClock,
  onResetField,
  onResetGraph,
  onLeaveApp,
  fields,
  onHeightNoise,
}: {
  screen: DecayScreen
  onScreen: (s: DecayScreen) => void
  viewTab: DecayViewTab
  onViewTab: (t: DecayViewTab) => void
  labPage?: LabPage
  onLabPage?: (page: LabPage) => void
  jumpFailMessage?: string | null
  onDismissJumpFail?: () => void
  jumpDebugLine?: string | null
  roads: RoadNetworkParams
  view: DecayViewParams
  /** When false, no debug collectors / overlays / panels mount. */
  debugEnabled?: boolean
  onDebugEnabled?: (on: boolean) => void
  buildings: BuildingParams
  census: RoadCensus
  roadLog: string[]
  selection: DecaySelection
  buildingHover: { info: BuildingHoverInfo | null; sx: number; sy: number }
  timelineT: number
  timelinePlaying: boolean
  absenceClock: AbsenceClockParams
  stageCounts: StageCounts
  stageSeries: { t: number; counts: StageCounts }[]
  tintMode: LandUseViewMode
  onTintMode: (m: LandUseViewMode) => void
  onRoads: (patch: Partial<RoadNetworkParams>) => void
  onView: (patch: Partial<DecayViewParams>) => void
  onBuildings: (patch: Partial<BuildingParams>) => void
  onAppendLog: (lines: string[]) => void
  onTimelineT: (t: number) => void
  onTimelinePlaying: (playing: boolean) => void
  onAbsenceClock: (patch: Partial<AbsenceClockParams>) => void
  onResetField: (kind: FieldKind) => void
  onResetGraph: () => void
  onLeaveApp: () => void
  fields: FieldMaps
  onHeightNoise: (patch: Partial<HeightNoiseSpec>) => void
}) {
  const [logFilter, setLogFilter] = useState<DecayLogFilter>('all')
  const filteredLog = useMemo(() => filterLog(roadLog, logFilter), [roadLog, logFilter])
  const fieldTab = buildings.activeField
  const [labMenuOpen, setLabMenuOpen] = useState(false)
  const labMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!labMenuOpen) return
    const onDoc = (e: MouseEvent) => {
      const el = labMenuRef.current
      if (el && !el.contains(e.target as Node)) setLabMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLabMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [labMenuOpen])

  const labTabLabel =
    labPage === 'materiality' ? 'LAB · MATERIALITY' : 'LAB · ARCHITECTURE'

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
          <button
            type="button"
            role="tab"
            className={viewTab === 'jump' ? 'is-active' : undefined}
            aria-selected={viewTab === 'jump'}
            onClick={() => onViewTab('jump')}
          >
            Jump In
          </button>
          <div className="decay-lab-tab-wrap" ref={labMenuRef}>
            <button
              type="button"
              role="tab"
              className={viewTab === 'lab' ? 'is-active' : undefined}
              aria-selected={viewTab === 'lab'}
              aria-haspopup="menu"
              aria-expanded={labMenuOpen}
              onClick={() => {
                if (viewTab === 'lab') {
                  setLabMenuOpen((o) => !o)
                } else {
                  onViewTab('lab')
                  setLabMenuOpen(true)
                }
              }}
            >
              {viewTab === 'lab' ? labTabLabel : 'LAB'}
            </button>
            {labMenuOpen ? (
              <div className="decay-lab-menu" role="menu" aria-label="Lab pages">
                <button
                  type="button"
                  role="menuitem"
                  className={
                    viewTab === 'lab' && labPage === 'architecture'
                      ? 'is-active'
                      : undefined
                  }
                  onClick={() => {
                    onLabPage?.('architecture')
                    onViewTab('lab')
                    setLabMenuOpen(false)
                  }}
                >
                  Architecture
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={
                    viewTab === 'lab' && labPage === 'materiality'
                      ? 'is-active'
                      : undefined
                  }
                  onClick={() => {
                    onLabPage?.('materiality')
                    onViewTab('lab')
                    setLabMenuOpen(false)
                  }}
                >
                  Materiality
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {screen !== 'entry' && viewTab === 'jump' ? (
        <p className="decay-jump-hint" role="status">
          Arrows/WASD walk+turn · Q/E strafe · Shift run · drag look · Esc exit · sidewalks
          solid
        </p>
      ) : null}

      {screen !== 'entry' && viewTab === 'jump' && jumpDebugLine ? (
        <p className="decay-jump-debug" role="status">
          {jumpDebugLine}
        </p>
      ) : null}

      {screen !== 'entry' && jumpFailMessage ? (
        <p className="decay-jump-fail" role="alert">
          Jump in failed: {jumpFailMessage}
          {onDismissJumpFail ? (
            <button type="button" className="decay-jump-fail-dismiss" onClick={onDismissJumpFail}>
              Dismiss
            </button>
          ) : null}
        </p>
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

      {screen === 'phase1' && viewTab !== 'lab' ? (
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
              <p className="decay-hint">View</p>
              <div className="decay-tools decay-tools-4" role="group" aria-label="View mode">
                {(
                  [
                    ['normal', 'Normal'],
                    ['landUse', 'Land use'],
                    ['stage', 'Stage'],
                    ['both', 'Both'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={tintMode === id ? 'is-active' : undefined}
                    onClick={() => onTintMode(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
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
              <div>
                district {(buildingHover.info.districtField ?? 0).toFixed(2)}
              </div>
              <div>plot {(buildingHover.info.plotField ?? 0).toFixed(2)}</div>
              <div>field {buildingHover.info.heightField.toFixed(2)}</div>
              <div>{buildingHover.info.stories} stories</div>
              <div>Size {buildingHover.info.sizeField.toFixed(2)}</div>
            </div>
          ) : null}
        </>
      ) : null}

      {screen === 'phase2' && viewTab !== 'lab' ? (
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
                  <div>
                    district {(buildingHover.info.districtField ?? 0).toFixed(2)}
                  </div>
                  <div>plot {(buildingHover.info.plotField ?? 0).toFixed(2)}</div>
                  <div>field {buildingHover.info.heightField.toFixed(2)}</div>
                  <div>{buildingHover.info.stories} stories</div>
                </>
              )}
            </div>
          ) : null}
        </>
      ) : null}

      {screen === 'roads' && viewTab !== 'lab' ? (
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
                  <p className="decay-hint">
                    District + plot noise → combined field 0–1 (paint on top). Forms map into their
                    own story ranges.
                  </p>
                  <label className="decay-field">
                    <span className="decay-slider-row">
                      <span>Noise type</span>
                      <span>
                        {HEIGHT_NOISE_OPTIONS.find((o) => o.id === fields.heightSpec.noiseId)
                          ?.label ?? fields.heightSpec.noiseId}
                      </span>
                    </span>
                    <select
                      value={fields.heightSpec.noiseId}
                      onChange={(e) =>
                        onHeightNoise({ noiseId: e.target.value as HeightNoiseId })
                      }
                    >
                      {HEIGHT_NOISE_OPTIONS.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="decay-field">
                    <span className="decay-slider-row">
                      <span>Seed</span>
                      <span>{fields.heightSpec.seed}</span>
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={String(fields.heightSpec.seed)}
                      onChange={(e) => {
                        const raw = e.target.value.trim()
                        if (raw === '' || raw === '-') return
                        const n = Number.parseInt(raw, 10)
                        if (!Number.isFinite(n)) return
                        onHeightNoise({ seed: n })
                      }}
                    />
                  </label>
                  <Slider
                    label="District scale"
                    value={fields.heightSpec.districtScale}
                    min={0.001}
                    max={0.02}
                    step={0.0005}
                    display={fields.heightSpec.districtScale.toFixed(4)}
                    onChange={(districtScale) => onHeightNoise({ districtScale })}
                  />
                  <p className="decay-hint">Large wavelength (~6–10 blocks). Lower = broader.</p>
                  <Slider
                    label="Plot scale"
                    value={fields.heightSpec.plotScale}
                    min={0.01}
                    max={0.12}
                    step={0.001}
                    display={fields.heightSpec.plotScale.toFixed(3)}
                    onChange={(plotScale) => onHeightNoise({ plotScale })}
                  />
                  <p className="decay-hint">Small wavelength (~1–2 plots). Higher = finer.</p>
                  <Slider
                    label="District vs Plot"
                    value={fields.heightSpec.districtMix}
                    min={0}
                    max={1}
                    step={0.01}
                    display={`${Math.round(fields.heightSpec.districtMix * 100)}% district`}
                    onChange={(districtMix) => onHeightNoise({ districtMix })}
                  />
                  <p className="decay-hint">Heat map view</p>
                  <div className="decay-tools decay-tools-3" role="group" aria-label="Height heat view">
                    {(
                      [
                        ['combined', 'Combined'],
                        ['district', 'District'],
                        ['plot', 'Plot'],
                      ] as [HeightHeatView, string][]
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        className={
                          fields.heightSpec.heatView === id ? 'is-active' : undefined
                        }
                        onClick={() => onHeightNoise({ heatView: id })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <Slider
                    label="Center rise"
                    value={fields.heightSpec.centerRise}
                    min={0}
                    max={1}
                    step={0.01}
                    display={fields.heightSpec.centerRise.toFixed(2)}
                    onChange={(centerRise) => onHeightNoise({ centerRise })}
                  />
                  <Slider
                    label="Edge falloff"
                    value={fields.heightSpec.edgeFalloff}
                    min={0}
                    max={1}
                    step={0.01}
                    display={fields.heightSpec.edgeFalloff.toFixed(2)}
                    onChange={(edgeFalloff) => onHeightNoise({ edgeFalloff })}
                  />
                  <Slider
                    label="Center size"
                    value={fields.heightSpec.centerSize}
                    min={0.1}
                    max={0.9}
                    step={0.01}
                    display={fields.heightSpec.centerSize.toFixed(2)}
                    onChange={(centerSize) => onHeightNoise({ centerSize })}
                  />
                  <Slider
                    label="Octaves"
                    value={fields.heightSpec.octaves}
                    min={1}
                    max={8}
                    step={1}
                    display={String(Math.round(fields.heightSpec.octaves))}
                    onChange={(octaves) => onHeightNoise({ octaves })}
                  />
                  <Slider
                    label="Contrast"
                    value={fields.heightSpec.contrast}
                    min={0}
                    max={2.5}
                    step={0.05}
                    display={fields.heightSpec.contrast.toFixed(2)}
                    onChange={(contrast) => onHeightNoise({ contrast })}
                  />
                  <Slider
                    label="Offset"
                    value={fields.heightSpec.offset}
                    min={0}
                    max={1}
                    step={0.01}
                    display={fields.heightSpec.offset.toFixed(2)}
                    onChange={(offset) => onHeightNoise({ offset })}
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
            <Fold title="View" defaultOpen>
              <p className="decay-hint">View</p>
              <div className="decay-tools decay-tools-4" role="group" aria-label="View mode">
                {(
                  [
                    ['normal', 'Normal'],
                    ['landUse', 'Land use'],
                    ['stage', 'Stage'],
                    ['both', 'Both'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={tintMode === id ? 'is-active' : undefined}
                    onClick={() => onTintMode(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="decay-hint" style={{ marginTop: 6 }}>
                Normal = Before / material colors. Land use = type legend tint. Stage = vacate
                tint. Both = type + light stage.
              </p>
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
              <label className="decay-check">
                <span>Debug</span>
                <input
                  type="checkbox"
                  checked={debugEnabled}
                  onChange={(e) => onDebugEnabled?.(e.target.checked)}
                />
              </label>
              <p className="decay-hint" style={{ marginTop: 4 }}>
                Backtick (`) toggles Debug. Off = no debug cost. Setting is remembered.
              </p>
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
              <p className="decay-hint" style={{ marginTop: 10 }}>
                Land use · count · share
              </p>
              {(
                [
                  ['Housing', LAND_USE_COLORS.housing, census.landHousing],
                  ['Industry', LAND_USE_COLORS.industry, census.landIndustry],
                  ['Commerce', LAND_USE_COLORS.commerce, census.landCommerce],
                  ['Park', LAND_USE_COLORS.park, census.landPark],
                  ['Civic', LAND_USE_COLORS.civic, census.landCivic],
                  ['Yard', LAND_USE_COLORS.yard, census.landYard],
                  ['Farm', LAND_USE_COLORS.farm, census.landFarm],
                ] as const
              ).map(([label, color, count]) => {
                const n = Math.max(1, census.plots)
                const share = ((100 * count) / n).toFixed(1)
                return (
                  <div className="decay-row" key={label}>
                    <span>
                      <i className="decay-swatch" style={{ background: color }} /> {label}
                    </span>
                    <span>
                      {count} · {share}%
                    </span>
                  </div>
                )
              })}
              <p className="decay-hint" style={{ marginTop: 10 }}>
                Housing forms · count · share of housing
              </p>
              {(
                [
                  ['Row', census.housingRow],
                  ['Walk-up', census.housingWalkup],
                  ['Tenement', census.housingTenement],
                ] as const
              ).map(([label, count]) => {
                const n = Math.max(
                  1,
                  census.housingRow + census.housingWalkup + census.housingTenement,
                )
                const share = ((100 * count) / n).toFixed(1)
                return (
                  <div className="decay-row" key={label}>
                    <span>{label}</span>
                    <span>
                      {count} · {share}%
                    </span>
                  </div>
                )
              })}
              <p className="decay-hint" style={{ marginTop: 10 }}>
                Industry forms · count
              </p>
              {(
                [
                  ['Factory', census.industryFactory],
                  ['Warehouse', census.industryWarehouse],
                  ['Heavy plant', census.industryHeavy],
                  ['Rail yard', census.industryRail],
                ] as const
              ).map(([label, count]) => (
                <div className="decay-row" key={label}>
                  <span>{label}</span>
                  <span>{count}</span>
                </div>
              ))}
              <p className="decay-hint" style={{ marginTop: 8 }}>
                Angle {Math.round(roads.angleDeg)}° · fill {angleFill.toFixed(0)}%
              </p>
            </Fold>
            <Fold title="Land use legend" defaultOpen>
              <div className="decay-plot-legend">
                {LAND_USE_ORDER.map((u) => (
                  <div className="decay-row" key={u}>
                    <span>
                      <i className="decay-swatch" style={{ background: LAND_USE_COLORS[u] }} /> {u}
                    </span>
                  </div>
                ))}
              </div>
              <p className="decay-hint" style={{ marginTop: 8 }}>
                {LAND_USE_ORDER.map((u) => LAND_USE_RULE_TEXT[u]).join(' · ')}
              </p>
              <p className="decay-hint">
                Park / Farm = ground only. Housing 60/20/20 row/walk-up/tenement · Industry
                factory/warehouse/heavy · Yard = rail · Commerce taller in core · Civic upright.
              </p>
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
              <div>
                district {(buildingHover.info.districtField ?? 0).toFixed(2)}
              </div>
              <div>plot {(buildingHover.info.plotField ?? 0).toFixed(2)}</div>
              <div>field {buildingHover.info.heightField.toFixed(2)}</div>
              <div>{buildingHover.info.stories} stories</div>
              <div>Size {buildingHover.info.sizeField.toFixed(2)}</div>
              <div>slope {buildingHover.info.slope.toFixed(3)}</div>
              <div>floor {buildingHover.info.floorY.toFixed(2)}</div>
              <div>foundation {buildingHover.info.foundationHeight.toFixed(2)}</div>
              <div>shrink {buildingHover.info.shrink.toFixed(2)}</div>
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
