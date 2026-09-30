import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DoubleSide,
  type BufferGeometry,
  type Mesh,
  type ShaderMaterial,
} from 'three'
import type { GradientStop } from './heightGradient.ts'
import { createStudyMaterial } from './shaderStudies.ts'
import type { ShaderStudyId } from './shaderStudies.ts'
import type { TerrainParams } from './terrainParams.ts'
import { extractMarchingCubesFromGrid } from './voxelExtract.ts'
import { buildGreedyInteractiveMesh, hitToVoxelIndex } from './voxelGreedyMesh.ts'
import {
  buildVoxelChunk,
  createDensityFunction,
  gridIndex,
  isSolid,
} from './voxelGrid.ts'
import type { VoxelGrid } from './voxelGrid.ts'
import { VOXEL_CHUNK_SIZE } from './voxelParams.ts'
import type { VoxelParams, VoxelRenderMode } from './voxelParams.ts'

type Props = {
  terrain: TerrainParams
  voxel: VoxelParams
  study: ShaderStudyId
  meshMode: VoxelRenderMode
  gradient: GradientStop[]
}

type DensityAt = (x: number, y: number, z: number) => number

type StudyChunk = {
  cy: number
  grid: VoxelGrid
  geometry: BufferGeometry
}

const STUDY_CYS = [-1, 0] as const
const HOLD_DELETE_MS = 400
const TAP_MAX_MS = 220
/** Cancel edit when the pointer moves this far — lets OrbitControls own the gesture. */
const DRAG_CANCEL_PX = 6

function meshFromGrid(
  grid: VoxelGrid,
  meshMode: VoxelRenderMode,
  voxel: VoxelParams,
  gradient: GradientStop[],
  densityAt: DensityAt,
): BufferGeometry {
  return meshMode === 'interactive'
    ? buildGreedyInteractiveMesh(grid, voxel.isolevel, gradient, densityAt)
    : extractMarchingCubesFromGrid(grid, voxel.isolevel, densityAt)
}

function buildStudyChunks(
  terrain: TerrainParams,
  voxel: VoxelParams,
  meshMode: VoxelRenderMode,
  gradient: GradientStop[],
  densityAt: DensityAt,
): StudyChunk[] {
  return STUDY_CYS.map((cy) => {
    const grid = buildVoxelChunk(terrain, voxel, { cx: 0, cy, cz: 0 })
    const geometry = meshFromGrid(grid, meshMode, voxel, gradient, densityAt)
    if (meshMode === 'marching') geometry.computeVertexNormals()
    return { cy, grid, geometry }
  })
}

function disposeChunks(chunks: StudyChunk[]) {
  for (const chunk of chunks) chunk.geometry.dispose()
}

function cellWorldCenter(grid: VoxelGrid, ix: number, iy: number, iz: number) {
  return [
    grid.origin[0] + (ix + 0.5) * grid.cellSize,
    grid.origin[1] + (iy + 0.5) * grid.cellSize,
    grid.origin[2] + (iz + 0.5) * grid.cellSize,
  ] as const
}

type HoldState = {
  center: readonly [number, number, number]
  cellSize: number
  startedAt: number
}

function DisplaceEditMesh({
  chunk,
  material,
  voxel,
  enabled,
  onTapAdd,
  onHoldDelete,
}: {
  chunk: StudyChunk
  material: ShaderMaterial
  voxel: VoxelParams
  enabled: boolean
  onTapAdd: (cy: number, ix: number, iy: number, iz: number) => void
  onHoldDelete: (cy: number, ix: number, iy: number, iz: number) => void
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
  const chunkRef = useRef(chunk)
  const voxelRef = useRef(voxel)
  const onTapAddRef = useRef(onTapAdd)
  chunkRef.current = chunk
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

      const activeChunk = chunkRef.current
      const activeVoxel = voxelRef.current
      if (!h.deleted && !h.dragged && elapsed < TAP_MAX_MS && h.air) {
        const dens = activeChunk.grid.densities
        const idx = gridIndex(h.air.ix, h.air.iy, h.air.iz, activeChunk.grid.size)
        if (!isSolid(dens[idx] ?? 0, activeVoxel.isolevel)) {
          onTapAddRef.current(activeChunk.cy, h.air.ix, h.air.iy, h.air.iz)
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
    // Do not stopPropagation — OrbitControls needs the native pointer stream.

    const normal = event.face.normal
      .clone()
      .transformDirection(event.object.matrixWorld)
      .normalize()

    const solid = hitToVoxelIndex(event.point, normal, chunk.grid, true)
    const air = hitToVoxelIndex(event.point, normal, chunk.grid, false)
    if (!solid) return

    const startedAt = performance.now()
    setHoldVisual({
      center: cellWorldCenter(chunk.grid, solid.ix, solid.iy, solid.iz),
      cellSize: chunk.grid.cellSize,
      startedAt,
    })

    const timer = window.setTimeout(() => {
      const cur = holdRef.current
      if (!cur || cur.deleted || cur.dragged) return
      cur.deleted = true
      onHoldDelete(chunk.cy, cur.solid.ix, cur.solid.iy, cur.solid.iz)
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
        geometry={chunk.geometry}
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
            color="#ff1a1a"
            transparent
            opacity={0.7}
            depthWrite={false}
            side={DoubleSide}
          />
        </mesh>
      ) : null}
    </>
  )
}

function ShaderTerrain({ terrain, voxel, study, meshMode, gradient }: Props) {
  const materialRef = useRef<ShaderMaterial | null>(null)
  const editEnabled = study === 'displace'

  const densityAt = useMemo(
    () => createDensityFunction(terrain, voxel),
    [terrain, voxel],
  )

  const genKey = `${terrain.noiseId}|${terrain.frequency}|${terrain.amplitude}|${terrain.octaves}|${terrain.persistence}|${voxel.resolution}|${voxel.isolevel}|${voxel.bleed}|${voxel.volume}|${meshMode}|${gradient.map((s) => `${s.position}:${s.color}`).join(';')}`

  const [chunks, setChunks] = useState<StudyChunk[]>(() =>
    buildStudyChunks(terrain, voxel, meshMode, gradient, densityAt),
  )

  useEffect(() => {
    setChunks((prev) => {
      disposeChunks(prev)
      return buildStudyChunks(terrain, voxel, meshMode, gradient, densityAt)
    })
    // Rebuild when generation inputs change (genKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genKey])

  useEffect(() => {
    return () => {
      disposeChunks(chunks)
    }
    // only on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const material = useMemo(() => {
    const next = createStudyMaterial(study)
    materialRef.current = next
    return next
  }, [study])

  useEffect(() => {
    return () => {
      material.dispose()
    }
  }, [material])

  useFrame(({ clock }) => {
    if (materialRef.current?.uniforms.uTime) {
      materialRef.current.uniforms.uTime.value = clock.elapsedTime
    }
  })

  const editCell = (
    cy: number,
    ix: number,
    iy: number,
    iz: number,
    mode: 'add' | 'remove',
  ) => {
    setChunks((prev) => {
      const chunk = prev.find((c) => c.cy === cy)
      if (!chunk) return prev
      const nextDens = chunk.grid.densities.slice()
      const idx = gridIndex(ix, iy, iz, chunk.grid.size)
      if (mode === 'add') {
        nextDens[idx] = Math.max(voxel.isolevel + 0.5, (nextDens[idx] ?? 0) + 1)
      } else {
        nextDens[idx] = Math.min(voxel.isolevel - 0.5, (nextDens[idx] ?? 0) - 1)
      }
      const grid: VoxelGrid = { ...chunk.grid, densities: nextDens }
      const geometry = meshFromGrid(grid, meshMode, voxel, gradient, densityAt)
      if (meshMode === 'marching') geometry.computeVertexNormals()
      chunk.geometry.dispose()
      return prev.map((c) => (c.cy === cy ? { cy, grid, geometry } : c))
    })
  }

  return (
    <group>
      {chunks.map((chunk) => (
        <DisplaceEditMesh
          key={chunk.cy}
          chunk={chunk}
          material={material}
          voxel={voxel}
          enabled={editEnabled}
          onTapAdd={(cy, ix, iy, iz) => editCell(cy, ix, iy, iz, 'add')}
          onHoldDelete={(cy, ix, iy, iz) => editCell(cy, ix, iy, iz, 'remove')}
        />
      ))}
    </group>
  )
}

export default function ShaderScene({
  terrain,
  voxel,
  study,
  meshMode,
  gradient,
}: Props) {
  const target: [number, number, number] = [
    VOXEL_CHUNK_SIZE * 0.5,
    0,
    VOXEL_CHUNK_SIZE * 0.5,
  ]

  return (
    <Canvas
      className="scene-canvas"
      camera={{ position: [5.2, 3.2, 5.2], fov: 45, near: 0.05, far: 200 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#0a0a0a']} />
      <ShaderTerrain
        terrain={terrain}
        voxel={voxel}
        study={study}
        meshMode={meshMode}
        gradient={gradient}
      />
      <OrbitControls
        makeDefault
        target={target}
        enableDamping
        dampingFactor={0.08}
        enablePan
        minDistance={1.4}
        maxDistance={80}
      />
    </Canvas>
  )
}
