import { useState, type CSSProperties } from 'react'
import type { BlobParams } from './blobParams.ts'

type SliderProps = {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  onChange: (value: number) => void
}

function Slider({ label, value, min, max, step, display, onChange }: SliderProps) {
  const [active, setActive] = useState(false)
  const fill = ((value - min) / (max - min)) * 100

  return (
    <label className={active ? 'chrome-slider is-active' : 'chrome-slider'}>
      <span className="chrome-slider-row">
        <span>{label}</span>
        <span className="chrome-slider-value">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--fill': `${fill}%` } as CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
        onPointerDown={() => setActive(true)}
        onPointerUp={() => setActive(false)}
        onPointerCancel={() => setActive(false)}
        onBlur={() => setActive(false)}
      />
    </label>
  )
}

type AppChromeProps = {
  params: BlobParams
  onChange: (patch: Partial<BlobParams>) => void
  onReset: () => void
}

export default function AppChrome({ params, onChange, onReset }: AppChromeProps) {
  return (
    <div className="chrome">
      <header className="chrome-title">
        <p className="chrome-kicker">DESIGN 6197</p>
        <h1>Procedural World Building</h1>
      </header>

      <aside className="chrome-panel" aria-label="Parameters">
        <div className="chrome-panel-header">
          <h2>Parameters</h2>
          <button type="button" className="chrome-reset" onClick={onReset}>
            Reset
          </button>
        </div>

        <section className="chrome-group">
          <h3>Shape</h3>
          <Slider
            label="Size"
            value={params.size}
            min={0.2}
            max={2.5}
            step={0.01}
            display={params.size.toFixed(2)}
            onChange={(size) => onChange({ size })}
          />
          <Slider
            label="Rotation"
            value={params.rotation}
            min={0}
            max={360}
            step={1}
            display={`${Math.round(params.rotation)}°`}
            onChange={(rotation) => onChange({ rotation })}
          />
          <Slider
            label="Blobiness"
            value={params.blobiness}
            min={0}
            max={0.7}
            step={0.01}
            display={params.blobiness.toFixed(2)}
            onChange={(blobiness) => onChange({ blobiness })}
          />
          <Slider
            label="Frequency"
            value={params.frequency}
            min={0.4}
            max={8}
            step={0.1}
            display={params.frequency.toFixed(1)}
            onChange={(frequency) => onChange({ frequency })}
          />
        </section>

        <section className="chrome-group">
          <h3>Surface</h3>
          <Slider
            label="Metalness"
            value={params.metalness}
            min={0}
            max={1}
            step={0.01}
            display={params.metalness.toFixed(2)}
            onChange={(metalness) => onChange({ metalness })}
          />
          <Slider
            label="Roughness"
            value={params.roughness}
            min={0}
            max={1}
            step={0.01}
            display={params.roughness.toFixed(2)}
            onChange={(roughness) => onChange({ roughness })}
          />
        </section>
      </aside>
    </div>
  )
}
