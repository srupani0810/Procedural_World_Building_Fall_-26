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
