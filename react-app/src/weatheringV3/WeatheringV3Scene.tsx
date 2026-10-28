import { Html, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Fog,
  LineBasicMaterial,
  PlaneGeometry,
  Vector3,
  type Mesh,
  type ShaderMaterial,
} from 'three'
import { FirstPersonControls } from '../FirstPersonControls.tsx'
import type { DecayParams, EpParams } from './epParams.ts'
import {
  EP_FOG_COLOR,
  EP_SCAFFOLD_DENSITY,
  EP_SKY_COLOR,
  EP_TOWN_GRADIENT,
  epFogFar,
  epFogNear,
  fogDensityWithTownDecay,
  orbitFogThicken,
} from './epParams.ts'
import { createEpMaterial } from './epMaterial.ts'
import { createStillGroundMaterial, DeadSky } from './epAtmosphere.tsx'
import { cellCentroid, type GridCell, type GridLayout } from './epGrid.ts'
import { EpGrid } from './epGrid.tsx'
import { EpSalvageTown } from './epTown.tsx'
import { BackgroundBuildings, type BackgroundSettings } from './backgroundBuildings.tsx'
import {
  INTRO_DURATION,
  INTRO_PLAY_SPEED,
  formatPhaseLabel,
  seedIntactCity,
  type TownPhase,
} from './timeline.ts'
import type { GradientStop } from '../heightGradient.ts'
import { createNoise, terrainAmplitude, type TerrainParams } from '../terrainParams.ts'
import { buildGreedyInteractiveMesh, hitToVoxelIndex } from '../voxelGreedyMesh.ts'
import {
  chunkKey,
  chunkOrigin,
  chunksAround,
  gridIndex,
  isSolid,
  worldToChunk,
} from '../voxelGrid.ts'
import type { ChunkCoord, VoxelGrid } from '../voxelGrid.ts'
import { VOXEL_CHUNK_SIZE } from '../voxelParams.ts'
import type { VoxelParams } from '../voxelParams.ts'

type Props = {
  terrain: TerrainParams
  voxel: VoxelParams
  ep: EpParams
  firstPerson: boolean
  onExitFirstPerson: () => void
  /** Incremented by Reset Grid. Does not touch terrain or voxels. */
  gridReset: number
  decay: DecayParams
  /** Incremented by Reset Decay. Zeroes cell age only. */
  decayReset: number
  /** 0–1 town decay share, for the Decay panel readout. */
  onTownDecay: (share: number) => void
  /** Age/stage lines drawn in the screen chrome, outside the canvas. */
  onAgeReadout: (lines: string[], waterNote: boolean) => void
  phase: TownPhase
  timelineT: number
  timelinePlaying: boolean
  onTimelineT: (t: number) => void
  onPhase: (phase: TownPhase) => void
  onTimelinePlaying: (playing: boolean) => void
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
/** Remesh the follow-camera ground when the camera drifts this far (XZ). */
const GROUND_REANCHOR = 8
/** World size of the overview heightfield — large enough for a bird’s-eye pullback. */
const OVERVIEW_GROUND_SIZE = 520
/**
 * Walk patch: small enough that segment spacing stays ~1 unit (the pre-fog
 * GROUND_SIZE 48 / detail segments density) so noise ridges read at eye height.
 */
const FP_GROUND_SIZE = 96
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

function clampInt(value: number, min: number, max: number) {
  return value < min ? min : value > max ? max : value
}

/** Empty player-build chunk — noise does not pre-fill solids. */
function buildEmptyEpChunk(
  terrain: TerrainParams,
  voxel: VoxelParams,
  coord: ChunkCoord,
  gradient: GradientStop[],
  densityAt?: (x: number, y: number, z: number) => number,
): ChunkEntry {
  const size = Math.max(4, Math.round(voxel.resolution))
  const cellSize = VOXEL_CHUNK_SIZE / size
  const origin = chunkOrigin(coord)
  const densities = new Float32Array(size * size * size)
  densities.fill(voxel.isolevel - 1)
  const grid: VoxelGrid = {
    size,
    densities,
    cellSize,
    origin,
    chunk: coord,
    colorHeight: Math.max(0.35, terrainAmplitude(terrain)),
  }
  const geometry = buildGreedyInteractiveMesh(
    grid,
    voxel.isolevel,
    gradient,
    densityAt,
  )
  return { key: chunkKey(coord), coord, grid, geometry }
}

const fogLook = new Vector3()

function FogController({
  density,
  townDecayRef,
  color,
  firstPerson,
}: {
  density: number
  townDecayRef: MutableRefObject<number>
  color: string
  firstPerson: boolean
}) {
  const { scene, camera } = useThree()
  const fogRef = useRef<Fog | null>(null)
  const firstPersonRef = useRef(firstPerson)
  const densityRef = useRef(density)
  const colorRef = useRef(color)
  firstPersonRef.current = firstPerson
  densityRef.current = density
  colorRef.current = color

  useEffect(() => {
    const fog = new Fog(new Color(color), epFogNear(firstPerson), epFogFar(density, firstPerson))
    fogRef.current = fog
    scene.fog = fog
    return () => {
      if (scene.fog === fog) scene.fog = null
      fogRef.current = null
    }
    // Create once — mode/density updates happen in useFrame so controls aren't reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene])

  useFrame(() => {
    const fog = fogRef.current
    if (!fog) return
    if (scene.fog !== fog) scene.fog = fog
    fog.color.set(colorRef.current)
    const density = fogDensityWithTownDecay(densityRef.current, townDecayRef.current)
    if (firstPersonRef.current) {
      // Walk haze: sky-colored, starts nearby-mid, opaque at the horizon. Density pulls `far` in.
      fog.near = epFogNear(true)
      fog.far = Math.max(fog.near + 8, epFogFar(density, true))
      return
    }
    // Orbit: keep the field body clear even from a high bird’s-eye pullback.
    // Shift the fade band with camera distance so only the terrain rim hazes.
    // Town decay and a slider above the shipped baseline pull that band inward.
    const dist = camera.position.distanceTo(fogLook)
    const rim = OVERVIEW_GROUND_SIZE * 0.42
    const baseNear = epFogNear(false)
    const thicken = orbitFogThicken(density)
    fog.near = Math.max(baseNear * (1 - thicken * 0.62), dist * 0.9 * (1 - thicken * 0.5))
    fog.far = Math.max(
      fog.near + (28 - thicken * 18),
      Math.hypot(dist * 0.92 * (1 - thicken * 0.28), rim * (1 - thicken * 0.45)),
    )
  })
  return null
}

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
    // Plane local XY → world XZ after mesh rotation
    const lx = positions.getX(i)
    const ly = positions.getY(i)
    // After mesh rotation -PI/2 around X: local (lx, ly, h) → world (ox+lx, h, oz-ly)
    const wx = ox + lx
    const wz = oz - ly
    const n = sample(wx, wz)
    positions.setZ(i, n * heightScale + 0.25)

    const t = (n + 1) * 0.5
    // Lift albedo so ridges still read through the haze.
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
 * One continuous noise heightfield that follows the camera and remeshes when you
 * walk far enough. Sized past fog reach so the rim stays hidden in haze —
 * no tiled seams, no frustum holes from many small meshes.
 */
function StreamedNoiseGround({
  terrain,
  fogDensity,
  firstPerson,
  editEnabled,
  onTapPlace,
}: {
  terrain: TerrainParams
  fogDensity: number
  firstPerson: boolean
  editEnabled: boolean
  onTapPlace: (wx: number, wy: number, wz: number) => void
}) {
  const meshRef = useRef<Mesh>(null)
  const geoRef = useRef<BufferGeometry | null>(null)
  const groundRef = useRef<{ geometry: BufferGeometry; ox: number; oz: number } | null>(
    null,
  )
  const [ground, setGround] = useState<{
    geometry: BufferGeometry
    ox: number
    oz: number
  } | null>(null)
  const lastMeshAt = useRef(0)
  const firstPersonRef = useRef(firstPerson)
  firstPersonRef.current = firstPerson
  const { camera: cam } = useThree()
  const groundMat = useMemo(() => createStillGroundMaterial(), [])
  useEffect(() => () => groundMat.dispose(), [groundMat])

  const sample = useMemo(() => createNoise(terrain), [terrain])
  const heightScale = terrainAmplitude(terrain)
  const segments = Math.max(48, Math.round(terrain.detail * 1.25))
  const genKey = `${terrain.noiseId}|${terrain.frequency}|${terrain.amplitude}|${terrain.octaves}|${terrain.persistence}|${segments}|${heightScale}|${fogDensity}`

  const remesh = (ox: number, oz: number, walking: boolean) => {
    // Orbit keeps the wide sheet, with quad spacing near the pre-520 view (~2.7).
    // Jump In uses a dense patch so ridges read at eye height.
    const size = walking ? FP_GROUND_SIZE : OVERVIEW_GROUND_SIZE
    const segs = walking
      ? Math.max(72, Math.round(size))
      : Math.max(48, Math.round(size / 2.7))
    const next = buildFollowGroundGeometry(ox, oz, size, sample, heightScale, segs)
    geoRef.current?.dispose()
    geoRef.current = next
    const payload = { geometry: next, ox, oz }
    groundRef.current = payload
    setGround(payload)
  }

  useEffect(() => {
    // Orbit: anchor at origin so orbiting never remeshes mid-drag.
    // Jump In: re-anchor under the camera when entering walk mode.
    if (firstPerson) remesh(cam.position.x, cam.position.z, true)
    else remesh(0, 0, false)
    return () => {
      geoRef.current?.dispose()
      geoRef.current = null
      groundRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remesh on terrain/fog/mode
  }, [genKey, sample, heightScale, segments, fogDensity, firstPerson])

  useFrame(({ camera }) => {
    // Only re-anchor while walking — orbit remeshes fight OrbitControls gestures.
    if (!firstPersonRef.current) return
    const g = groundRef.current
    if (!g) return
    const now = performance.now()
    if (now - lastMeshAt.current < STREAM_INTERVAL_MS) return
    const dx = camera.position.x - g.ox
    const dz = camera.position.z - g.oz
    if (dx * dx + dz * dz < GROUND_REANCHOR * GROUND_REANCHOR) return
    lastMeshAt.current = now
    remesh(camera.position.x, camera.position.z, true)
  })

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
    // Do not stopPropagation — OrbitControls owns the native pointer/wheel stream.
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

type HoldState = {
  center: readonly [number, number, number]
  cellSize: number
  startedAt: number
}

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
    // Do not stopPropagation — OrbitControls needs the native pointer stream.

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

  const vertCount = entry.geometry.getAttribute('position')?.count ?? 0
  if (vertCount === 0) return null

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

/** Player-built voxels only — start empty; stream empty grids around the camera. */
function PlayerVoxelWorld({
  terrain,
  voxel,
  gradient,
  grain,
  editEnabled,
  groundPlaceRef,
}: {
  terrain: TerrainParams
  voxel: VoxelParams
  gradient: GradientStop[]
  grain: number
  editEnabled: boolean
  groundPlaceRef: MutableRefObject<((wx: number, wy: number, wz: number) => void) | null>
}) {
  const [entries, setEntries] = useState<ChunkEntry[]>([])
  const entriesRef = useRef<Map<string, ChunkEntry>>(new Map())
  const lastStreamAt = useRef(0)
  const lastCenterKey = useRef('')
  const materialRef = useRef<ShaderMaterial | null>(null)
  const gradientRef = useRef(gradient)
  const voxelRef = useRef(voxel)
  const terrainRef = useRef(terrain)
  gradientRef.current = gradient
  voxelRef.current = voxel
  terrainRef.current = terrain

  const densityAt = (x: number, y: number, z: number) => {
    const v = voxelRef.current
    const coord = worldToChunk(x, y, z)
    const entry = entriesRef.current.get(chunkKey(coord))
    if (!entry) return v.isolevel - 1
    const { grid } = entry
    const ix = Math.floor((x - grid.origin[0]) / grid.cellSize)
    const iy = Math.floor((y - grid.origin[1]) / grid.cellSize)
    const iz = Math.floor((z - grid.origin[2]) / grid.cellSize)
    if (ix < 0 || iy < 0 || iz < 0 || ix >= grid.size || iy >= grid.size || iz >= grid.size) {
      return v.isolevel - 1
    }
    return grid.densities[gridIndex(ix, iy, iz, grid.size)] ?? v.isolevel - 1
  }

  const material = useMemo(() => {
    const mat = createEpMaterial({ grain })
    materialRef.current = mat
    return mat
  }, [])

  useEffect(() => {
    if (material.uniforms.uGrain) material.uniforms.uGrain.value = grain
  }, [material, grain])

  useEffect(() => () => material.dispose(), [material])

  // Resolution / isolevel rebuild clears player builds; terrain noise does not (ground remeshes separately)
  const voxelGenKey = `${voxel.resolution}|${voxel.isolevel}|${voxel.loadRadius}`

  useEffect(() => {
    for (const entry of entriesRef.current.values()) disposeEntry(entry)
    entriesRef.current.clear()
    lastCenterKey.current = ''
    setEntries([])
  }, [voxelGenKey])

  const remeshEntry = (prev: ChunkEntry, densities: Float32Array) => {
    disposeEntry(prev)
    const grid: VoxelGrid = { ...prev.grid, densities }
    const geometry = buildGreedyInteractiveMesh(
      grid,
      voxelRef.current.isolevel,
      gradientRef.current,
      densityAt,
    )
    return { ...prev, grid, geometry }
  }

  const publish = () => {
    setEntries(Array.from(entriesRef.current.values()))
  }

  const ensureChunk = (coord: ChunkCoord) => {
    const key = chunkKey(coord)
    const existing = entriesRef.current.get(key)
    if (existing) return existing
    const next = buildEmptyEpChunk(
      terrainRef.current,
      voxelRef.current,
      coord,
      gradientRef.current,
      densityAt,
    )
    entriesRef.current.set(key, next)
    return next
  }

  const editCell = (key: string, ix: number, iy: number, iz: number, mode: 'add' | 'remove') => {
    const prev = entriesRef.current.get(key)
    if (!prev) return
    const v = voxelRef.current
    const nextDens = prev.grid.densities.slice()
    const idx = gridIndex(ix, iy, iz, prev.grid.size)
    if (mode === 'add') {
      nextDens[idx] = Math.max(v.isolevel + 0.5, (nextDens[idx] ?? 0) + 1)
    } else {
      nextDens[idx] = Math.min(v.isolevel - 0.5, (nextDens[idx] ?? 0) - 1)
    }
    entriesRef.current.set(key, remeshEntry(prev, nextDens))
    publish()
  }

  const placeOnGround = (wx: number, wy: number, wz: number) => {
    const v = voxelRef.current
    const size = Math.max(4, Math.round(v.resolution))
    const cellSize = VOXEL_CHUNK_SIZE / size
    // Sit the new cell on the ground hit (slightly above so we land in the surface cell)
    const placeY = wy + cellSize * 0.25
    const coord = worldToChunk(wx, placeY, wz)
    const entry = ensureChunk(coord)
    const { origin } = entry.grid
    const ix = clampInt(Math.floor((wx - origin[0]) / cellSize), 0, size - 1)
    const iy = clampInt(Math.floor((placeY - origin[1]) / cellSize), 0, size - 1)
    const iz = clampInt(Math.floor((wz - origin[2]) / cellSize), 0, size - 1)
    const idx = gridIndex(ix, iy, iz, size)
    if (isSolid(entry.grid.densities[idx] ?? 0, v.isolevel)) return
    editCell(entry.key, ix, iy, iz, 'add')
  }

  groundPlaceRef.current = placeOnGround

  useFrame(({ camera, clock }) => {
    if (materialRef.current?.uniforms.uTime) {
      materialRef.current.uniforms.uTime.value = clock.elapsedTime
    }

    const now = performance.now()
    if (now - lastStreamAt.current < STREAM_INTERVAL_MS) return
    lastStreamAt.current = now

    const center = worldToChunk(camera.position.x, camera.position.y, camera.position.z)
    // Player voxels stay on the user load radius only — fog horizon is covered by
    // streamed ground (2D). Expanding 3D Chebyshev radius to fog reach was
    // (2r+1)³ ≈ 30k chunks and froze/blacked the canvas (VOXEL_CHUNK_SIZE=4).
    const loadR = Math.max(1, Math.min(4, Math.round(voxel.loadRadius)))
    const centerKey = `${chunkKey(center)}|${loadR}`
    const wanted = chunksAround(center, loadR)
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
      map.set(
        key,
        buildEmptyEpChunk(terrain, voxel, coord, gradient, densityAt),
      )
      changed = true
    }

    if (changed) publish()
  })

  useEffect(
    () => () => {
      for (const entry of entriesRef.current.values()) disposeEntry(entry)
      entriesRef.current.clear()
      groundPlaceRef.current = null
    },
    [groundPlaceRef],
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
      {/* Scaffold stays here so chunk stream re-renders don't remount OrbitControls. */}
      <TownScaffoldDecor entries={entries} isolevel={voxel.isolevel} />
    </>
  )
}

type Peak = { x: number; y: number; z: number }

function TownScaffoldDecor({
  entries,
  isolevel,
}: {
  entries: ChunkEntry[]
  isolevel: number
}) {
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
          const h = hash2(coord.cx * size + ix, coord.cz * size + iz, 1)
          if (h > 0.55) peaks.push({ x: wx, y: wy + cellSize * 0.5, z: wz })
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
    }

    return verts
  }, [entries, isolevel, density])

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

/**
 * Must live inside <Canvas> — R3F useFrame throws outside the provider and blanked the tab.
 * Advances a live clock ref every frame; React state is throttled so play does not remount the town.
 */
function IntroTimelineDriver({
  phaseRef,
  playingRef,
  timelineTRef,
  onTimelineTRef,
  onPhaseRef,
  onTimelinePlayingRef,
}: {
  phaseRef: MutableRefObject<TownPhase>
  playingRef: MutableRefObject<boolean>
  timelineTRef: MutableRefObject<number>
  onTimelineTRef: MutableRefObject<(t: number) => void>
  onPhaseRef: MutableRefObject<(phase: TownPhase) => void>
  onTimelinePlayingRef: MutableRefObject<(playing: boolean) => void>
}) {
  const publishWait = useRef(0)
  useFrame((_, delta) => {
    if (phaseRef.current !== 'intro' || !playingRef.current) return
    const prev = timelineTRef.current
    const next = Math.min(INTRO_DURATION, prev + delta * INTRO_PLAY_SPEED)
    if (!(next > prev)) return
    timelineTRef.current = next
    publishWait.current += delta
    const atEnd = next >= INTRO_DURATION
    // ~10 Hz UI/scrubber sync — ages read the live ref every frame in EpSalvageTown.
    if (atEnd || publishWait.current >= 0.1) {
      publishWait.current = 0
      onTimelineTRef.current(next)
    }
    if (atEnd) {
      onTimelinePlayingRef.current(false)
      onPhaseRef.current('ongoing')
    }
  })
  return null
}

/** Weathering v3 — full copy of Weathering, independently owned under weatheringV3/. */
export default function WeatheringV3Scene({
  terrain,
  voxel,
  ep,
  firstPerson,
  onExitFirstPerson,
  gridReset,
  decay,
  decayReset,
  onTownDecay,
  onAgeReadout,
  phase,
  timelineT,
  timelinePlaying,
  onTimelineT,
  onPhase,
  onTimelinePlaying,
}: Props) {
  const groundPlaceRef = useRef<((wx: number, wy: number, wz: number) => void) | null>(null)
  const townCells = useRef<Map<string, GridCell>>(new Map())
  const [settlementRevision, setSettlementRevision] = useState(0)
  const bumpSettlement = useCallback(() => setSettlementRevision((value) => value + 1), [])
  const townDecayRef = useRef(0)
  const editBridge = useRef<(ix: number, iz: number, y: number) => void>(() => {})
  useEffect(() => {
    return () => {
      onTownDecay(0)
      onAgeReadout([], false)
    }
  }, [onTownDecay, onAgeReadout])
  const [claimRevision, setClaimRevision] = useState(0)
  const gridLayout = useMemo<GridLayout>(
    () => ({ cellSize: ep.cellSize, warp: ep.gridWarp }),
    [ep.cellSize, ep.gridWarp],
  )
  const townLayout = useMemo<GridLayout>(
    () => ({ ...gridLayout, buildingScale: ep.buildingScale ?? 3 }),
    [gridLayout, ep.buildingScale],
  )
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const timelineTRef = useRef(timelineT)
  const playingRef = useRef(timelinePlaying)
  playingRef.current = timelinePlaying
  const onTimelineTRef = useRef(onTimelineT)
  onTimelineTRef.current = onTimelineT
  const onPhaseRef = useRef(onPhase)
  onPhaseRef.current = onPhase
  const onTimelinePlayingRef = useRef(onTimelinePlaying)
  onTimelinePlayingRef.current = onTimelinePlaying
  const backgroundSettings = useMemo<BackgroundSettings>(
    () => ({
      density: ep.backgroundDensity ?? 22,
      minDistance: ep.backgroundMinDistance ?? 36,
      maxDistance: ep.backgroundMaxDistance ?? 110,
      minStories: ep.backgroundMinStories ?? 2,
      maxStories: ep.backgroundMaxStories ?? 7,
      stageBias: ep.backgroundStageBias ?? 'random',
      seed: ep.backgroundSeed ?? 1,
      buildingScale: ep.backgroundBuildingScale ?? ep.buildingScale ?? 3,
    }),
    [
      ep.backgroundDensity,
      ep.backgroundMinDistance,
      ep.backgroundMaxDistance,
      ep.backgroundMinStories,
      ep.backgroundMaxStories,
      ep.backgroundStageBias,
      ep.backgroundSeed,
      ep.backgroundBuildingScale,
    ],
  )
  const sample = useMemo(() => createNoise(terrain), [terrain])
  const heightScale = terrainAmplitude(terrain)
  const heightAt = useCallback(
    (x: number, z: number) => sample(x, z) * heightScale + 0.25,
    [sample, heightScale],
  )
  const groundAt = useCallback(
    (ix: number, iz: number) => {
      const [x, z] = cellCentroid(ix, iz, gridLayout)
      return heightAt(x, z)
    },
    [heightAt, gridLayout],
  )

  useEffect(() => {
    seedIntactCity(
      townCells.current,
      gridLayout,
      heightAt,
      ep.maxStories ?? 8,
      decay.fireBarrelChance,
    )
    setClaimRevision((value) => value + 1)
    bumpSettlement()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reseed on grid reset only
  }, [gridReset])

  // Scrub / skip / reset must update the live clock during render so child handoff
  // effects (EpSalvageTown) see the new time — useEffect runs too late (children first).
  if (!timelinePlaying) timelineTRef.current = timelineT

  const onGroundTap = useMemo(() => {
    return () => {
      // Clicks build settlement lots in EpSalvageTown, not resolution-tied voxels.
    }
  }, [])

  const townEditable = !firstPerson && phase === 'ongoing'

  return (
    <Canvas
      className="scene-canvas"
      camera={{ position: [22, 14, 28], fov: 42, near: 0.05, far: 4000 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
    >
      <IntroTimelineDriver
        phaseRef={phaseRef}
        playingRef={playingRef}
        timelineTRef={timelineTRef}
        onTimelineTRef={onTimelineTRef}
        onPhaseRef={onPhaseRef}
        onTimelinePlayingRef={onTimelinePlayingRef}
      />
      <color attach="background" args={[EP_SKY_COLOR]} />
      <DeadSky />
      <FogController
        density={ep.fogDensity}
        townDecayRef={townDecayRef}
        color={EP_FOG_COLOR}
        firstPerson={firstPerson}
      />
      <ambientLight intensity={0.55} color="#b4bcc6" />
      <hemisphereLight args={['#4a5560', '#1a1e24', 0.7]} />
      <directionalLight position={[6, 10, 3]} intensity={1.05} color="#e0e4ea" />
      <directionalLight position={[-4, 3, -5]} intensity={0.3} color="#8a949e" />
      <StreamedNoiseGround
        terrain={terrain}
        fogDensity={ep.fogDensity}
        firstPerson={firstPerson}
        editEnabled={false}
        onTapPlace={onGroundTap}
      />
      <PlayerVoxelWorld
        terrain={terrain}
        voxel={voxel}
        gradient={EP_MESH_GRADIENT}
        grain={ep.glitchIntensity}
        editEnabled={false}
        groundPlaceRef={groundPlaceRef}
      />
      <BackgroundBuildings
        settings={backgroundSettings}
        heightAt={heightAt}
        cellsRef={townCells}
        layout={gridLayout}
        settlementRevision={settlementRevision}
      />
      <EpGrid
        layout={gridLayout}
        visible={ep.gridVisible}
        editEnabled={townEditable}
        onCell={(ix, iz, y) => editBridge.current(ix, iz, y)}
      />
      <EpSalvageTown
        cellsRef={townCells}
        layout={townLayout}
        editEnabled={townEditable}
        grain={ep.glitchIntensity}
        claimRevision={claimRevision}
        editBridge={editBridge}
        autoGrow={ep.autoGrow && phase === 'ongoing'}
        autoGrowSeconds={ep.autoGrowSeconds}
        maxStories={ep.maxStories ?? 8}
        heightAt={heightAt}
        groundAt={groundAt}
        decay={decay}
        decayReset={decayReset}
        townDecayRef={townDecayRef}
        onTownDecay={onTownDecay}
        onAgeReadout={onAgeReadout}
        onSettlement={bumpSettlement}
        phase={phase}
        timelineT={timelineT}
        timelineClockRef={timelineTRef}
      />
      <Html
        fullscreen
        style={{ pointerEvents: 'none' }}
        zIndexRange={[20, 0]}
      >
        <div
          style={{
            position: 'absolute',
            left: 16,
            bottom: 16,
            maxWidth: 420,
            fontFamily: 'Martian Mono, ui-monospace, monospace',
            fontSize: 11,
            lineHeight: 1.35,
            color: '#e8eaed',
            background: 'rgba(0,0,0,0.72)',
            border: '1px solid #5a6570',
            padding: '8px 10px',
          }}
        >
          <div style={{ color: phase === 'intro' ? '#7ec8ff' : '#c4e07a', fontWeight: 600 }}>
            {formatPhaseLabel(phase, timelineT)}
          </div>
          <div style={{ opacity: 0.85, marginTop: 4 }}>
            {phase === 'intro'
              ? 'Staggered vacating · shells persist · end = mixed stages'
              : 'Continuous aging · claim empty / stack while held · no clear/restore'}
          </div>
        </div>
      </Html>
      <OrbitControls
        makeDefault
        enabled={!firstPerson}
        enableDamping
        dampingFactor={0.08}
        enablePan
        enableZoom
        // Do not pass target={[…]} — fresh arrays each render reset the orbit focus.
        minDistance={1.4}
        maxDistance={900}
        maxPolarAngle={Math.PI / 2.05}
      />
      <FirstPersonControls
        enabled={firstPerson}
        terrain={terrain}
        onExit={onExitFirstPerson}
      />
    </Canvas>
  )
}
