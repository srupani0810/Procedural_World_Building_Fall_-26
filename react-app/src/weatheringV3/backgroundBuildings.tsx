import { memo, useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useThree } from '@react-three/fiber'
import { BufferGeometry, Color, Float32BufferAttribute } from 'three'
import { cellCentroid, cellCorners, gridKey, type GridCell, type GridLayout } from './epGrid.ts'
import type { BackgroundStageBias } from './epParams.ts'
import { cellFailParams, createPlasterMaterial, createWearUniforms } from './shiftWear.ts'

const STORY = 1.05
const BURY = 0.5
const PAINT = new Color('#6e3f34')
const PLASTER: [number, number, number] = [0.43, 0.25, 0.2]

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
}

function wearForBias(bias: Exclude<BackgroundStageBias, 'random'>) {
  return STAGE_WEAR[bias]
}

/** When bias is random: wear cycles by distance ring from the camera anchor. */
function wearFromDistanceRing(dist: number, near: number, far: number) {
  const t = Math.min(1, Math.max(0, (dist - near) / Math.max(1, far - near)))
  const index = Math.min(3, Math.floor(t * STAGE_ORDER.length))
  return STAGE_WEAR[STAGE_ORDER[index] ?? 'new']
}

/** Stories rise with distance from the town (farther ring → taller). */
function storiesFromDistance(dist: number, near: number, far: number, lo: number, hi: number) {
  const t = Math.min(1, Math.max(0, (dist - near) / Math.max(1, far - near)))
  return lo + Math.floor(t * (hi - lo + 1e-9))
}

/** Empty cells kept between neighborhoods so clusters do not merge into one field. */
const CLUSTER_GAP = 3

type OpenCell = { ix: number; iz: number; x: number; z: number; dist: number }

/**
 * Scenery in neighborhoods on the settlement grid — no hash rolls.
 * Origins sorted by distance then angle (Regenerate rotates the start sector).
 * Cluster size grows with distance; stories/wear from distance bands or stage bias.
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
  const reserved = new Set<string>()
  // Regenerate rotates which compass sector is preferred first (0..7).
  const sectorPrefer = ((Math.floor(settings.seed) % 8) + 8) % 8

  const spotAt = (ix: number, iz: number): OpenCell | null => {
    if (occupied(ix, iz) || reserved.has(gridKey(ix, iz))) return null
    const [x, z] = cellCentroid(ix, iz, layout)
    const dist = Math.hypot(x - anchorX, z - anchorZ)
    if (dist < near || dist > far) return null
    const corners = cellCorners(ix, iz, layout)
    if (blocked(x, z) || corners.some(([cx, cz]) => blocked(cx, cz))) return null
    return { ix, iz, x, z, dist }
  }

  const sectorOf = (ix: number, iz: number) => {
    const ang = Math.atan2(iz - anchorIz, ix - anchorIx)
    const u = (ang + Math.PI) / (Math.PI * 2)
    return Math.floor(u * 8) % 8
  }

  const seeds: OpenCell[] = []
  for (let dz = -reach; dz <= reach; dz++) {
    for (let dx = -reach; dx <= reach; dx++) {
      const spot = spotAt(anchorIx + dx, anchorIz + dz)
      if (spot) seeds.push(spot)
    }
  }
  seeds.sort((a, b) => {
    const sa = (sectorOf(a.ix, a.iz) - sectorPrefer + 8) % 8
    const sb = (sectorOf(b.ix, b.iz) - sectorPrefer + 8) % 8
    return sa - sb || a.dist - b.dist || a.iz - b.iz || a.ix - b.ix
  })

  const buildings: BackgroundBuilding[] = []
  const tried = new Set<string>()

  for (const origin of seeds) {
    if (buildings.length >= count) break
    const originKey = gridKey(origin.ix, origin.iz)
    if (tried.has(originKey) || reserved.has(originKey)) continue
    const room = count - buildings.length
    if (room < 3) break

    // Farther from town → larger block; grow along the stronger radial axis, outward.
    const band = Math.min(1, Math.max(0, (origin.dist - near) / Math.max(1, far - near)))
    const want = Math.min(room, 3 + Math.floor(band * 5))
    const rdx = origin.ix - anchorIx
    const rdz = origin.iz - anchorIz
    const alongX = Math.abs(rdx) >= Math.abs(rdz)
    const step = alongX ? (rdx >= 0 ? 1 : -1) : (rdz >= 0 ? 1 : -1)
    const side = alongX ? (rdz >= 0 ? 1 : -1) : (rdx >= 0 ? 1 : -1)
    const depth = want >= 5 ? 2 : 1
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
    const tilt = { tiltX: 0, tiltZ: -0.22 }

    for (const cell of kept) {
      const half = lotHalf(cell.ix, cell.iz, layout, 0.92)
      let floor = heightAt(cell.x, cell.z)
      for (const [cx, cz] of cellCorners(cell.ix, cell.iz, layout)) {
        floor = Math.max(floor, heightAt(cx, cz))
      }
      const wear =
        settings.stageBias === 'random'
          ? wearFromDistanceRing(cell.dist, near, far)
          : wearForBias(settings.stageBias)
      buildings.push({
        id: `${settings.seed}:${cell.ix},${cell.iz}`,
        ix: cell.ix,
        iz: cell.iz,
        x: cell.x,
        z: cell.z,
        floor,
        stories: storiesFromDistance(cell.dist, near, far, lo, hi),
        hx: half.hx,
        hz: half.hz,
        wear,
        tiltX: tilt.tiltX,
        tiltZ: tilt.tiltZ,
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
  // aEdge must stay 0 on mass faces — non-zero + rust drips reads as wood-plank stripes.
  // Metal marking is only for fail-bay hardware on claimed lots, not scenery boxes.
  const faces: Array<[number, number, number, number]> = [
    [0, 0, 1, 0],
    [0, 0, -1, 0],
    [1, 0, 0, 0],
    [-1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, -1, 0, 0],
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
    // Odd stories step back slightly — readable setback, not footprint jitter.
    const inset = s % 2 === 0 ? 1 : 0.86
    const y0 = s === 0 ? -BURY : s * STORY
    const y1 = (s + 1) * STORY
    pushBox(pos, nrm, col, edge, 0, 0, y0, y1, building.hx * inset, building.hz * inset)
  }
  const geo = new BufferGeometry()
  const count = pos.length / 3
  const noise = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const x = pos[i * 3]!
    const y = pos[i * 3 + 1]!
    const z = pos[i * 3 + 2]!
    const n =
      Math.sin(x * 127.1 + z * 311.7 + y * 74.7) * 43758.5453 +
      Math.sin(x * 269.5 + z * 183.3) * 23421.631
    noise[i] = n - Math.floor(n)
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
  const wear = useMemo(() => {
    const fail = cellFailParams(building.ix, building.iz, building.stories)
    return createWearUniforms(
      0,
      building.tiltX,
      building.tiltZ,
      PAINT,
      building.x,
      building.z,
      fail.failSide,
      fail.roofSeed,
      fail.windowSeed,
    )
  }, [building.tiltX, building.tiltZ, building.ix, building.iz, building.x, building.z, building.stories])
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
  cellsRef: MutableRefObject<Map<string, GridCell>>
  layout: GridLayout
  /** Bumped when claimed player cells change. Age ticks do not bump it. */
  settlementRevision: number
}

/** Voxel columns around the camera. Not part of the click-to-build grid. */
export function BackgroundBuildings({
  settings,
  heightAt,
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
      () => false,
      (ix, iz) => cellsRef.current.has(gridKey(ix, iz)),
    )
  }, [settings, settingsKey, layout, heightAt, cellsRef, settlementRevision])

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
