import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { drawHeightmap, erodeMap } from './erosion.ts'
import type { ErosionParams } from './erosion.ts'

type HeightMapViewProps = {
  mapRef: RefObject<Float32Array | null>
  size: number
  running: boolean
  simulate?: boolean
  erosion: ErosionParams
  revision: number
  className?: string
}

export default function HeightMapView({
  mapRef,
  size,
  running,
  simulate = false,
  erosion,
  revision,
  className,
}: HeightMapViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const erosionRef = useRef(erosion)
  erosionRef.current = erosion

  useEffect(() => {
    const canvas = canvasRef.current
    const map = mapRef.current
    if (!canvas || !map) {
      return
    }
    const context = canvas.getContext('2d')
    if (!context) {
      return
    }
    drawHeightmap(context, map, size)
  }, [mapRef, revision, size])

  useEffect(() => {
    if (!running) {
      return
    }

    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    let frame = 0
    const tick = () => {
      const map = mapRef.current
      if (map) {
        if (simulate) {
          erodeMap(map, size, erosionRef.current)
        }
        drawHeightmap(context, map, size)
      }
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [mapRef, running, simulate, size])

  return <canvas ref={canvasRef} className={className} width={size} height={size} />
}
