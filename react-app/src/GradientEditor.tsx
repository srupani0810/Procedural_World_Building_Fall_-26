import {
  defaultHeightGradient,
  gradientCss,
  newStopId,
  sortStops,
} from './heightGradient.ts'
import type { GradientStop } from './heightGradient.ts'

type Props = {
  stops: GradientStop[]
  onChange: (stops: GradientStop[]) => void
}

export default function GradientEditor({ stops, onChange }: Props) {
  const sorted = sortStops(stops)

  const updateStop = (id: string, patch: Partial<GradientStop>) => {
    onChange(stops.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  const removeStop = (id: string) => {
    if (stops.length <= 2) return
    onChange(stops.filter((s) => s.id !== id))
  }

  const addStop = () => {
    const mid =
      sorted.length >= 2
        ? (sorted[0]!.position + sorted[sorted.length - 1]!.position) * 0.5
        : 0.5
    // Nudge if something already sits on mid
    let position = mid
    const taken = new Set(sorted.map((s) => s.position.toFixed(3)))
    while (taken.has(position.toFixed(3))) {
      position = Math.min(1, position + 0.05)
    }
    onChange([
      ...stops,
      { id: newStopId(), position, color: '#80c040' },
    ])
  }

  const moveStop = (id: string, direction: -1 | 1) => {
    const order = sortStops(stops)
    const index = order.findIndex((s) => s.id === id)
    const swapWith = index + direction
    if (index < 0 || swapWith < 0 || swapWith >= order.length) return
    const a = order[index]!
    const b = order[swapWith]!
    onChange(
      stops.map((s) => {
        if (s.id === a.id) return { ...s, position: b.position }
        if (s.id === b.id) return { ...s, position: a.position }
        return s
      }),
    )
  }

  return (
    <div className="gradient-editor">
      <div
        className="gradient-preview"
        style={{ background: gradientCss(stops) }}
        title="Height gradient preview (low → high)"
        aria-label="Gradient preview from low to high height"
      />
      <div className="gradient-preview-labels">
        <span>0 low</span>
        <span>1 high</span>
      </div>

      <ul className="gradient-stops">
        {sorted.map((stop, index) => (
          <li key={stop.id} className="gradient-stop">
            <label className="gradient-stop-color">
              <span className="visually-hidden">Color</span>
              <input
                type="color"
                value={normalizeHex(stop.color)}
                onChange={(event) => updateStop(stop.id, { color: event.target.value })}
              />
            </label>
            <label className="gradient-stop-pos">
              <span className="chrome-slider-row">
                <span>Pos</span>
                <span className="chrome-slider-value">{stop.position.toFixed(2)}</span>
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={stop.position}
                onChange={(event) =>
                  updateStop(stop.id, { position: Number(event.target.value) })
                }
              />
            </label>
            <div className="gradient-stop-actions">
              <button
                type="button"
                className="chrome-reset"
                disabled={index === 0}
                onClick={() => moveStop(stop.id, -1)}
                aria-label="Move stop earlier"
                title="Move earlier"
              >
                ↑
              </button>
              <button
                type="button"
                className="chrome-reset"
                disabled={index === sorted.length - 1}
                onClick={() => moveStop(stop.id, 1)}
                aria-label="Move stop later"
                title="Move later"
              >
                ↓
              </button>
              <button
                type="button"
                className="chrome-reset"
                disabled={stops.length <= 2}
                onClick={() => removeStop(stop.id)}
                aria-label="Remove stop"
                title="Remove"
              >
                ×
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="gradient-editor-actions">
        <button type="button" className="chrome-reset" onClick={addStop}>
          Add stop
        </button>
        <button
          type="button"
          className="chrome-reset"
          onClick={() => onChange(defaultHeightGradient.map((s) => ({ ...s })))}
        >
          Reset
        </button>
      </div>
    </div>
  )
}

function normalizeHex(color: string): string {
  const raw = color.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const r = raw[1]
    const g = raw[2]
    const b = raw[3]
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  return '#808080'
}
