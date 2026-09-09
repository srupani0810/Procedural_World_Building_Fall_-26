import FastNoiseLite from 'fastnoise-lite'

export type ViewMode = '3d' | '2d'
export type TwoDTab = 'field' | 'sim'

export type NoiseId =
  | 'simplex'
  | 'simplexS'
  | 'perlin'
  | 'ridged'
  | 'cellular'
  | 'value'
  | 'pingpong'

export type NoiseOption = {
  id: NoiseId
  label: string
  extraLabel: string
  min: number
  max: number
  step: number
  fallback: number
}

export const NOISE_OPTIONS: NoiseOption[] = [
  { id: 'simplex', label: 'Simplex', extraLabel: 'Lacunarity', min: 1, max: 4, step: 0.05, fallback: 2 },
  { id: 'simplexS', label: 'Simplex S', extraLabel: 'Gain', min: 0.1, max: 1, step: 0.01, fallback: 0.5 },
  { id: 'perlin', label: 'Perlin', extraLabel: 'Lacunarity', min: 1, max: 4, step: 0.05, fallback: 2 },
  { id: 'ridged', label: 'Ridged', extraLabel: 'Gain', min: 0.1, max: 1, step: 0.01, fallback: 0.5 },
  { id: 'cellular', label: 'Cellular', extraLabel: 'Jitter', min: 0, max: 1, step: 0.01, fallback: 1 },
  { id: 'value', label: 'Value', extraLabel: 'Gain', min: 0.1, max: 1, step: 0.01, fallback: 0.5 },
  { id: 'pingpong', label: 'Ping Pong', extraLabel: 'Strength', min: 0.5, max: 3, step: 0.05, fallback: 2 },
]

export type TerrainParams = {
  zoom: number
  height: number
  layers: number
  detail: number
  noiseId: NoiseId
  extras: Record<NoiseId, number>
}

export const defaultTerrainParams: TerrainParams = {
  zoom: 3,
  height: 0.55,
  layers: 4,
  detail: 48,
  noiseId: 'simplex',
  extras: {
    simplex: 2,
    simplexS: 0.5,
    perlin: 2,
    ridged: 0.5,
    cellular: 1,
    value: 0.5,
    pingpong: 2,
  },
}

export function getNoiseOption(id: NoiseId): NoiseOption {
  const option = NOISE_OPTIONS.find((item) => item.id === id)
  return option ?? NOISE_OPTIONS[0]
}

export function createNoise(params: TerrainParams) {
  const noise = new FastNoiseLite(1337)
  const extra = params.extras[params.noiseId]
  const octaves = Math.max(1, Math.round(params.layers))

  noise.SetFrequency(params.zoom * 0.12)
  noise.SetFractalOctaves(octaves)
  noise.SetFractalType(octaves === 1 ? FastNoiseLite.FractalType.None : FastNoiseLite.FractalType.FBm)

  switch (params.noiseId) {
    case 'simplex':
      noise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2)
      noise.SetFractalLacunarity(extra)
      break
    case 'simplexS':
      noise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2S)
      noise.SetFractalGain(extra)
      break
    case 'perlin':
      noise.SetNoiseType(FastNoiseLite.NoiseType.Perlin)
      noise.SetFractalLacunarity(extra)
      break
    case 'ridged':
      noise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2)
      noise.SetFractalType(FastNoiseLite.FractalType.Ridged)
      noise.SetFractalGain(extra)
      break
    case 'cellular':
      noise.SetNoiseType(FastNoiseLite.NoiseType.Cellular)
      noise.SetCellularJitter(extra)
      break
    case 'value':
      noise.SetNoiseType(FastNoiseLite.NoiseType.Value)
      noise.SetFractalGain(extra)
      break
    case 'pingpong':
      noise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2)
      noise.SetFractalType(FastNoiseLite.FractalType.PingPong)
      noise.SetFractalPingPongStrength(extra)
      break
  }

  return (x: number, y: number) => noise.GetNoise(x, y)
}
