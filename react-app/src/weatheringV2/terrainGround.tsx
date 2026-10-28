/**
 * Copied from Weathering StreamedNoiseGround / buildFollowGroundGeometry.
 * Noise heightfield ground only — no SoftWater, StreamWater, fog, or water mask.
 */
import { type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BufferGeometry,
  Float32BufferAttribute,
  PlaneGeometry,
  type Mesh,
} from 'three'
import { createNoise, terrainAmplitude } from '../terrainParams.ts'
import type { TerrainParams } from '../terrainParams.ts'
import { createV2GroundMaterial } from './groundMaterial.ts'

const TAP_MAX_MS = 220
const DRAG_CANCEL_PX = 6
/** World size of the overview heightfield — matches Weathering. */
const OVERVIEW_GROUND_SIZE = 520

function buildFollowGroundGeometry(
  ox: number,
  oz: number,
  size: number,
  sample: (x: number, z: number) => number,
  heightScale: number,
  segments: number,
): BufferGeometry {
  const geo = new PlaneGeometry(size, size, segments, segments)
  const positions = geo.attributes.position
  const colors = new Float32Array(positions.count * 3)

  for (let i = 0; i < positions.count; i++) {
    const lx = positions.getX(i)
    const ly = positions.getY(i)
    const wx = ox + lx
    const wz = oz - ly
    const n = sample(wx, wz)
    positions.setZ(i, n * heightScale + 0.25)

    const t = (n + 1) * 0.5
    const shade = 0.38 + t * 0.52
    colors[i * 3] = shade
    colors[i * 3 + 1] = shade + 0.03
    colors[i * 3 + 2] = shade + 0.06
  }

  positions.needsUpdate = true
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  geo.computeBoundingBox()
  geo.computeBoundingSphere()
  return geo
}

/**
 * Continuous noise heightfield anchored at the origin for orbit
 * (same overview path as Weathering without Jump In remeshing).
 */
export function V2NoiseGround({
  terrain,
  editEnabled,
  onTapPlace,
}: {
  terrain: TerrainParams
  editEnabled: boolean
  onTapPlace: (wx: number, wy: number, wz: number) => void
}) {
  const meshRef = useRef<Mesh>(null)
  const geoRef = useRef<BufferGeometry | null>(null)
  const groundRef = useRef<{ geometry: BufferGeometry; ox: number; oz: number } | null>(null)
  const [ground, setGround] = useState<{
    geometry: BufferGeometry
    ox: number
    oz: number
  } | null>(null)
  const groundMat = useMemo(() => createV2GroundMaterial(), [])
  useEffect(() => () => groundMat.dispose(), [groundMat])

  const sample = useMemo(() => createNoise(terrain), [terrain])
  const heightScale = terrainAmplitude(terrain)
  const segments = Math.max(48, Math.round(terrain.detail * 1.25))
  const genKey = `${terrain.noiseId}|${terrain.frequency}|${terrain.amplitude}|${terrain.octaves}|${terrain.persistence}|${segments}|${heightScale}|${JSON.stringify(terrain.extras)}`

  const remesh = (ox: number, oz: number) => {
    const size = OVERVIEW_GROUND_SIZE
    const segs = Math.max(48, Math.round(size / 2.7))
    const next = buildFollowGroundGeometry(ox, oz, size, sample, heightScale, segs)
    geoRef.current?.dispose()
    geoRef.current = next
    const payload = { geometry: next, ox, oz }
    groundRef.current = payload
    setGround(payload)
  }

  useEffect(() => {
    remesh(0, 0)
    return () => {
      geoRef.current?.dispose()
      geoRef.current = null
      groundRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remesh on terrain genKey
  }, [genKey, sample, heightScale, segments])

  const pointerRef = useRef<{
    startedAt: number
    pointerId: number
    startX: number
    startY: number
    point: { x: number; y: number; z: number } | null
    dragged: boolean
  } | null>(null)

  useEffect(() => {
    if (!editEnabled) return
    const onMove = (event: PointerEvent) => {
      const h = pointerRef.current
      if (!h || h.dragged || event.pointerId !== h.pointerId) return
      const dx = event.clientX - h.startX
      const dy = event.clientY - h.startY
      if (dx * dx + dy * dy >= DRAG_CANCEL_PX * DRAG_CANCEL_PX) h.dragged = true
    }
    const onUp = (event: PointerEvent) => {
      const h = pointerRef.current
      if (!h || event.pointerId !== h.pointerId) return
      const elapsed = performance.now() - h.startedAt
      if (!h.dragged && elapsed < TAP_MAX_MS && h.point) {
        onTapPlace(h.point.x, h.point.y, h.point.z)
      }
      pointerRef.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [editEnabled, onTapPlace])

  const onPointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (!editEnabled || event.nativeEvent.button !== 0) return
    if (document.pointerLockElement) return
    pointerRef.current = {
      startedAt: performance.now(),
      pointerId: event.nativeEvent.pointerId,
      startX: event.nativeEvent.clientX,
      startY: event.nativeEvent.clientY,
      point: { x: event.point.x, y: event.point.y, z: event.point.z },
      dragged: false,
    }
  }

  if (!ground) return null

  return (
    <mesh
      ref={meshRef}
      geometry={ground.geometry}
      position={[ground.ox, 0, ground.oz]}
      rotation={[-Math.PI / 2, 0, 0]}
      frustumCulled={false}
      onPointerDown={editEnabled ? onPointerDown : undefined}
      material={groundMat}
    />
  )
}

/** Same height sample as the mesh: noise * amplitude + 0.25. */
export function useV2HeightAt(terrain: TerrainParams) {
  const sample = useMemo(() => createNoise(terrain), [terrain])
  const heightScale = terrainAmplitude(terrain)
  return useMemo(
    () => (x: number, z: number) => sample(x, z) * heightScale + 0.25,
    [sample, heightScale],
  )
}
