# Style Guide

Graphic spec for the Procedural World Building app. UI should feel like a **node-based studio tool** (TouchDesigner, Max/MSP): dense, dark, small type, one accent, no consumer “app chrome.”

The 3D viewport is the product. Overlay UI is instrumentation.

---

## Intent

| Do | Don’t |
|---|---|
| Instrument panel over a live viewport | Marketing hero, big display type |
| Tight labels, numbers always visible | Paragraphs of helper copy |
| Flat, opaque, 1px ruled surfaces | Glass, blur, drop shadows, large radius |
| One highlight for live / selected / filled | Multi-color palettes, gradients, logos as decoration |
| Monospace, tracked-out section labels | Rounded sans, playful weights |

References to steal from, not copy: TouchDesigner’s operator viewer + parameter pane; Max’s object inspector and number box; broadcast scopes; CNC / DAW mixer strips.

---

## Color

**One highlight.** Everything else is near-neutral charcoal. No second accent (no blue, purple, or green).

| Token | Hex | Use |
|---|---|---|
| `--void` | `#0A0A0A` | Full-screen 3D background, page |
| `--panel` | `#141414` | Parameter pane, title bar |
| `--inset` | `#1C1C1C` | Slider tracks, number fields, nested rows |
| `--rule` | `#2E2E2E` | 1px borders, group dividers |
| `--text` | `#C4C4C4` | Labels, titles |
| `--text-dim` | `#7A7A7A` | Secondary labels, units, hints |
| `--text-mute` | `#525252` | Disabled, placeholders |
| `--highlight` | `#FF7A00` | **The only chroma:** slider fill, focus, active, numeric emphasis |
| `--highlight-dim` | `#FF7A0040` | Hover wash, selected row, thin glow (optional, keep faint) |

Viewport mesh may use a **desaturated** version of the highlight or a neutral gray-blue metal. Do not introduce a second UI color to “match” the blob.

Hover: lighten `--text` toward `#E8E8E8`, or put `--highlight` on the control only.

Disabled: `--text-mute`, track stays `--inset`, no orange fill.

---

## Type

**Family:** IBM Plex Mono first, then `ui-monospace`, `SFMono-Regular`, `Menlo`, monospace.

**Weight:** Regular (400) only. Medium (500) only for pane headers if regular is too weak. Never bold display.

| Role | Size | Tracking | Color | Transform |
|---|---|---|---|---|
| App kicker (`DESIGN 6197`) | 9px | `0.22em` | `--text-dim` | Uppercase |
| App title | 12px | `0.08em` | `--text` | Uppercase |
| Pane header (`Parameters`) | 10px | `0.18em` | `--text-dim` | Uppercase |
| Group header (`Shape`) | 9px | `0.16em` | `--text-mute` | Uppercase |
| Control label | 10px | `0.04em` | `--text` | None (or uppercase if very short) |
| Numeric value | 10px | `0` | `--highlight` when editing, else `--text-dim` | Tabular nums |
| Hint / footer | 9px | `0.02em` | `--text-mute` | None |
| Button | 9px | `0.14em` | `--text` | Uppercase |

Line-height: `1.2` for labels, `1.35` for the rare hint line.

**Hard cap:** nothing in the overlay larger than **12px**. The viewport carries scale, not the type.

---

## Layout

- **Grid:** 4px. Padding and gaps are 4, 8, 12 — not 14 or 16 unless stacked to 16 (4×4).
- **Pane width:** 240–280px. Left-docked, vertically centered or top-aligned 12px from the top edge. Not a floating “card.”
- **Pane padding:** 12px.
- **Title:** top-left or top-center, small; never a large centered headline. Prefer top-left, 12px from edges, so it reads as a window label (TD network name).
- **Z-order:** canvas full-bleed; chrome `pointer-events: none` except the pane and actual controls.
- **Max pane height:** `calc(100vh - 24px)` with a thin, non-accent scrollbar (`--inset` thumb, `--rule` track).

---

## Shape and surface

- **Radius:** `0` (preferred) or `2px` maximum. No pills.
- **Border:** `1px solid var(--rule)` on the pane. No shadow.
- **Fill:** opaque `--panel` at **92–100%**. No `backdrop-filter`.
- **Dividers:** 1px `--rule`, full width of the pane content box.
- **Depth:** inset fields use `--inset`, not inner shadows.

This is a rack panel, not a modal.

---

## Controls

### Slider (primary)

```
SIZE                         1.00
[████████░░░░░░░░░░░░░░░░]
```

- Label left, value right, same 10px row.
- Track height: **2px**. Thumb: **8×8px** square (or 6px circle if the platform fights squares).
- Unfilled track: `--inset`. Filled track: `--highlight`.
- Value uses `font-variant-numeric: tabular-nums`.
- Vertical rhythm: 8px between sliders, 12px above a new group.

### Button (Reset)

- Height 18–20px. Rectangular. `1px` `--rule` border, transparent fill.
- Hover: border `--highlight`, text `--text`.
- Active: fill `--highlight`, text `#0A0A0A`.
- No icons unless they are 10px technical glyphs (□ ▸ ×).

### Number (future)

- Max-style number box: `--inset` field, 10px mono, click-drag to scrub, `--highlight` outline on focus (`1px`, no 3px glow rings).

### Toggle (future)

- 10px label + 8px square. On = `--highlight` fill. Off = `--inset` + `--rule`.

---

## Viewport

- Clear color: `--void` (`#0A0A0A`).
- Lights stay functional (readable form), not neon.
- Grid / gizmos, if added: 1px `--rule`, axes may use **desaturated** RGB only if needed for orientation — they are not UI chrome and should stay quieter than `--highlight`.
- Selection in 3D (later): `--highlight` wire or rim, 1px.

---

## Motion

- **None** on the chrome (no fade-up, no panel slide).
- Slider response: immediate, 1:1 with the mesh.
- Orbit damping may stay (camera, not UI).
- If a value is “cooking” / computing later: pulse opacity of the numeric, or a 1px `--highlight` bar — not a spinner.

---

## CSS tokens (implement against these)

```css
:root {
  --void: #0a0a0a;
  --panel: #141414;
  --inset: #1c1c1c;
  --rule: #2e2e2e;
  --text: #c4c4c4;
  --text-dim: #7a7a7a;
  --text-mute: #525252;
  --highlight: #ff7a00;

  --font: 'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace;
  --fs-micro: 9px;
  --fs-ui: 10px;
  --fs-title: 12px;
  --space: 4px;
  --radius: 0px;
  --rule-w: 1px;
}
```

Load IBM Plex Mono (400) from a font source or self-host. Do not mix in a second family for headings.

---

## Copy voice

- Labels are **parameter names**, not sentences: `Size`, `Blobiness`, `Frequency`.
- Hints are optional and one line. Prefer no hint once the pane is learnable.
- Reset is `Reset`, not “Start over” or “Restore defaults.”
- Pane title: `Parameters` or `Blob` — a node name, not “Settings.”

---

## Current app vs this spec

The overlay and viewport should already follow this document: IBM Plex Mono, `--void` canvas, opaque square pane, `#FF7A00` sliders, 9–12px type. If a UI change drifts (blue accents, radius, blur, large titles), run the checklist below.

---

## Checklist before shipping a UI change

- [ ] No color besides neutrals + `#FF7A00`
- [ ] Overlay type ≤ 12px
- [ ] Monospace only
- [ ] Pane is opaque, square, 1px ruled
- [ ] Numbers visible without hovering
- [ ] Highlight used for active/value, not large fills or backgrounds
