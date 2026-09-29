const LOW = { r: 18, g: 56, b: 200 }
const HIGH = { r: 255, g: 26, b: 26 }

export function heightToRgb(value: number): [number, number, number] {
  const t = value < 0 ? 0 : value > 1 ? 1 : value
  return [
    Math.round(LOW.r + (HIGH.r - LOW.r) * t),
    Math.round(LOW.g + (HIGH.g - LOW.g) * t),
    Math.round(LOW.b + (HIGH.b - LOW.b) * t),
  ]
}

/** Deep blue → cyan → green → yellow → red (Interactive voxel faces). */
const SPECTRUM: [number, number, number][] = [
  [18, 56, 200],
  [0, 180, 220],
  [40, 200, 80],
  [240, 200, 40],
  [255, 26, 26],
]

export function heightToSpectrumRgb(value: number): [number, number, number] {
  const t = value < 0 ? 0 : value > 1 ? 1 : value
  const scaled = t * (SPECTRUM.length - 1)
  const i = Math.floor(scaled)
  const f = scaled - i
  const a = SPECTRUM[i] ?? SPECTRUM[0]!
  const b = SPECTRUM[Math.min(i + 1, SPECTRUM.length - 1)] ?? a
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ]
}
