declare module 'fastnoise-lite' {
  export default class FastNoiseLite {
    static NoiseType: {
      OpenSimplex2: string
      OpenSimplex2S: string
      Cellular: string
      Perlin: string
      ValueCubic: string
      Value: string
    }
    static FractalType: {
      None: string
      FBm: string
      Ridged: string
      PingPong: string
    }
    static CellularReturnType: {
      CellValue: string
      Distance: string
      Distance2: string
      Distance2Add: string
      Distance2Sub: string
      Distance2Mul: string
      Distance2Div: string
    }
    static CellularDistanceFunction: {
      Euclidean: string
      EuclideanSq: string
      Manhattan: string
      Hybrid: string
    }
    constructor(seed?: number)
    SetSeed(seed: number): void
    SetNoiseType(type: string): void
    SetFrequency(frequency: number): void
    SetFractalType(type: string): void
    SetFractalOctaves(octaves: number): void
    SetFractalLacunarity(lacunarity: number): void
    SetFractalGain(gain: number): void
    SetFractalPingPongStrength(strength: number): void
    SetCellularJitter(jitter: number): void
    SetCellularReturnType(type: string): void
    SetCellularDistanceFunction(type: string): void
    GetNoise(x: number, y: number, z?: number): number
  }
}
