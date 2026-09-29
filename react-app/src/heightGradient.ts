export type GradientStop = {
  id: string
  /** Relative height along the voxel column, 0 = lowest, 1 = highest. */
  position: number
  /** CSS hex color, e.g. `#1238c8`. */
  color: string
}

/** Default Interactive gradient: deep blue (low) → red (high). */
export const defaultHeightGradient: GradientStop[] = [
  { id: 'stop-low', position: 0, color: '#1238c8' },
  { id: 'stop-high', position: 1, color: '#ff1a1a' },
]

function clamp01(value: number) {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

export function sortStops(stops: GradientStop[]): GradientStop[] {
  return [...stops].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
}

export function parseHexColor(hex: string): [number, number, number] {
  const raw = hex.trim().replace('#', '')
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return [128, 128, 128]
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ]
}

/** Smooth RGB lerp across stops. `t` is relative height in [0, 1]. */
export function sampleHeightGradient(
  stops: GradientStop[],
  t: number,
): [number, number, number] {
  const sorted = sortStops(stops.length > 0 ? stops : defaultHeightGradient)
  const u = clamp01(t)

  if (sorted.length === 1) {
    return parseHexColor(sorted[0]!.color)
  }

  if (u <= sorted[0]!.position) return parseHexColor(sorted[0]!.color)
  const last = sorted[sorted.length - 1]!
  if (u >= last.position) return parseHexColor(last.color)

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!
    const b = sorted[i + 1]!
    if (u < a.position || u > b.position) continue
    const span = b.position - a.position
    const f = span <= 1e-6 ? 0 : (u - a.position) / span
    const [ar, ag, ab] = parseHexColor(a.color)
    const [br, bg, bb] = parseHexColor(b.color)
    return [
      Math.round(ar + (br - ar) * f),
      Math.round(ag + (bg - ag) * f),
      Math.round(ab + (bb - ab) * f),
    ]
  }

  return parseHexColor(last.color)
}

/** CSS `linear-gradient` for the live preview strip (left = 0, right = 1). */
export function gradientCss(stops: GradientStop[]): string {
  const sorted = sortStops(stops.length > 0 ? stops : defaultHeightGradient)
  if (sorted.length === 1) {
    const c = sorted[0]!.color
    return `linear-gradient(to right, ${c}, ${c})`
  }
  const parts = sorted.map((s) => `${s.color} ${(clamp01(s.position) * 100).toFixed(1)}%`)
  return `linear-gradient(to right, ${parts.join(', ')})`
}

export function newStopId() {
  return `stop-${Math.random().toString(36).slice(2, 9)}`
}
