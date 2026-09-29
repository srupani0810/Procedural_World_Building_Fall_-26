import { OrbitControls } from '@react-three/drei'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { DoubleSide } from 'three'
import type { GradientStop } from './heightGradient.ts'
import type { TerrainParams } from './terrainParams.ts'
import { extractMarchingCubesFromGrid } from './voxelExtract.ts'
import { buildGreedyInteractiveMesh, hitToVoxelIndex } from './voxelGreedyMesh.ts'
import { buildVoxelGrid, gridIndex } from './voxelGrid.ts'
import type { VoxelGrid } from './voxelGrid.ts'
import type { VoxelParams } from './voxelParams.ts'

type Props = {
  terrain: TerrainParams
  voxel: VoxelParams
  gradient: GradientStop[]
}

type LiveProps = {
  grid: VoxelGrid
  voxel: VoxelParams
  gradient: GradientStop[]
  onEditDensities: (next: Float32Array) => void
}

/**
 * Step 1: shared N³ density grid (density inputs only — not meshing mode).
 */
function useBaseVoxelGrid(terrain: TerrainParams, voxel: VoxelParams): VoxelGrid {
  const { resolution, bleed, volume } = voxel
  return useMemo(
    () =>
      buildVoxelGrid(terrain, {
        ...voxel,
        resolution,
        bleed,
        volume,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- density inputs only
    [terrain, resolution, bleed, volume],
  )
}

function VoxelInteractive({ grid, voxel, gradient, onEditDensities }: LiveProps) {
  const geometry = useMemo(
    () => buildGreedyInteractiveMesh(grid, voxel.isolevel, gradient),
    [grid, voxel.isolevel, gradient],
  )

  useLayoutEffect(() => () => geometry.dispose(), [geometry])

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (!event.face) return
    event.stopPropagation()

    const normal = event.face.normal
      .clone()
      .transformDirection(event.object.matrixWorld)
      .normalize()

    const add = event.nativeEvent.shiftKey
    const target = hitToVoxelIndex(event.point, normal, grid, !add)
    if (!target) return

    const { ix, iy, iz } = target
    const idx = gridIndex(ix, iy, iz, grid.size)
    const next = grid.densities.slice()
    if (add) {
      // Place a solid just outside the clicked face
      next[idx] = Math.max(voxel.isolevel + 0.5, (next[idx] ?? 0) + 1)
    } else {
      // Carve the solid behind the clicked face
      next[idx] = Math.min(voxel.isolevel - 0.5, (next[idx] ?? 0) - 1)
    }
    onEditDensities(next)
  }

  return (
    <mesh
      geometry={geometry}
      onPointerDown={handlePointerDown}
      castShadow={false}
      receiveShadow={false}
    >
      <meshLambertMaterial vertexColors flatShading />
    </mesh>
  )
}

function VoxelMarching({ grid, voxel }: { grid: VoxelGrid; voxel: VoxelParams }) {
  const geometry = useMemo(
    () => extractMarchingCubesFromGrid(grid, voxel.isolevel),
    [grid, voxel.isolevel],
  )

  useLayoutEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial vertexColors roughness={0.82} metalness={0} side={DoubleSide} />
    </mesh>
  )
}

export default function VoxelScene({ terrain, voxel, gradient }: Props) {
  const baseGrid = useBaseVoxelGrid(terrain, voxel)
  const [densities, setDensities] = useState(() => baseGrid.densities.slice())

  useEffect(() => {
    setDensities(baseGrid.densities.slice())
  }, [baseGrid])

  const liveGrid = useMemo<VoxelGrid>(
    () => ({
      size: baseGrid.size,
      half: baseGrid.half,
      cellSize: baseGrid.cellSize,
      densities,
    }),
    [baseGrid.size, baseGrid.half, baseGrid.cellSize, densities],
  )

  const interactive = voxel.renderMode === 'interactive'

  return (
    <Canvas
      className="scene-canvas"
      camera={{ position: [3.4, 2.8, 3.4], fov: 45 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#0a0a0a']} />
      {interactive ? (
        <>
          <ambientLight intensity={0.45} />
          <directionalLight position={[5, 8, 4]} intensity={1.15} />
        </>
      ) : (
        <>
          <ambientLight intensity={0.55} />
          <directionalLight position={[4, 6, 3]} intensity={1.2} />
          <directionalLight position={[-3, 1, -2]} intensity={0.25} />
        </>
      )}
      {interactive ? (
        <VoxelInteractive
          grid={liveGrid}
          voxel={voxel}
          gradient={gradient}
          onEditDensities={(next) => setDensities(new Float32Array(next))}
        />
      ) : (
        <VoxelMarching grid={liveGrid} voxel={voxel} />
      )}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan
        minDistance={1.4}
        maxDistance={14}
      />
    </Canvas>
  )
}
