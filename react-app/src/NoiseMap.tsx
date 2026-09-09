import { useEffect, useRef } from 'react'
import { createNoise } from './terrainParams.ts'
import type { TerrainParams } from './terrainParams.ts'

type NoiseMapProps = {
  params: TerrainParams
  resolution: number
  className?: string
}

export default function NoiseMap({ params, resolution, className }: NoiseMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    const sample = createNoise(params)
    const image = context.createImageData(resolution, resolution)
    const { data } = image
    const extent = 2

    for (let y = 0; y < resolution; y++) {
      for (let x = 0; x < resolution; x++) {
        const nx = (x / (resolution - 1) - 0.5) * extent * 2
        const ny = (y / (resolution - 1) - 0.5) * extent * 2
        const value = (sample(nx, ny) + 1) * 0.5
        const tone = Math.round(Math.min(1, Math.max(0, value)) * 255)
        const index = (y * resolution + x) * 4
        data[index] = tone
        data[index + 1] = tone
        data[index + 2] = tone
        data[index + 3] = 255
      }
    }

    context.putImageData(image, 0, 0)
  }, [params, resolution])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      width={resolution}
      height={resolution}
    />
  )
}
