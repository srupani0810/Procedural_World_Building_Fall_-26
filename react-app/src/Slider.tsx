import { useState, type CSSProperties } from 'react'

type SliderProps = {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  onChange: (value: number) => void
}

export function Slider({ label, value, min, max, step, display, onChange }: SliderProps) {
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
