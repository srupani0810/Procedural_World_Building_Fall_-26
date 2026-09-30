import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DoubleSide } from 'three'
import type { BufferGeometry } from 'three'
import type { GradientStop } from './heightGradient.ts'
import type { TerrainParams } from './terrainParams.ts'
import { extractMarchingCubesFromGrid } from './voxelExtract.ts'
import { buildGreedyInteractiveMesh, hitToVoxelIndex } from './voxelGreedyMesh.ts'
import {
  buildVoxelChunk,
  chunkKey,
  chunksAround,
  createDensityFunction,
  gridIndex,
  worldToChunk,
} from './voxelGrid.ts'
import type { ChunkCoord, VoxelGrid } from './voxelGrid.ts'
import type { VoxelParams } from './voxelParams.ts'

type Props = {
  terrain: TerrainParams
  voxel: VoxelParams
  gradient: GradientStop[]
}

type ChunkEntry = {
  key: string
  coord: ChunkCoord
  grid: VoxelGrid
  geometry: BufferGeometry
}

const STREAM_INTERVAL_MS = 120

function disposeEntry(entry: ChunkEntry) {
  entry.geometry.dispose()
}

function buildChunkEntry(
  terrain: TerrainParams,
  voxel: VoxelParams,
  gradient: GradientStop[],
  coord: ChunkCoord,
  densityAt: (x: number, y: number, z: number) => number,
): ChunkEntry {
  const grid = buildVoxelChunk(terrain, voxel, coord)
  const geometry =
    voxel.renderMode === 'marching'
      ? extractMarchingCubesFromGrid(grid, voxel.isolevel, densityAt)
      : buildGreedyInteractiveMesh(grid, voxel.isolevel, gradient, densityAt)
  return { key: chunkKey(coord), coord, grid, geometry }
}

function ChunkMesh({
  entry,
  interactive,
  voxel,
  onEdit,
}: {
  entry: ChunkEntry
  interactive: boolean
  voxel: VoxelParams
  onEdit: (key: string, densities: Float32Array) => void
}) {
  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (!interactive || !event.face) return
    event.stopPropagation()

    const normal = event.face.normal
      .clone()
      .transformDirection(event.object.matrixWorld)
      .normalize()

    const add = event.nativeEvent.shiftKey
    const target = hitToVoxelIndex(event.point, normal, entry.grid, !add)
    if (!target) return

    const idx = gridIndex(target.ix, target.iy, target.iz, entry.grid.size)
    const next = entry.grid.densities.slice()
    if (add) {
      next[idx] = Math.max(voxel.isolevel + 0.5, (next[idx] ?? 0) + 1)
    } else {
      next[idx] = Math.min(voxel.isolevel - 0.5, (next[idx] ?? 0) - 1)
    }
    onEdit(entry.key, next)
  }

  return (
    <mesh
      geometry={entry.geometry}
      onPointerDown={interactive ? handlePointerDown : undefined}
      castShadow={false}
      receiveShadow={false}
    >
      {interactive ? (
        <meshLambertMaterial vertexColors flatShading />
      ) : (
        <meshStandardMaterial vertexColors roughness={0.82} metalness={0} side={DoubleSide} />
      )}
    </mesh>
  )
}

function InfiniteVoxelWorld({ terrain, voxel, gradient }: Props) {
  const [entries, setEntries] = useState<ChunkEntry[]>([])
  const entriesRef = useRef<Map<string, ChunkEntry>>(new Map())
  const lastStreamAt = useRef(0)
  const lastCenterKey = useRef('')

  const densityAt = useMemo(
    () => createDensityFunction(terrain, voxel),
    [terrain, voxel],
  )

  const genKey = `${terrain.noiseId}|${terrain.zoom}|${terrain.height}|${terrain.layers}|${voxel.resolution}|${voxel.isolevel}|${voxel.bleed}|${voxel.volume}|${voxel.renderMode}|${voxel.loadRadius}|${gradient.map((s) => `${s.position}:${s.color}`).join(';')}`

  // Full rebuild when density / mesh inputs change
  useEffect(() => {
    for (const entry of entriesRef.current.values()) disposeEntry(entry)
    entriesRef.current.clear()
    lastCenterKey.current = ''
    setEntries([])
  }, [genKey])

  useFrame(({ camera }) => {
    const now = performance.now()
    if (now - lastStreamAt.current < STREAM_INTERVAL_MS) return
    lastStreamAt.current = now

    const center = worldToChunk(camera.position.x, camera.position.y, camera.position.z)
    const centerKey = chunkKey(center)
    const wanted = chunksAround(center, voxel.loadRadius)
    const wantedKeys = new Set(wanted.map(chunkKey))

    // Skip work if camera chunk unchanged and we already have exactly the wanted set
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
      map.set(key, buildChunkEntry(terrain, voxel, gradient, coord, densityAt))
      changed = true
    }

    if (changed) {
      setEntries(Array.from(map.values()))
    }
  })

  useEffect(
    () => () => {
      for (const entry of entriesRef.current.values()) disposeEntry(entry)
      entriesRef.current.clear()
    },
    [],
  )

  const interactive = voxel.renderMode === 'interactive'

  const handleEdit = (key: string, densities: Float32Array) => {
    const prev = entriesRef.current.get(key)
    if (!prev) return
    disposeEntry(prev)
    const grid: VoxelGrid = { ...prev.grid, densities }
    const geometry =
      voxel.renderMode === 'marching'
        ? extractMarchingCubesFromGrid(grid, voxel.isolevel, densityAt)
        : buildGreedyInteractiveMesh(grid, voxel.isolevel, gradient, densityAt)
    const next: ChunkEntry = { ...prev, grid, geometry }
    entriesRef.current.set(key, next)
    setEntries(Array.from(entriesRef.current.values()))
  }

  return (
    <>
      {entries.map((entry) => (
        <ChunkMesh
          key={entry.key}
          entry={entry}
          interactive={interactive}
          voxel={voxel}
          onEdit={handleEdit}
        />
      ))}
    </>
  )
}

export default function VoxelScene({ terrain, voxel, gradient }: Props) {
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
      <InfiniteVoxelWorld terrain={terrain} voxel={voxel} gradient={gradient} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan
        minDistance={1.4}
        maxDistance={80}
      />
    </Canvas>
  )
}
