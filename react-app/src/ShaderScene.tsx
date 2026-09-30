import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import type { BufferGeometry, ShaderMaterial } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { GradientStop } from './heightGradient.ts'
import { createStudyMaterial } from './shaderStudies.ts'
import type { ShaderStudyId } from './shaderStudies.ts'
import type { TerrainParams } from './terrainParams.ts'
import { extractMarchingCubesFromGrid } from './voxelExtract.ts'
import { buildGreedyInteractiveMesh } from './voxelGreedyMesh.ts'
import { buildVoxelChunk, createDensityFunction } from './voxelGrid.ts'
import { VOXEL_CHUNK_SIZE } from './voxelParams.ts'
import type { VoxelParams, VoxelRenderMode } from './voxelParams.ts'

type Props = {
  terrain: TerrainParams
  voxel: VoxelParams
  study: ShaderStudyId
  /** Shaders-tab-only meshing choice — not `voxel.renderMode`. */
  meshMode: VoxelRenderMode
  gradient: GradientStop[]
}

type DensityAt = (x: number, y: number, z: number) => number

function meshChunk(
  terrain: TerrainParams,
  voxel: VoxelParams,
  meshMode: VoxelRenderMode,
  gradient: GradientStop[],
  densityAt: DensityAt,
  cy: number,
): BufferGeometry {
  const grid = buildVoxelChunk(terrain, voxel, { cx: 0, cy, cz: 0 })
  return meshMode === 'interactive'
    ? buildGreedyInteractiveMesh(grid, voxel.isolevel, gradient, densityAt)
    : extractMarchingCubesFromGrid(grid, voxel.isolevel, densityAt)
}

/**
 * Heightfield sits near y ≈ ±terrain.height, while chunk (0,0,0) only covers
 * y ∈ [0, CHUNK]. Build cy = -1 and 0 so the surface is inside the mesh.
 * Meshing reuses Voxels builders; mode is chosen only for this tab.
 */
function buildStudyGeometry(
  terrain: TerrainParams,
  voxel: VoxelParams,
  meshMode: VoxelRenderMode,
  gradient: GradientStop[],
  densityAt: DensityAt,
) {
  const parts = [-1, 0].map((cy) =>
    meshChunk(terrain, voxel, meshMode, gradient, densityAt, cy),
  )
  const merged = mergeGeometries(parts, false)
  for (const part of parts) part.dispose()
  if (!merged) {
    return meshChunk(terrain, voxel, meshMode, gradient, densityAt, -1)
  }
  // Interactive already has normals; MC benefits from a recompute after merge
  if (meshMode === 'marching') merged.computeVertexNormals()
  return merged
}

function ShaderTerrain({ terrain, voxel, study, meshMode, gradient }: Props) {
  const materialRef = useRef<ShaderMaterial | null>(null)

  const densityAt = useMemo(
    () => createDensityFunction(terrain, voxel),
    [terrain, voxel],
  )

  const geometry = useMemo(
    () => buildStudyGeometry(terrain, voxel, meshMode, gradient, densityAt),
    [terrain, voxel, meshMode, gradient, densityAt],
  )

  const material = useMemo(() => {
    const next = createStudyMaterial(study)
    materialRef.current = next
    return next
  }, [study])

  useEffect(() => {
    return () => {
      geometry.dispose()
    }
  }, [geometry])

  useEffect(() => {
    return () => {
      material.dispose()
    }
  }, [material])

  useFrame(({ clock }) => {
    const mat = materialRef.current
    if (mat?.uniforms.uTime) mat.uniforms.uTime.value = clock.elapsedTime
  })

  return <mesh geometry={geometry} material={material} frustumCulled={false} />
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
