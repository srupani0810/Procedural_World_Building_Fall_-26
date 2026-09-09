import { createNoise } from './terrainParams.ts'
import type { TerrainParams } from './terrainParams.ts'

export const HEIGHTMAP_SIZE = 256

export type ErosionParams = {
  droplets: number
  lifetime: number
  inertia: number
  capacity: number
  erosion: number
  deposition: number
  evaporation: number
  gravity: number
  minSlope: number
  radius: number
}

export const defaultErosionParams: ErosionParams = {
  droplets: 48,
  lifetime: 32,
  inertia: 0.08,
  capacity: 4,
  erosion: 0.35,
  deposition: 0.25,
  evaporation: 0.02,
  gravity: 4,
  minSlope: 0.01,
  radius: 3,
}

export function createHeightmap(params: TerrainParams, size: number): Float32Array {
  const sample = createNoise(params)
  const map = new Float32Array(size * size)
  const extent = 2

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x / (size - 1) - 0.5) * extent * 2
      const ny = (y / (size - 1) - 0.5) * extent * 2
      map[y * size + x] = (sample(nx, ny) + 1) * 0.5
    }
  }

  return map
}

function sampleHeight(map: Float32Array, size: number, x: number, y: number): number | null {
  if (x < 0 || y < 0 || x >= size - 1 || y >= size - 1) {
    return null
  }

  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const tx = x - x0
  const ty = y - y0
  const i = y0 * size + x0
  const h00 = map[i]
  const h10 = map[i + 1]
  const h01 = map[i + size]
  const h11 = map[i + size + 1]

  return h00 * (1 - tx) * (1 - ty) + h10 * tx * (1 - ty) + h01 * (1 - tx) * ty + h11 * tx * ty
}

function sampleGradient(map: Float32Array, size: number, x: number, y: number) {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  if (x0 < 0 || y0 < 0 || x0 >= size - 1 || y0 >= size - 1) {
    return { x: 0, y: 0 }
  }

  const tx = x - x0
  const ty = y - y0
  const i = y0 * size + x0
  const h00 = map[i]
  const h10 = map[i + 1]
  const h01 = map[i + size]
  const h11 = map[i + size + 1]

  return {
    x: (h10 - h00) * (1 - ty) + (h11 - h01) * ty,
    y: (h01 - h00) * (1 - tx) + (h11 - h10) * tx,
  }
}

function applyBrush(map: Float32Array, size: number, x: number, y: number, amount: number, radius: number) {
  const r = Math.max(1, Math.round(radius))
  const cx = Math.floor(x)
  const cy = Math.floor(y)
  let weightSum = 0
  const cells: { index: number; weight: number }[] = []

  for (let j = -r; j <= r; j++) {
    for (let i = -r; i <= r; i++) {
      const px = cx + i
      const py = cy + j
      if (px < 0 || py < 0 || px >= size || py >= size) {
        continue
      }
      const dist = Math.hypot(i, j)
      if (dist > r) {
        continue
      }
      const weight = r - dist
      cells.push({ index: py * size + px, weight })
      weightSum += weight
    }
  }

  if (weightSum === 0) {
    return
  }

  for (const cell of cells) {
    const next = map[cell.index] + amount * (cell.weight / weightSum)
    map[cell.index] = next < 0 ? 0 : next > 1 ? 1 : next
  }
}

export function erodeMap(map: Float32Array, size: number, params: ErosionParams) {
  const droplets = Math.max(1, Math.round(params.droplets))
  const lifetime = Math.max(1, Math.round(params.lifetime))

  for (let n = 0; n < droplets; n++) {
    let px = Math.random() * (size - 1)
    let py = Math.random() * (size - 1)
    let dx = 0
    let dy = 0
    let speed = 1
    let water = 1
    let sediment = 0

    for (let step = 0; step < lifetime; step++) {
      const height = sampleHeight(map, size, px, py)
      if (height === null) {
        break
      }

      const gradient = sampleGradient(map, size, px, py)
      dx = dx * params.inertia - gradient.x * (1 - params.inertia)
      dy = dy * params.inertia - gradient.y * (1 - params.inertia)
      const length = Math.hypot(dx, dy)

      if (length < 1e-6) {
        break
      }

      dx /= length
      dy /= length

      const nx = px + dx
      const ny = py + dy
      const nextHeight = sampleHeight(map, size, nx, ny)
      if (nextHeight === null) {
        applyBrush(map, size, px, py, sediment, params.radius)
        break
      }

      const delta = nextHeight - height
      const capacity = Math.max(-delta * speed * water * params.capacity, params.minSlope)

      if (delta > 0 || sediment > capacity) {
        const deposited =
          delta > 0 ? Math.min(sediment, delta) : (sediment - capacity) * params.deposition
        sediment -= deposited
        applyBrush(map, size, px, py, deposited, params.radius)
      } else {
        const eroded = Math.min((capacity - sediment) * params.erosion, -delta)
        applyBrush(map, size, px, py, -eroded, params.radius)
        sediment += eroded
      }

      speed = Math.sqrt(Math.max(0, speed * speed + -delta * params.gravity))
      water *= 1 - params.evaporation
      px = nx
      py = ny

      if (water < 0.01) {
        applyBrush(map, size, px, py, sediment, params.radius)
        break
      }
    }
  }
}

export function drawHeightmap(
  context: CanvasRenderingContext2D,
  map: Float32Array,
  size: number,
) {
  const image = context.createImageData(size, size)
  const { data } = image

  for (let i = 0; i < map.length; i++) {
    const tone = Math.round(Math.min(1, Math.max(0, map[i] ?? 0)) * 255)
    const index = i * 4
    data[index] = tone
    data[index + 1] = tone
    data[index + 2] = tone
    data[index + 3] = 255
  }

  context.putImageData(image, 0, 0)
}
