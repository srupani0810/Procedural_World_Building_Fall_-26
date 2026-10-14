import { memo, useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useThree } from '@react-three/fiber'
import { BufferGeometry, Color, Float32BufferAttribute } from 'three'
import { cellCentroid, cellCorners, gridKey, type GridCell, type GridLayout } from './epGrid.ts'
import type { BackgroundStageBias } from './epParams.ts'
import { createPlasterMaterial, createWearUniforms } from './shiftWear.ts'
import { waterMaskAt, type WaterMask } from './waterMask.ts'

const STORY = 1.05
const BURY = 0.5
const PAINT = new Color('#343a42')
const PLASTER: [number, number, number] = [0.16, 0.17, 0.19]

const STAGE_WEAR: Record<Exclude<BackgroundStageBias, 'random'>, number> = {
  new: 0.15,
  settled: 1.35,
  abandoned: 2.2,
  reclaimed: 3,
}

const STAGE_ORDER: Array<Exclude<BackgroundStageBias, 'random'>> = [
  'new',
  'settled',
  'abandoned',
  'reclaimed',
]

export type BackgroundSettings = {
  density: number
  minDistance: number
  maxDistance: number
  minStories: number
  maxStories: number
  stageBias: BackgroundStageBias
  seed: number
  /** Same role as Grid building scale: multiplies story height. Default ×3. */
  buildingScale: number
}

type BackgroundBuilding = {
  id: string
  ix: number
  iz: number
  x: number
  z: number
  floor: number
  stories: number
  hx: number
  hz: number
  wear: number
  tiltX: number
  tiltZ: number
  phase: number
}

function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

function wearFor(bias: BackgroundStageBias, roll: number) {
  if (bias === 'random') return STAGE_WEAR[STAGE_ORDER[Math.floor(roll * STAGE_ORDER.length)] ?? 'new']
  return STAGE_WEAR[bias]
}

/** Empty cells kept between neighborhoods so clusters do not merge into one field. */
const CLUSTER_GAP = 3

type OpenCell = { ix: number; iz: number; x: number; z: number }

function clusterWear(bias: BackgroundStageBias, clusterRoll: number, memberRoll: number) {
  if (bias !== 'random') return wearFor(bias, memberRoll)
  const base = Math.min(3, Math.floor(clusterRoll * STAGE_ORDER.length))
  const drift = hash(clusterRoll * 90 + 4) > 0.5 ? 1 : -1
  const index = memberRoll < 0.8 ? base : Math.min(3, Math.max(0, base + drift))
  return STAGE_WEAR[STAGE_ORDER[index] ?? 'new']
}

function clusterStories(lo: number, hi: number, clusterRoll: number, memberRoll: number) {
  const base = lo + Math.floor(clusterRoll * (hi - lo + 1))
  if (hi === lo || memberRoll < 0.8) return base
  const drift = hash(clusterRoll * 40 + 2) > 0.5 ? 1 : -1
  return Math.min(hi, Math.max(lo, base + drift))
}

/**
 * Scenery in neighborhoods of 3–8 lots on the settlement grid.
 * The grid warp already bends each block. A claimed player cell is skipped.
 */
export function generateBackgroundBuildings(
  settings: BackgroundSettings,
  anchorX: number,
  anchorZ: number,
  layout: GridLayout,
  heightAt: (x: number, z: number) => number,
  blocked: (x: number, z: number) => boolean,
  occupied: (ix: number, iz: number) => boolean,
): BackgroundBuilding[] {
  const count = Math.max(0, Math.round(settings.density))
  if (count === 0) return []
  const near = Math.min(settings.minDistance, settings.maxDistance)
  const far = Math.max(settings.minDistance, settings.maxDistance, near + 1)
  const lo = Math.max(1, Math.round(Math.min(settings.minStories, settings.maxStories)))
  const hi = Math.max(lo, Math.round(Math.max(settings.minStories, settings.maxStories)))
  const size = Math.max(0.4, layout.cellSize)
  const anchorIx = Math.round(anchorX / size)
  const anchorIz = Math.round(anchorZ / size)
  const reach = Math.ceil(far / size) + 1
  const seed = settings.seed * 17.13
  const reserved = new Set<string>()

  const spotAt = (ix: number, iz: number): OpenCell | null => {
    if (occupied(ix, iz) || reserved.has(gridKey(ix, iz))) return null
    const [x, z] = cellCentroid(ix, iz, layout)
    const dist = Math.hypot(x - anchorX, z - anchorZ)
    if (dist < near || dist > far) return null
    const corners = cellCorners(ix, iz, layout)
    if (blocked(x, z) || corners.some(([cx, cz]) => blocked(cx, cz))) return null
    return { ix, iz, x, z }
  }

  const seeds: Array<OpenCell & { rank: number }> = []
  for (let dz = -reach; dz <= reach; dz++) {
    for (let dx = -reach; dx <= reach; dx++) {
      const spot = spotAt(anchorIx + dx, anchorIz + dz)
      if (!spot) continue
      seeds.push({ ...spot, rank: hash(seed + spot.ix * 19.1 + spot.iz * 23.7) })
    }
  }
  seeds.sort((a, b) => a.rank - b.rank || a.ix - b.ix || a.iz - b.iz)

  const buildings: BackgroundBuilding[] = []
  const tried = new Set<string>()

  for (const origin of seeds) {
    if (buildings.length >= count) break
    const originKey = gridKey(origin.ix, origin.iz)
    if (tried.has(originKey) || reserved.has(originKey)) continue
    const room = count - buildings.length
    if (room < 3) break

    const roll = hash(seed + origin.ix * 13.7 + origin.iz * 9.1)
    const want = 3 + Math.floor(hash(seed + origin.ix * 3.3 + origin.iz) * Math.min(6, room - 2))
    const alongX = roll > 0.5
    const step = hash(seed + origin.iz * 4.4) > 0.5 ? 1 : -1
    const side = hash(seed + origin.ix * 4.4) > 0.5 ? 1 : -1
    const depth = want >= 5 && hash(seed + want + origin.ix) > 0.35 ? 2 : 1
    const length = depth === 1 ? want : Math.ceil(want / depth)
    const cells: OpenCell[] = []

    for (let lengthIndex = 0; lengthIndex < length && cells.length < want; lengthIndex++) {
      const row: OpenCell[] = []
      let solid = true
      for (let depthIndex = 0; depthIndex < depth; depthIndex++) {
        const ix = alongX ? origin.ix + lengthIndex * step : origin.ix + depthIndex * side
        const iz = alongX ? origin.iz + depthIndex * side : origin.iz + lengthIndex * step
        const spot = spotAt(ix, iz)
        if (!spot) {
          solid = false
          break
        }
        row.push(spot)
      }
      if (!solid) break
      cells.push(...row)
    }

    if (cells.length < 3) {
      tried.add(originKey)
      continue
    }

    const kept = cells.slice(0, want)
    const clusterRoll = hash(seed + origin.ix * 41 + origin.iz * 17)
    const tiltX = (hash(seed + origin.ix * 5) - 0.5) * 0.05
    const tiltZ = (hash(seed + origin.iz * 5) - 0.5) * 0.05
    const phase = hash(seed + origin.ix * 8 + origin.iz)

    for (const cell of kept) {
      const member = hash(seed + cell.ix * 11.3 + cell.iz * 7.1)
      const fit = 0.9 + hash(seed + cell.ix * 1.7 + cell.iz) * 0.04
      const half = lotHalf(cell.ix, cell.iz, layout, fit)
      let floor = heightAt(cell.x, cell.z)
      for (const [cx, cz] of cellCorners(cell.ix, cell.iz, layout)) {
        floor = Math.max(floor, heightAt(cx, cz))
      }
      buildings.push({
        id: `${settings.seed}:${cell.ix},${cell.iz}`,
        ix: cell.ix,
        iz: cell.iz,
        x: cell.x,
        z: cell.z,
        floor,
        stories: clusterStories(lo, hi, clusterRoll, member),
        hx: half.hx,
        hz: half.hz,
        wear: clusterWear(settings.stageBias, hash(seed + origin.ix * 29 + origin.iz), member),
        tiltX: tiltX + (member - 0.5) * 0.012,
        tiltZ: tiltZ + (hash(seed + cell.iz) - 0.5) * 0.012,
        phase,
      })
      for (let gz = -CLUSTER_GAP; gz <= CLUSTER_GAP; gz++) {
        for (let gx = -CLUSTER_GAP; gx <= CLUSTER_GAP; gx++) {
          reserved.add(gridKey(cell.ix + gx, cell.iz + gz))
        }
      }
    }
  }

  return buildings
}

/** Axis-aligned half extents of the lot, inset slightly so neighbors meet without crossing. */
function lotHalf(ix: number, iz: number, layout: GridLayout, fit: number) {
  const [cx, cz] = cellCentroid(ix, iz, layout)
  let hx = 0
  let hz = 0
  for (const [x, z] of cellCorners(ix, iz, layout)) {
    hx = Math.max(hx, Math.abs(x - cx))
    hz = Math.max(hz, Math.abs(z - cz))
  }
  return { hx: hx * fit, hz: hz * fit }
}

function pushBox(
  pos: number[],
  nrm: number[],
  col: number[],
  edge: number[],
  ox: number,
  oz: number,
  y0: number,
  y1: number,
  hx: number,
  hz: number,
) {
  const faces: Array<[number, number, number, number]> = [
    [0, 0, 1, 0.9],
    [0, 0, -1, 0.9],
    [1, 0, 0, 0.9],
    [-1, 0, 0, 0.9],
    [0, 1, 0, 0.15],
    [0, -1, 0, 0.2],
  ]
  const corners: Array<[number, number, number]> = [
    [ox - hx, y0, oz - hz],
    [ox + hx, y0, oz - hz],
    [ox + hx, y0, oz + hz],
    [ox - hx, y0, oz + hz],
    [ox - hx, y1, oz - hz],
    [ox + hx, y1, oz - hz],
    [ox + hx, y1, oz + hz],
    [ox - hx, y1, oz + hz],
  ]
  const quads = [
    [1, 2, 6, 5],
    [3, 0, 4, 7],
    [2, 3, 7, 6],
    [0, 1, 5, 4],
    [4, 5, 6, 7],
    [3, 2, 1, 0],
  ]
  for (let f = 0; f < 6; f++) {
    const face = faces[f]!
    const [nx, ny, nz, mark] = face
    const quad = quads[f]!
    for (const k of [quad[0]!, quad[1]!, quad[2]!, quad[0]!, quad[2]!, quad[3]!]) {
      const p = corners[k]!
      pos.push(p[0], p[1], p[2])
      nrm.push(nx, ny, nz)
      col.push(PLASTER[0], PLASTER[1], PLASTER[2])
      edge.push(mark)
    }
  }
}

function columnGeometry(building: BackgroundBuilding) {
  const pos: number[] = []
  const nrm: number[] = []
  const col: number[] = []
  const edge: number[] = []
  for (let s = 0; s < building.stories; s++) {
    const inset = s % 2 === 0 ? 1 : 0.86
    const jx = (hash(building.phase * 20 + s * 4.1) - 0.5) * 0.08
    const jz = (hash(building.phase * 20 + s * 6.3) - 0.5) * 0.08
    const y0 = s === 0 ? -BURY : s * STORY
    const y1 = (s + 1) * STORY
    pushBox(pos, nrm, col, edge, jx, jz, y0, y1, building.hx * inset, building.hz * inset)
  }
  const geo = new BufferGeometry()
  const count = pos.length / 3
  const noise = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    noise[i] = hash(pos[i * 3]! * 10 + pos[i * 3 + 2]! * 4 + pos[i * 3 + 1]!)
  }
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
  geo.setAttribute('normal', new Float32BufferAttribute(nrm, 3))
  geo.setAttribute('color', new Float32BufferAttribute(col, 3))
  geo.setAttribute('aEdge', new Float32BufferAttribute(edge, 1))
  geo.setAttribute('aNoise', new Float32BufferAttribute(noise, 1))
  geo.setAttribute('aDrape', new Float32BufferAttribute(new Float32Array(count * 3), 3))
  return geo
}

const BackgroundColumn = memo(function BackgroundColumn({
  building,
  buildingScale,
}: {
  building: BackgroundBuilding
  buildingScale: number
}) {
  const geo = useMemo(() => columnGeometry(building), [building])
  const wear = useMemo(
    () => createWearUniforms(0, building.tiltX, building.tiltZ, PAINT),
    [building.tiltX, building.tiltZ],
  )
  const material = useMemo(() => {
    wear.uWear.value = building.wear
    wear.uWearIntensity.value = 1
    const mat = createPlasterMaterial(wear)
    mat.fog = true
    return mat
  }, [wear, building.wear])

  useEffect(
    () => () => {
      geo.dispose()
      material.dispose()
    },
    [geo, material],
  )

  return (
    <mesh
      name={`bg-${building.ix},${building.iz}`}
      geometry={geo}
      material={material}
      position={[building.x, building.floor, building.z]}
      scale={[1, buildingScale, 1]}
      raycast={() => null}
    />
  )
})

type Props = {
  settings: BackgroundSettings
  heightAt: (x: number, z: number) => number
  waterMask: WaterMask
  cellsRef: MutableRefObject<Map<string, GridCell>>
  layout: GridLayout
  /** Bumped when claimed player cells change. Age ticks do not bump it. */
  settlementRevision: number
}

/** Voxel columns around the camera. Not part of the click-to-build grid. */
export function BackgroundBuildings({
  settings,
  heightAt,
  waterMask,
  cellsRef,
  layout,
  settlementRevision,
}: Props) {
  const camera = useThree((state) => state.camera)
  const anchorRef = useRef({ x: camera.position.x, z: camera.position.z })
  const settingsKey = [
    settings.density,
    settings.minDistance,
    settings.maxDistance,
    settings.minStories,
    settings.maxStories,
    settings.stageBias,
    settings.seed,
    layout.cellSize,
    layout.warp,
  ].join('|')
  const settingsKeyRef = useRef<string | null>(null)
  if (settingsKeyRef.current !== settingsKey) {
    settingsKeyRef.current = settingsKey
    anchorRef.current = { x: camera.position.x, z: camera.position.z }
  }
  const buildings = useMemo(() => {
    void settlementRevision
    return generateBackgroundBuildings(
      settings,
      anchorRef.current.x,
      anchorRef.current.z,
      layout,
      heightAt,
      (x, z) => waterMaskAt(waterMask, x, z) === 1,
      (ix, iz) => cellsRef.current.has(gridKey(ix, iz)),
    )
  }, [settings, settingsKey, layout, heightAt, waterMask, cellsRef, settlementRevision])

  return (
    <group name="background-buildings">
      {buildings.map((building) => (
        <BackgroundColumn
          key={building.id}
          building={building}
          buildingScale={Math.max(0.2, settings.buildingScale)}
        />
      ))}
    </group>
  )
}
