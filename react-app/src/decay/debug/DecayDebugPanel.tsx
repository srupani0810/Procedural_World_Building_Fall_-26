/**
 * DECAY Debug panel — mounts only when Debug is on.
 * Compact, draggable, collapsible. Polls live store ~4 Hz.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { BuildingHoverInfo } from '../buildings.ts'
import type { JumpDebugInfo } from '../DecayFirstPerson.tsx'
import type { DecayViewTab } from '../params.ts'
import type { StageCounts } from '../timeline.ts'
import {
  DEBUG_TICK_MS,
  readDebugLive,
  type DebugLive,
  type RebuildEntry,
} from './debugRuntime.ts'

export type DebugPanelProps = {
  viewTab: DecayViewTab
  timelineT: number
  timelinePlaying: boolean
  stageCounts: StageCounts
  /** materiality.wear — global era / wear scrub. */
  era: number
  hover: BuildingHoverInfo | null
}

function modeLabel(tab: DecayViewTab): string {
  if (tab === 'jump') return 'Jump in'
  if (tab === 'lab') return 'Lab'
  if (tab === '2d') return '2D'
  return 'orbit'
}

function fmtMs(ms: number): string {
  if (ms < 10) return `${ms.toFixed(2)}ms`
  return `${ms.toFixed(1)}ms`
}

function fmtTime(at: number): string {
  const s = at / 1000
  return `${s.toFixed(1)}s`
}

function collisionLabel(j: JumpDebugInfo): string {
  const want = Math.hypot(j.wantDx, j.wantDz)
  const got = Math.hypot(j.gotDx, j.gotDz)
  if (want < 1e-6) return 'idle'
  if (got < 1e-6) return 'blocked'
  if (got < want * 0.85) return 'slid'
  return 'clear'
}

function formLabel(h: BuildingHoverInfo): string {
  if (h.form) return h.form
  if (h.landUse) return h.landUse
  return '—'
}

function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(true)
  return (
    <section className="decay-debug-section">
      <button
        type="button"
        className="decay-debug-section-head"
        onClick={() => setOpen((o) => !o)}
      >
        <span>{title}</span>
        <span aria-hidden>{open ? '−' : '+'}</span>
      </button>
      {open ? <div className="decay-debug-section-body">{children}</div> : null}
    </section>
  )
}

function Row({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="decay-debug-row">
      <span>{k}</span>
      <span>{v}</span>
    </div>
  )
}

function RebuildList({ items }: { items: RebuildEntry[] }) {
  if (items.length === 0) {
    return <p className="decay-debug-empty">no rebuilds yet</p>
  }
  return (
    <ul className="decay-debug-rebuilds">
      {items.map((r, i) => (
        <li key={`${r.at}-${i}`}>
          <strong>{r.kind}</strong> {fmtMs(r.ms)}
          <span className="decay-debug-muted"> · {r.cause}</span>
          <span className="decay-debug-muted"> · t={fmtTime(r.at)}</span>
        </li>
      ))}
    </ul>
  )
}

export function DecayDebugPanel({
  viewTab,
  timelineT,
  timelinePlaying,
  stageCounts,
  era,
  hover,
}: DebugPanelProps) {
  const [live, setLive] = useState<DebugLive>(() => readDebugLive())
  const [collapsed, setCollapsed] = useState(false)
  const [pos, setPos] = useState({ x: 12, y: 52 })
  const drag = useRef<{ ox: number; oy: number; px: number; py: number } | null>(
    null,
  )

  useEffect(() => {
    const id = window.setInterval(() => {
      setLive(readDebugLive())
    }, DEBUG_TICK_MS)
    return () => window.clearInterval(id)
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, input, a')) return
    drag.current = {
      ox: e.clientX,
      oy: e.clientY,
      px: pos.x,
      py: pos.y,
    }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    setPos({
      x: Math.max(0, d.px + (e.clientX - d.ox)),
      y: Math.max(0, d.py + (e.clientY - d.oy)),
    })
  }
  const onPointerUp = () => {
    drag.current = null
  }

  const perf = live.perf
  const jump = live.jump
  const forms = live.forms

  return (
    <div
      className={collapsed ? 'decay-debug-panel is-collapsed' : 'decay-debug-panel'}
      style={{ left: pos.x, top: pos.y }}
      role="complementary"
      aria-label="Debug"
    >
      <header
        className="decay-debug-head"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <span className="decay-debug-title">Debug</span>
        <button
          type="button"
          className="decay-debug-collapse"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
        >
          {collapsed ? 'Expand' : 'Collapse'}
        </button>
      </header>

      {!collapsed ? (
        <div className="decay-debug-body">
          <Section title="Performance">
            <Row k="FPS" v={perf ? perf.fps.toFixed(0) : '—'} />
            <Row
              k="Frame avg / worst"
              v={
                perf
                  ? `${perf.frameAvgMs.toFixed(2)} / ${perf.frameWorstMs.toFixed(2)} ms`
                  : '—'
              }
            />
            <Row k="Draw calls" v={perf ? perf.drawCalls : '—'} />
            <Row k="Triangles" v={perf ? perf.triangles.toLocaleString() : '—'} />
            <Row
              k="Geometries / textures"
              v={perf ? `${perf.geometries} / ${perf.textures}` : '—'}
            />
            <p className="decay-debug-sub">Instances by form</p>
            <Row k="row" v={forms.row} />
            <Row k="walk-up" v={forms.walkup} />
            <Row k="tenement" v={forms.tenement} />
            <Row k="factory" v={forms.factory} />
            <Row k="warehouse" v={forms.warehouse} />
            <Row k="heavy" v={forms.heavy} />
            <Row k="rail" v={forms.rail} />
            <Row k="corner shop" v={forms.cornerShop} />
            <Row k="main block" v={forms.mainBlock} />
            <Row k="civic" v={forms.civic} />
          </Section>

          <Section title="Mode and input">
            <Row k="Mode" v={modeLabel(viewTab)} />
            <Row
              k="Keys"
              v={live.keysDown.length ? live.keysDown.join('+') : '(none)'}
            />
            <Row
              k="Camera"
              v={
                perf
                  ? `${perf.camPos[0].toFixed(1)}, ${perf.camPos[1].toFixed(1)}, ${perf.camPos[2].toFixed(1)}`
                  : '—'
              }
            />
            <Row
              k="Look"
              v={
                perf
                  ? `${perf.camDir[0].toFixed(2)}, ${perf.camDir[1].toFixed(2)}, ${perf.camDir[2].toFixed(2)}`
                  : '—'
              }
            />
            <Row
              k="OrbitControls"
              v={
                perf?.orbitEnabled == null
                  ? '—'
                  : perf.orbitEnabled
                    ? 'on'
                    : 'off'
              }
            />
          </Section>

          <Section title="Jump in">
            {jump ? (
              <>
                <Row k="Player xz" v={`${jump.x.toFixed(2)}, ${jump.z.toFixed(2)}`} />
                <Row k="Walkable" v={jump.walkable ? 'yes' : 'no'} />
                <Row k="Move" v={`${jump.moveX}, ${jump.moveZ}`} />
                <Row
                  k="Want Δ"
                  v={`${jump.wantDx.toFixed(3)}, ${jump.wantDz.toFixed(3)}`}
                />
                <Row
                  k="Got Δ"
                  v={`${jump.gotDx.toFixed(3)}, ${jump.gotDz.toFixed(3)}`}
                />
                <Row k="Collision" v={collisionLabel(jump)} />
                <Row k="Keys (jump)" v={jump.keys} />
              </>
            ) : (
              <p className="decay-debug-empty">not in Jump in</p>
            )}
            <Row
              k="Walk map"
              v={
                live.walkMap
                  ? `${live.walkMap.n}×${live.walkMap.n} (${live.walkMap.cells} cells) · ${fmtMs(live.walkMap.buildMs)}`
                  : '—'
              }
            />
          </Section>

          <Section title="Clocks">
            <Row
              k="Timeline"
              v={`${timelineT.toFixed(2)}s · ${timelinePlaying ? 'playing' : 'paused'}`}
            />
            <Row k="new" v={stageCounts.new} />
            <Row k="settled" v={stageCounts.settled} />
            <Row k="abandoned" v={stageCounts.abandoned} />
            <Row k="reclaimed" v={stageCounts.reclaimed} />
            <Row k="Era (wear)" v={era.toFixed(2)} />
          </Section>

          <Section title="Under the cursor">
            {hover ? (
              <>
                <Row k="Plot" v={`p${hover.plotId}`} />
                <Row k="Land use" v={hover.landUse ?? '—'} />
                <Row k="Form" v={formLabel(hover)} />
                <Row k="Stories" v={hover.stories} />
                <Row
                  k="District"
                  v={(hover.districtField ?? 0).toFixed(3)}
                />
                <Row k="Plot field" v={(hover.plotField ?? 0).toFixed(3)} />
                <Row k="Final" v={hover.heightField.toFixed(3)} />
                <Row k="Stage" v={hover.stage ?? '—'} />
                <Row
                  k="Rule"
                  v={hover.stageRule ?? hover.landUseRule ?? '—'}
                />
              </>
            ) : (
              <p className="decay-debug-empty">nothing under cursor</p>
            )}
          </Section>

          <Section title="Rebuilds">
            <RebuildList items={live.rebuilds} />
          </Section>
        </div>
      ) : null}
    </div>
  )
}
