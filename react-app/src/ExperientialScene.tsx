import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  FogExp2,
  LineBasicMaterial,
  MeshLambertMaterial,
  type Mesh,
  type ShaderMaterial,
} from 'three'
import { FirstPersonControls } from './FirstPersonControls.tsx'
import type { EpParams } from './epParams.ts'
import {
  EP_FOG_COLOR,
  EP_SCAFFOLD_DENSITY,
  EP_SKY_COLOR,
  EP_TOWN_GRADIENT,
  EP_WATER_COLOR,
} from './epParams.ts'
import type { GradientStop } from './heightGradient.ts'
import { createEpMaterial } from './shaderStudies.ts'
import { createNoise, terrainAmplitude, type TerrainParams } from './terrainParams.ts'
import { buildGreedyInteractiveMesh, hitToVoxelIndex } from './voxelGreedyMesh.ts'
import {
  buildVoxelChunk,
  chunkKey,
  chunksAround,
  createDensityFunction,
  gridIndex,
  isSolid,
  worldToChunk,
} from './voxelGrid.ts'
import type { ChunkCoord, VoxelGrid } from './voxelGrid.ts'
import type { VoxelParams } from './voxelParams.ts'

type Props = {
  terrain: TerrainParams
  voxel: VoxelParams
  gradient: GradientStop[]
  ep: EpParams
  firstPerson: boolean
  onExitFirstPerson: () => void
}

type ChunkEntry = {
  key: string
  coord: ChunkCoord
  grid: VoxelGrid
  geometry: BufferGeometry
}

const STREAM_INTERVAL_MS = 120
const HOLD_DELETE_MS = 400
const TAP_MAX_MS = 220
const DRAG_CANCEL_PX = 6
const EP_MESH_GRADIENT: GradientStop[] = EP_TOWN_GRADIENT.map((stop) => ({ ...stop }))

function disposeEntry(entry: ChunkEntry) {
  entry.geometry.dispose()
}

function hash2(ix: number, iz: number, salt: number) {
  const n = Math.sin(ix * 127.1 + iz * 311.7 + salt * 74.7) * 43758.5453
  return n - Math.floor(n)
}

function cellWorldCenter(grid: VoxelGrid, ix: number, iy: number, iz: number) {
  return [
    grid.origin[0] + (ix + 0.5) * grid.cellSize,
    grid.origin[1] + (iy + 0.5) * grid.cellSize,
    grid.origin[2] + (iz + 0.5) * grid.cellSize,
  ] as const
}

/** Interactive greedy mesh — blocky Townscaper masses on a Voxel Cloud density field. */
function buildEpChunk(
  terrain: TerrainParams,
  voxel: VoxelParams,
  gradient: GradientStop[],
  coord: ChunkCoord,
  densityAt: (x: number, y: number, z: number) => number,
): ChunkEntry {
  const grid = buildVoxelChunk(terrain, voxel, coord)
  const geometry = buildGreedyInteractiveMesh(
    grid,
    voxel.isolevel,
    gradient,
    densityAt,
  )
  return { key: chunkKey(coord), coord, grid, geometry }
}

function FogController({ density, color }: { density: number; color: string }) {
  const { scene } = useThree()
  useEffect(() => {
    const fog = new FogExp2(new Color(color), density)
    scene.fog = fog
    return () => {
      scene.fog = null
    }
  }, [scene, density, color])
  return null
}

function SoftWater() {
  const mat = useMemo(
    () =>
      new MeshLambertMaterial({
        color: EP_WATER_COLOR,
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
      }),
    [],
  )
  useEffect(() => () => mat.dispose(), [mat])
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.12, 0]}
      material={mat}
      raycast={() => null}
    >
      <planeGeometry args={[220, 220]} />
    </mesh>
  )
}

type HoldState = {
  center: readonly [number, number, number]
  cellSize: number
  startedAt: number
}

/** Townscaper-style tap-to-add / hold-to-delete on a streamed chunk mesh. */
function EpEditMesh({
  entry,
  material,
  voxel,
  enabled,
  onTapAdd,
  onHoldDelete,
}: {
  entry: ChunkEntry
  material: ShaderMaterial
  voxel: VoxelParams
  enabled: boolean
  onTapAdd: (key: string, ix: number, iy: number, iz: number) => void
  onHoldDelete: (key: string, ix: number, iy: number, iz: number) => void
}) {
  const holdRef = useRef<{
    solid: { ix: number; iy: number; iz: number }
    air: { ix: number; iy: number; iz: number } | null
    startedAt: number
    timer: number | null
    deleted: boolean
    dragged: boolean
    pointerId: number
    startX: number
    startY: number
  } | null>(null)
  const [holdVisual, setHoldVisual] = useState<HoldState | null>(null)
  const ghostRef = useRef<Mesh>(null)
  const entryRef = useRef(entry)
  const voxelRef = useRef(voxel)
  const onTapAddRef = useRef(onTapAdd)
  entryRef.current = entry
  voxelRef.current = voxel
  onTapAddRef.current = onTapAdd

  const clearHold = () => {
    const h = holdRef.current
    if (h?.timer != null) window.clearTimeout(h.timer)
    holdRef.current = null
    setHoldVisual(null)
  }

  useEffect(() => () => clearHold(), [])

  useEffect(() => {
    if (!enabled) return

    const onMove = (event: PointerEvent) => {
      const h = holdRef.current
      if (!h || h.deleted || h.dragged || event.pointerId !== h.pointerId) return
      const dx = event.clientX - h.startX
      const dy = event.clientY - h.startY
      if (dx * dx + dy * dy < DRAG_CANCEL_PX * DRAG_CANCEL_PX) return
      h.dragged = true
      if (h.timer != null) window.clearTimeout(h.timer)
      h.timer = null
      setHoldVisual(null)
    }

    const onUp = (event: PointerEvent) => {
      const h = holdRef.current
      if (!h || event.pointerId !== h.pointerId) return

      const elapsed = performance.now() - h.startedAt
      if (h.timer != null) window.clearTimeout(h.timer)

      const active = entryRef.current
      const activeVoxel = voxelRef.current
      if (!h.deleted && !h.dragged && elapsed < TAP_MAX_MS && h.air) {
        const dens = active.grid.densities
        const idx = gridIndex(h.air.ix, h.air.iy, h.air.iz, active.grid.size)
        if (!isSolid(dens[idx] ?? 0, activeVoxel.isolevel)) {
          onTapAddRef.current(active.key, h.air.ix, h.air.iy, h.air.iz)
        }
      }

      holdRef.current = null
      setHoldVisual(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [enabled])

  useFrame(() => {
    const h = holdRef.current
    const ghost = ghostRef.current
    if (!h || !ghost || h.deleted || h.dragged) return
    const t = Math.min(1, (performance.now() - h.startedAt) / HOLD_DELETE_MS)
    ghost.scale.setScalar(Math.max(0.2, 1 - t * 0.55))
    const mat = ghost.material as { opacity: number }
    mat.opacity = 0.75 * (1 - t * 0.85)
  })

  const onPointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (!enabled || !event.face || event.nativeEvent.button !== 0) return
    if (document.pointerLockElement) return

    const normal = event.face.normal
      .clone()
      .transformDirection(event.object.matrixWorld)
      .normalize()

    const solid = hitToVoxelIndex(event.point, normal, entry.grid, true)
    const air = hitToVoxelIndex(event.point, normal, entry.grid, false)
    if (!solid) return

    const startedAt = performance.now()
    setHoldVisual({
      center: cellWorldCenter(entry.grid, solid.ix, solid.iy, solid.iz),
      cellSize: entry.grid.cellSize,
      startedAt,
    })

    const timer = window.setTimeout(() => {
      const cur = holdRef.current
      if (!cur || cur.deleted || cur.dragged) return
      cur.deleted = true
      onHoldDelete(entry.key, cur.solid.ix, cur.solid.iy, cur.solid.iz)
      holdRef.current = null
      setHoldVisual(null)
    }, HOLD_DELETE_MS)

    holdRef.current = {
      solid,
      air,
      startedAt,
      timer,
      deleted: false,
      dragged: false,
      pointerId: event.nativeEvent.pointerId,
      startX: event.nativeEvent.clientX,
      startY: event.nativeEvent.clientY,
    }
  }

  return (
    <>
      <mesh
        geometry={entry.geometry}
        material={material}
        frustumCulled={false}
        onPointerDown={enabled ? onPointerDown : undefined}
      />
      {holdVisual ? (
        <mesh
          ref={ghostRef}
          position={[holdVisual.center[0], holdVisual.center[1], holdVisual.center[2]]}
          raycast={() => null}
        >
          <boxGeometry
            args={[
              holdVisual.cellSize * 0.95,
              holdVisual.cellSize * 0.95,
              holdVisual.cellSize * 0.95,
            ]}
          />
          <meshBasicMaterial
            color="#c8cdd4"
            transparent
            opacity={0.65}
            depthWrite={false}
            side={DoubleSide}
          />
        </mesh>
      ) : null}
    </>
  )
}

function TownCloudChunks({
  terrain,
  voxel,
  gradient,
  grain,
  editEnabled,
  onEntries,
}: {
  terrain: TerrainParams
  voxel: VoxelParams
  gradient: GradientStop[]
  grain: number
  editEnabled: boolean
  onEntries: (entries: ChunkEntry[]) => void
}) {
  const [entries, setEntries] = useState<ChunkEntry[]>([])
  const entriesRef = useRef<Map<string, ChunkEntry>>(new Map())
  const lastStreamAt = useRef(0)
  const lastCenterKey = useRef('')
  const materialRef = useRef<ShaderMaterial | null>(null)
  const gradientRef = useRef(gradient)
  gradientRef.current = gradient

  const densityAt = useMemo(
    () => createDensityFunction(terrain, voxel),
    [terrain, voxel],
  )

  const material = useMemo(() => {
    const mat = createEpMaterial({ grain })
    materialRef.current = mat
    return mat
  }, [])

  useEffect(() => {
    if (material.uniforms.uGrain) {
      material.uniforms.uGrain.value = grain
    }
  }, [material, grain])

  useEffect(() => {
    return () => {
      material.dispose()
    }
  }, [material])

  const genKey = `${terrain.noiseId}|${terrain.frequency}|${terrain.amplitude}|${terrain.octaves}|${terrain.persistence}|${voxel.resolution}|${voxel.isolevel}|${voxel.bleed}|${voxel.volume}|${voxel.loadRadius}|${gradient.map((s) => `${s.position}:${s.color}`).join(';')}`

  useEffect(() => {
    for (const entry of entriesRef.current.values()) disposeEntry(entry)
    entriesRef.current.clear()
    lastCenterKey.current = ''
    setEntries([])
    onEntries([])
  }, [genKey, onEntries])

  const editCell = (key: string, ix: number, iy: number, iz: number, mode: 'add' | 'remove') => {
    const prev = entriesRef.current.get(key)
    if (!prev) return
    const nextDens = prev.grid.densities.slice()
    const idx = gridIndex(ix, iy, iz, prev.grid.size)
    if (mode === 'add') {
      nextDens[idx] = Math.max(voxel.isolevel + 0.5, (nextDens[idx] ?? 0) + 1)
    } else {
      nextDens[idx] = Math.min(voxel.isolevel - 0.5, (nextDens[idx] ?? 0) - 1)
    }
    disposeEntry(prev)
    const grid: VoxelGrid = { ...prev.grid, densities: nextDens }
    const geometry = buildGreedyInteractiveMesh(
      grid,
      voxel.isolevel,
      gradientRef.current,
      densityAt,
    )
    const next: ChunkEntry = { ...prev, grid, geometry }
    entriesRef.current.set(key, next)
    const list = Array.from(entriesRef.current.values())
    setEntries(list)
    onEntries(list)
  }

  useFrame(({ camera, clock }) => {
    if (materialRef.current?.uniforms.uTime) {
      materialRef.current.uniforms.uTime.value = clock.elapsedTime
    }

    const now = performance.now()
    if (now - lastStreamAt.current < STREAM_INTERVAL_MS) return
    lastStreamAt.current = now

    const center = worldToChunk(camera.position.x, camera.position.y, camera.position.z)
    const centerKey = chunkKey(center)
    const wanted = chunksAround(center, voxel.loadRadius)
    const wantedKeys = new Set(wanted.map(chunkKey))

    if (centerKey === lastCenterKey.current) {
      let same = entriesRef.current.size === wantedKeys.size
      if (same) {
        for (const key of wantedKeys) {
          if (!entriesRef.current.has(key)) {
            same = false
            break
          }
        }
      }
      if (same) return
    }
    lastCenterKey.current = centerKey

    let changed = false
    const map = entriesRef.current

    for (const [key, entry] of map) {
      if (!wantedKeys.has(key)) {
        disposeEntry(entry)
        map.delete(key)
        changed = true
      }
    }

    for (const coord of wanted) {
      const key = chunkKey(coord)
      if (map.has(key)) continue
      map.set(key, buildEpChunk(terrain, voxel, gradient, coord, densityAt))
      changed = true
    }

    if (changed) {
      const list = Array.from(map.values())
      setEntries(list)
      onEntries(list)
    }
  })

  useEffect(
    () => () => {
      for (const entry of entriesRef.current.values()) disposeEntry(entry)
      entriesRef.current.clear()
    },
    [],
  )

  return (
    <>
      {entries.map((entry) => (
        <EpEditMesh
          key={entry.key}
          entry={entry}
          material={material}
          voxel={voxel}
          enabled={editEnabled}
          onTapAdd={(key, ix, iy, iz) => editCell(key, ix, iy, iz, 'add')}
          onHoldDelete={(key, ix, iy, iz) => editCell(key, ix, iy, iz, 'remove')}
        />
      ))}
    </>
  )
}

type Peak = { x: number; y: number; z: number }

/** Voxel Cloud filigree scaffold spans only — no colored accent blocks. */
function TownScaffoldDecor({
  entries,
  terrain,
  isolevel,
}: {
  entries: ChunkEntry[]
  terrain: TerrainParams
  isolevel: number
}) {
  const sample = useMemo(() => createNoise(terrain), [terrain])
  const heightScale = terrainAmplitude(terrain)
  const density = EP_SCAFFOLD_DENSITY

  const scaffoldPositions = useMemo(() => {
    const peaks: Peak[] = []

    for (const entry of entries) {
      const { grid, coord } = entry
      const { size, densities, cellSize, origin } = grid
      const stride = Math.max(1, Math.round(size / (2 + density * 6)))
      for (let iz = 0; iz < size; iz += stride) {
        for (let ix = 0; ix < size; ix += stride) {
          let top = -1
          for (let iy = size - 1; iy >= 0; iy--) {
            if (isSolid(densities[gridIndex(ix, iy, iz, size)] ?? 0, isolevel)) {
              top = iy
              break
            }
          }
          if (top < 0) continue
          const wx = origin[0] + (ix + 0.5) * cellSize
          const wy = origin[1] + (top + 0.5) * cellSize
          const wz = origin[2] + (iz + 0.5) * cellSize
          const surface = sample(wx, wz) * heightScale
          if (Math.abs(wy - surface) > cellSize * 2.5) continue

          const h = hash2(coord.cx * size + ix, coord.cz * size + iz, 1)
          if (h > 0.62 && wy > surface * 0.15) {
            peaks.push({ x: wx, y: wy + cellSize * 0.5, z: wz })
          }
        }
      }
    }

    const verts: number[] = []
    const maxDist = 3.6
    for (let i = 0; i < peaks.length; i++) {
      const a = peaks[i]!
      let best: Peak | null = null
      let bestD = maxDist
      for (let j = i + 1; j < peaks.length; j++) {
        const b = peaks[j]!
        const d = Math.hypot(a.x - b.x, a.z - b.z)
        if (d < bestD && d > 0.45) {
          bestD = d
          best = b
        }
      }
      if (!best) continue
      const midY = Math.max(a.y, best.y) + 0.35 + hash2(i, 0, 9) * 0.55
      verts.push(a.x, a.y, a.z, a.x, midY, a.z)
      verts.push(a.x, midY, a.z, best.x, midY, best.z)
      verts.push(best.x, midY, best.z, best.x, best.y, best.z)
      if (hash2(i, 1, 11) > 0.45) {
        verts.push(a.x, a.y + 0.15, a.z, best.x, midY, best.z)
      }
    }

    return verts
  }, [entries, isolevel, sample, heightScale, density])

  const scaffoldGeo = useMemo(() => {
    const geo = new BufferGeometry()
    if (scaffoldPositions.length > 0) {
      geo.setAttribute('position', new Float32BufferAttribute(scaffoldPositions, 3))
    }
    return geo
  }, [scaffoldPositions])

  const scaffoldMat = useMemo(
    () =>
      new LineBasicMaterial({
        color: '#5a616c',
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      }),
    [],
  )

  useEffect(() => {
    return () => {
      scaffoldGeo.dispose()
      scaffoldMat.dispose()
    }
  }, [scaffoldGeo, scaffoldMat])

  if (scaffoldPositions.length === 0) return null
  return <lineSegments geometry={scaffoldGeo} material={scaffoldMat} raycast={() => null} />
}

export default function ExperientialScene({
  terrain,
  voxel,
  gradient: _sharedGradient,
  ep,
  firstPerson,
  onExitFirstPerson,
}: Props) {
  const [entries, setEntries] = useState<ChunkEntry[]>([])
  const onEntries = useMemo(() => {
    return (list: ChunkEntry[]) => setEntries(list)
  }, [])

  return (
    <Canvas
      className="scene-canvas"
      camera={{ position: [5.2, 3.4, 5.8], fov: 48, near: 0.05, far: 220 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
    >
      <color attach="background" args={[EP_SKY_COLOR]} />
      <FogController density={ep.fogDensity} color={EP_FOG_COLOR} />
      <ambientLight intensity={0.22} color="#9aa1ab" />
      <hemisphereLight args={['#2a3038', '#121418', 0.35]} />
      <directionalLight position={[6, 10, 3]} intensity={0.55} color="#d0d4da" />
      <directionalLight position={[-4, 3, -5]} intensity={0.12} color="#6a7380" />
      <SoftWater />
      <TownCloudChunks
        terrain={terrain}
        voxel={voxel}
        gradient={EP_MESH_GRADIENT}
        grain={ep.glitchIntensity}
        editEnabled={!firstPerson}
        onEntries={onEntries}
      />
      <TownScaffoldDecor
        entries={entries}
        terrain={terrain}
        isolevel={voxel.isolevel}
      />
      <OrbitControls
        makeDefault
        enabled={!firstPerson}
        enableDamping
        dampingFactor={0.08}
        enablePan
        minDistance={1.4}
        maxDistance={80}
      />
      <FirstPersonControls
        enabled={firstPerson}
        terrain={terrain}
        onExit={onExitFirstPerson}
      />
    </Canvas>
  )
}
