import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  FogExp2,
  LineBasicMaterial,
  MeshBasicMaterial,
  type ShaderMaterial,
} from 'three'
import { FirstPersonControls } from './FirstPersonControls.tsx'
import type { EpParams } from './epParams.ts'
import { EP_FOG_COLOR, EP_GRAY_GRADIENT } from './epParams.ts'
import type { GradientStop } from './heightGradient.ts'
import { createStudyMaterial } from './shaderStudies.ts'
import { createNoise, terrainAmplitude, type TerrainParams } from './terrainParams.ts'
import { buildGreedyInteractiveMesh } from './voxelGreedyMesh.ts'
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
const NEON_COLORS = ['#f0f0f0', '#c8c8c8', '#9a9a9a', '#e8e8e8']
const EP_MESH_GRADIENT: GradientStop[] = EP_GRAY_GRADIENT.map((stop) => ({ ...stop }))

function disposeEntry(entry: ChunkEntry) {
  entry.geometry.dispose()
}

function hash2(ix: number, iz: number, salt: number) {
  const n = Math.sin(ix * 127.1 + iz * 311.7 + salt * 74.7) * 43758.5453
  return n - Math.floor(n)
}

/** Prefer Interactive greedy mesh for blocky cyberpunk terrain; reuse builders. */
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

function GlitchTerrainChunks({
  terrain,
  voxel,
  gradient,
  glitchIntensity,
  onEntries,
}: {
  terrain: TerrainParams
  voxel: VoxelParams
  gradient: GradientStop[]
  glitchIntensity: number
  onEntries: (entries: ChunkEntry[]) => void
}) {
  const [entries, setEntries] = useState<ChunkEntry[]>([])
  const entriesRef = useRef<Map<string, ChunkEntry>>(new Map())
  const lastStreamAt = useRef(0)
  const lastCenterKey = useRef('')
  const materialRef = useRef<ShaderMaterial | null>(null)

  const densityAt = useMemo(
    () => createDensityFunction(terrain, voxel),
    [terrain, voxel],
  )

  const material = useMemo(() => {
    const mat = createStudyMaterial('glitch', { glitchIntensity, grayscale: true })
    materialRef.current = mat
    return mat
  }, [])

  useEffect(() => {
    if (material.uniforms.uGlitch) {
      material.uniforms.uGlitch.value = glitchIntensity
    }
  }, [material, glitchIntensity])

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
        <mesh
          key={entry.key}
          geometry={entry.geometry}
          material={material}
          frustumCulled={false}
        />
      ))}
    </>
  )
}

type NeonMark = { x: number; y: number; z: number; color: string; s: number }
type Peak = { x: number; y: number; z: number }

function CyberDecor({
  entries,
  terrain,
  neonDensity,
  isolevel,
}: {
  entries: ChunkEntry[]
  terrain: TerrainParams
  neonDensity: number
  isolevel: number
}) {
  const sample = useMemo(() => createNoise(terrain), [terrain])
  const heightScale = terrainAmplitude(terrain)

  const { neons, cablePositions } = useMemo(() => {
    const marks: NeonMark[] = []
    const peaks: Peak[] = []
    const density = Math.max(0, Math.min(1, neonDensity))

    for (const entry of entries) {
      const { grid, coord } = entry
      const { size, densities, cellSize, origin } = grid
      // Sample a sparse subset of cells for neon signs
      const stride = Math.max(1, Math.round(size / (2 + density * 6)))
      for (let iz = 0; iz < size; iz += stride) {
        for (let ix = 0; ix < size; ix += stride) {
          // Find highest solid in column
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
          // Prefer near-surface tops
          if (Math.abs(wy - surface) > cellSize * 2.5) continue

          const h = hash2(coord.cx * size + ix, coord.cz * size + iz, 1)
          if (h < density * 0.55) {
            marks.push({
              x: wx,
              y: wy + cellSize * 0.35,
              z: wz,
              color: NEON_COLORS[Math.floor(hash2(ix, iz, 2) * NEON_COLORS.length)]!,
              s: cellSize * (0.35 + hash2(ix, iz, 3) * 0.45),
            })
          }
          if (h > 0.72 && wy > surface * 0.2) {
            peaks.push({ x: wx, y: wy + cellSize * 0.5, z: wz })
          }
        }
      }
    }

    // Vertical glowing cables between nearby tall peaks
    const cableVerts: number[] = []
    const maxDist = 3.2
    for (let i = 0; i < peaks.length; i++) {
      const a = peaks[i]!
      let best: Peak | null = null
      let bestD = maxDist
      for (let j = i + 1; j < peaks.length; j++) {
        const b = peaks[j]!
        const d = Math.hypot(a.x - b.x, a.z - b.z)
        if (d < bestD && d > 0.4) {
          bestD = d
          best = b
        }
      }
      if (!best) continue
      // Thin vertical runs up from each peak then a span — reads as cable/utility lines
      const midY = Math.max(a.y, best.y) + 0.55 + hash2(i, 0, 9) * 0.4
      cableVerts.push(a.x, a.y, a.z, a.x, midY, a.z)
      cableVerts.push(a.x, midY, a.z, best.x, midY, best.z)
      cableVerts.push(best.x, midY, best.z, best.x, best.y, best.z)
    }

    return { neons: marks, cablePositions: cableVerts }
  }, [entries, neonDensity, isolevel, sample, heightScale])

  const cableGeo = useMemo(() => {
    const geo = new BufferGeometry()
    if (cablePositions.length > 0) {
      geo.setAttribute('position', new Float32BufferAttribute(cablePositions, 3))
    }
    return geo
  }, [cablePositions])

  const cableMat = useMemo(
    () =>
      new LineBasicMaterial({
        color: '#cfcfcf',
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      }),
    [],
  )

  useEffect(() => {
    return () => {
      cableGeo.dispose()
      cableMat.dispose()
    }
  }, [cableGeo, cableMat])

  const neonMatCache = useMemo(() => {
    const map = new Map<string, MeshBasicMaterial>()
    for (const c of NEON_COLORS) {
      map.set(
        c,
        new MeshBasicMaterial({
          color: c,
          toneMapped: false,
        }),
      )
    }
    return map
  }, [])

  useEffect(() => {
    return () => {
      for (const m of neonMatCache.values()) m.dispose()
    }
  }, [neonMatCache])

  return (
    <>
      {neons.map((n, i) => (
        <mesh
          key={`neon-${i}`}
          position={[n.x, n.y, n.z]}
          material={neonMatCache.get(n.color)}
        >
          <boxGeometry args={[n.s, n.s * 0.55, n.s * 0.35]} />
        </mesh>
      ))}
      {cablePositions.length > 0 ? (
        <lineSegments geometry={cableGeo} material={cableMat} />
      ) : null}
    </>
  )
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
      camera={{ position: [4.5, 2.6, 4.5], fov: 50, near: 0.05, far: 200 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
    >
      <color attach="background" args={[EP_FOG_COLOR]} />
      <FogController density={ep.fogDensity} color={EP_FOG_COLOR} />
      <ambientLight intensity={0.28} />
      <directionalLight position={[4, 7, 2]} intensity={0.65} color="#d0d0d0" />
      <pointLight position={[2, 3, 2]} intensity={0.55} color="#f5f5f5" distance={12} />
      <GlitchTerrainChunks
        terrain={terrain}
        voxel={voxel}
        gradient={EP_MESH_GRADIENT}
        glitchIntensity={ep.glitchIntensity}
        onEntries={onEntries}
      />
      <CyberDecor
        entries={entries}
        terrain={terrain}
        neonDensity={ep.neonDensity}
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
