import FastNoiseLite from 'fastnoise-lite'

export type ViewMode = '3d' | '2d' | 'voxels' | 'shaders' | 'ep'
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
  { id: 'simplex', label: 'Simplex', extraLabel: 'Lacunarity', min: 1, max: 8, step: 0.05, fallback: 2 },
  { id: 'simplexS', label: 'Simplex S', extraLabel: 'Gain', min: 0.05, max: 1.5, step: 0.01, fallback: 0.5 },
  { id: 'perlin', label: 'Perlin', extraLabel: 'Lacunarity', min: 1, max: 8, step: 0.05, fallback: 2 },
  { id: 'ridged', label: 'Ridged', extraLabel: 'Gain', min: 0.05, max: 1.5, step: 0.01, fallback: 0.5 },
  { id: 'cellular', label: 'Cellular', extraLabel: 'Jitter', min: 0, max: 1.5, step: 0.01, fallback: 1 },
  { id: 'value', label: 'Value', extraLabel: 'Gain', min: 0.05, max: 1.5, step: 0.01, fallback: 0.5 },
  { id: 'pingpong', label: 'Ping Pong', extraLabel: 'Strength', min: 0.25, max: 6, step: 0.05, fallback: 2 },
]

export type TerrainParams = {
  /** FastNoiseLite frequency — higher = more zoomed-in / finer pattern. */
  frequency: number
  /** Scales noise into terrain height (displacement / density heightfield). */
  amplitude: number
  /** Fractal octave count (detail layers). */
  octaves: number
  /** Fractal gain / persistence — how much each successive octave contributes. */
  persistence: number
  detail: number
  noiseId: NoiseId
  extras: Record<NoiseId, number>
  /**
   * @deprecated Prefer `frequency`. Kept in sync for older call sites during transition.
   * Maps as frequency / 0.12 (legacy Zoom slider scale).
   */
  zoom: number
  /** @deprecated Prefer `amplitude`. Alias of amplitude. */
  height: number
  /** @deprecated Prefer `octaves`. Alias of octaves. */
  layers: number
}

export const defaultTerrainParams: TerrainParams = {
  frequency: 0.36,
  amplitude: 0.55,
  octaves: 4,
  persistence: 0.5,
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
  // Legacy mirrors (same values as frequency/amplitude/octaves encoding)
  zoom: 3,
  height: 0.55,
  layers: 4,
}

/** Keep legacy zoom/height/layers mirrors consistent when modern fields change (and vice versa). */
export function normalizeTerrainPatch(patch: Partial<TerrainParams>): Partial<TerrainParams> {
  const next: Partial<TerrainParams> = { ...patch }
  if (patch.frequency != null && patch.zoom == null) {
    next.zoom = patch.frequency / 0.12
  }
  if (patch.zoom != null && patch.frequency == null) {
    next.frequency = patch.zoom * 0.12
  }
  if (patch.amplitude != null && patch.height == null) {
    next.height = patch.amplitude
  }
  if (patch.height != null && patch.amplitude == null) {
    next.amplitude = patch.height
  }
  if (patch.octaves != null && patch.layers == null) {
    next.layers = patch.octaves
  }
  if (patch.layers != null && patch.octaves == null) {
    next.octaves = patch.layers
  }
  return next
}

export function getNoiseOption(id: NoiseId): NoiseOption {
  const option = NOISE_OPTIONS.find((item) => item.id === id)
  return option ?? NOISE_OPTIONS[0]
}

function configureNoise(noise: FastNoiseLite, params: TerrainParams) {
  const extra = params.extras[params.noiseId]
  const frequency = params.frequency > 0 ? params.frequency : params.zoom * 0.12
  const octaves = Math.max(1, Math.round(params.octaves ?? params.layers))
  const persistence = params.persistence ?? 0.5

  noise.SetFrequency(frequency)
  noise.SetFractalOctaves(octaves)
  noise.SetFractalType(octaves === 1 ? FastNoiseLite.FractalType.None : FastNoiseLite.FractalType.FBm)
  // Base FBm persistence; type-specific Gain extras may override below
  noise.SetFractalGain(persistence)

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
}

export function createNoise(params: TerrainParams) {
  const noise = new FastNoiseLite(1337)
  configureNoise(noise, params)
  return (x: number, y: number) => noise.GetNoise(x, y)
}

/** Same noise settings as `createNoise`, but samples in 3D (x, y, z). */
export function createNoise3D(params: TerrainParams) {
  const noise = new FastNoiseLite(1337)
  configureNoise(noise, params)
  return (x: number, y: number, z: number) => noise.GetNoise(x, y, z)
}

/** Terrain height scale used by 3D mesh, voxels, and first-person. */
export function terrainAmplitude(params: TerrainParams) {
  return Math.max(params.amplitude ?? params.height, 0.01)
}
