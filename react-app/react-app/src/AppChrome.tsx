function Slider({
  label,
  display,
  defaultValue,
}: {
  label: string
  display: string
  defaultValue: number
}) {
  return (
    <label className="chrome-slider is-disabled">
      <span className="chrome-slider-row">
        <span>{label}</span>
        <span className="chrome-slider-value">{display}</span>
      </span>
      <input type="range" min="0" max="1" step="0.01" defaultValue={defaultValue} disabled />
    </label>
  )
}

export default function AppChrome() {
  return (
    <div className="chrome">
      <header className="chrome-title">
        <p className="chrome-kicker">DESIGN 6197</p>
        <h1>Procedural World Building</h1>
      </header>

      <aside className="chrome-panel" aria-label="Parameters">
        <div className="chrome-panel-header">
          <h2>Parameters</h2>
        </div>

        <section className="chrome-group">
          <h3>Cube</h3>
          <Slider label="Size" display="—" defaultValue={0.5} />
          <Slider label="Resolution" display="—" defaultValue={0.5} />
        </section>
      </aside>
    </div>
  )
}
