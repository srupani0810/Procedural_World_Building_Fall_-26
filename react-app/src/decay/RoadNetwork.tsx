/**
 * Editable road graph draped on the noise heightfield.
 * Tiered roads, sidewalks, setbacks, plots + building layer.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Object3D,
  Plane,
  Raycaster,
  Vector2,
  Vector3,
  type Camera,
  type InstancedMesh,
} from 'three'
import { createNoise, terrainAmplitude, type TerrainParams } from '../terrainParams.ts'
import type { HeightFn } from './directionField.ts'
import {
  buildMorphology,
  edgeHalfWidth,
  emptyMorphCache,
  type MorphCache,
} from './morphology.ts'
import { BuildingLayer } from './BuildingLayer.tsx'
import type { BuildingHoverInfo } from './buildings.ts'
import type { PlayerClaim } from './claims.ts'
import type { FieldMaps } from './fields.ts'
import {
  assignLandUse,
  LAND_USE_COLORS,
  type LandUse,
  type LandUseViewMode,
  type PlotLandUse,
} from './landUse.ts'
import type { MaterialityParams } from './materiality.ts'
import type {
  BuildingParams,
  DecaySelection,
  DecayViewParams,
  RoadCensus,
  RoadNetworkParams,
} from './params.ts'
import type { AbsenceClockParams, StageCounts } from './timeline.ts'
import { DECAY_MORPH } from './params.ts'
import { plotQuads } from './plots.ts'
import {
  buildGridGraph,
  closestPointOnEdge,
  connectNodes,
  deleteEdge,
  deleteNode,
  emptyGraph,
  getNode,
  insertNodeOnEdge,
  moveNode,
  pickNearest,
  type RoadGraph,
} from './roadGraph.ts'

export function makeHeightAt(terrain: TerrainParams): HeightFn {
  const sample = createNoise(terrain)
  const scale = terrainAmplitude(terrain)
  return (x, z) => sample(x, z) * scale + 0.25
}

const SAMPLE_STEP = 1.05
const SMOOTH_PASSES = 4
const LIFT = 0.62
const WALK_LIFT = 0.52
const PLOT_LIFT = 0.48
const LINE_LIFT = 0.56

type Sample = { x: number; y: number; z: number }
type Rgb = [number, number, number]

function hexRgb(hex: string): Rgb {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ]
}

const RGB_MAIN = hexRgb(DECAY_MORPH.main)
const RGB_COLL = hexRgb(DECAY_MORPH.collector)
const RGB_LOCAL = hexRgb(DECAY_MORPH.local)
const RGB_WALK = hexRgb(DECAY_MORPH.sidewalk)
const RGB_PLOT = hexRgb(DECAY_MORPH.plot)
const RGB_CORNER = hexRgb(DECAY_MORPH.cornerPlot)
const RGB_OPEN = hexRgb(DECAY_MORPH.openPlot)
const RGB_BL = hexRgb(DECAY_MORPH.buildingLine)
const RGB_LAND: Record<LandUse, Rgb> = {
  industry: hexRgb(LAND_USE_COLORS.industry),
  commerce: hexRgb(LAND_USE_COLORS.commerce),
  housing: hexRgb(LAND_USE_COLORS.housing),
  civic: hexRgb(LAND_USE_COLORS.civic),
  park: hexRgb(LAND_USE_COLORS.park),
  farm: hexRgb(LAND_USE_COLORS.farm),
  yard: hexRgb(LAND_USE_COLORS.yard),
}

function sampleEdge(a: { x: number; z: number }, b: { x: number; z: number }, heightAt: HeightFn): Sample[] {
  const len = Math.hypot(b.x - a.x, b.z - a.z)
  const n = Math.max(2, Math.ceil(len / SAMPLE_STEP) + 1)
  const pts: Sample[] = []
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const x = a.x + (b.x - a.x) * t
    const z = a.z + (b.z - a.z) * t
    pts.push({ x, y: heightAt(x, z) + LIFT, z })
  }
  for (let p = 0; p < SMOOTH_PASSES; p++) {
    const ys = pts.map((s) => s.y)
    for (let i = 1; i < pts.length - 1; i++) {
      pts[i]!.y = ys[i - 1]! * 0.25 + ys[i]! * 0.5 + ys[i + 1]! * 0.25
    }
  }
  return pts
}

function pushBand(
  pos: number[],
  nrm: number[],
  col: number[],
  samples: Sample[],
  inner: number,
  outer: number,
  rgb: Rgb,
  yLift = 0,
) {
  if (samples.length < 2 || outer <= inner + 1e-4) return
  const leftI: Sample[] = []
  const leftO: Sample[] = []
  const rightI: Sample[] = []
  const rightO: Sample[] = []
  for (let i = 0; i < samples.length; i++) {
    const p = samples[i]!
    const prev = samples[Math.max(0, i - 1)]!
    const next = samples[Math.min(samples.length - 1, i + 1)]!
    let tx = next.x - prev.x
    let tz = next.z - prev.z
    const tl = Math.hypot(tx, tz) || 1
    tx /= tl
    tz /= tl
    const nx = -tz
    const nz = tx
    const y = p.y + yLift
    leftI.push({ x: p.x + nx * inner, y, z: p.z + nz * inner })
    leftO.push({ x: p.x + nx * outer, y, z: p.z + nz * outer })
    rightI.push({ x: p.x - nx * inner, y, z: p.z - nz * inner })
    rightO.push({ x: p.x - nx * outer, y, z: p.z - nz * outer })
  }
  const pushQuad = (a: Sample, b: Sample, c: Sample, d: Sample) => {
    const ax = b.x - a.x
    const ay = b.y - a.y
    const az = b.z - a.z
    const bx = d.x - a.x
    const by = d.y - a.y
    const bz = d.z - a.z
    let nx = ay * bz - az * by
    let ny = az * bx - ax * bz
    let nz = ax * by - ay * bx
    const nl = Math.hypot(nx, ny, nz) || 1
    nx /= nl
    ny /= nl
    nz /= nl
    if (ny < 0) {
      nx = -nx
      ny = -ny
      nz = -nz
    }
    for (const v of [a, b, c, a, c, d]) {
      pos.push(v.x, v.y, v.z)
      nrm.push(nx, ny, nz)
      col.push(rgb[0], rgb[1], rgb[2])
    }
  }
  for (let i = 0; i < samples.length - 1; i++) {
    pushQuad(leftI[i]!, leftO[i]!, leftO[i + 1]!, leftI[i + 1]!)
    pushQuad(rightI[i]!, rightI[i + 1]!, rightO[i + 1]!, rightO[i]!)
  }
}

function pushRoadStrip(
  pos: number[],
  nrm: number[],
  col: number[],
  samples: Sample[],
  halfW: number,
  rgb: Rgb,
) {
  if (samples.length < 2) return
  const left: Sample[] = []
  const right: Sample[] = []
  for (let i = 0; i < samples.length; i++) {
    const p = samples[i]!
    const prev = samples[Math.max(0, i - 1)]!
    const next = samples[Math.min(samples.length - 1, i + 1)]!
    let tx = next.x - prev.x
    let tz = next.z - prev.z
    const tl = Math.hypot(tx, tz) || 1
    tx /= tl
    tz /= tl
    left.push({ x: p.x - tz * halfW, y: p.y, z: p.z + tx * halfW })
    right.push({ x: p.x + tz * halfW, y: p.y, z: p.z - tx * halfW })
  }
  for (let i = 0; i < samples.length - 1; i++) {
    const l0 = left[i]!
    const r0 = right[i]!
    const l1 = left[i + 1]!
    const r1 = right[i + 1]!
    const ax = r0.x - l0.x
    const ay = r0.y - l0.y
    const az = r0.z - l0.z
    const bx = l1.x - l0.x
    const by = l1.y - l0.y
    const bz = l1.z - l0.z
    let nx = ay * bz - az * by
    let ny = az * bx - ax * bz
    let nz = ax * by - ay * bx
    const nl = Math.hypot(nx, ny, nz) || 1
    nx /= nl
    ny /= nl
    nz /= nl
    if (ny < 0) {
      nx = -nx
      ny = -ny
      nz = -nz
    }
    for (const v of [l0, r0, r1, l0, r1, l1]) {
      pos.push(v.x, v.y, v.z)
      nrm.push(nx, ny, nz)
      col.push(rgb[0], rgb[1], rgb[2])
    }
  }
}

function tierRgb(tier: 'main' | 'collector' | 'local'): Rgb {
  if (tier === 'main') return RGB_MAIN
  if (tier === 'collector') return RGB_COLL
  return RGB_LOCAL
}

function buildRoadMesh(graph: RoadGraph, heightAt: HeightFn, roads: RoadNetworkParams) {
  const pos: number[] = []
  const nrm: number[] = []
  const col: number[] = []
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  for (const e of graph.edges) {
    const a = byId.get(e.nodeA)
    const b = byId.get(e.nodeB)
    if (!a || !b) continue
    const half = edgeHalfWidth(e, roads)
    pushRoadStrip(pos, nrm, col, sampleEdge(a, b, heightAt), half, tierRgb(e.tier))
  }
  // Corner fillets at junctions (degree ≥ 3)
  const deg = new Map<number, number>()
  for (const n of graph.nodes) deg.set(n.id, 0)
  for (const e of graph.edges) {
    deg.set(e.nodeA, (deg.get(e.nodeA) ?? 0) + 1)
    deg.set(e.nodeB, (deg.get(e.nodeB) ?? 0) + 1)
  }
  const r = Math.max(0, roads.cornerRadius)
  if (r > 0.05) {
    const segs = 10
    for (const n of graph.nodes) {
      if ((deg.get(n.id) ?? 0) < 3) continue
      const y = heightAt(n.x, n.z) + LIFT + 0.01
      const rgb = RGB_MAIN
      for (let i = 0; i < segs; i++) {
        const a0 = (i / segs) * Math.PI * 2
        const a1 = ((i + 1) / segs) * Math.PI * 2
        const p0 = { x: n.x, y, z: n.z }
        const p1 = { x: n.x + Math.cos(a0) * r, y, z: n.z + Math.sin(a0) * r }
        const p2 = { x: n.x + Math.cos(a1) * r, y, z: n.z + Math.sin(a1) * r }
        for (const v of [p0, p1, p2]) {
          pos.push(v.x, v.y, v.z)
          nrm.push(0, 1, 0)
          col.push(rgb[0], rgb[1], rgb[2])
        }
      }
    }
  }
  const geo = new BufferGeometry()
  if (pos.length === 0) return geo
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
  geo.setAttribute('normal', new Float32BufferAttribute(nrm, 3))
  geo.setAttribute('color', new Float32BufferAttribute(col, 3))
  geo.computeBoundingSphere()
  return geo
}

function buildSidewalkMesh(graph: RoadGraph, heightAt: HeightFn, roads: RoadNetworkParams) {
  const pos: number[] = []
  const nrm: number[] = []
  const col: number[] = []
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const walk = Math.max(0, roads.sidewalkWidth)
  if (walk < 0.05) return new BufferGeometry()
  for (const e of graph.edges) {
    const a = byId.get(e.nodeA)
    const b = byId.get(e.nodeB)
    if (!a || !b) continue
    const half = edgeHalfWidth(e, roads)
    const samples = sampleEdge(a, b, heightAt).map((s) => ({
      ...s,
      y: heightAt(s.x, s.z) + WALK_LIFT,
    }))
    pushBand(pos, nrm, col, samples, half, half + walk, RGB_WALK, 0)
  }
  const geo = new BufferGeometry()
  if (pos.length === 0) return geo
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
  geo.setAttribute('normal', new Float32BufferAttribute(nrm, 3))
  geo.setAttribute('color', new Float32BufferAttribute(col, 3))
  geo.computeBoundingSphere()
  return geo
}

function pushRingTris(
  pos: number[],
  nrm: number[],
  col: number[],
  quads: { x: number; y: number; z: number }[][],
  rgb: Rgb,
) {
  for (const q of quads) {
    const a = q[0]!
    const b = q[1]!
    const c = q[2]!
    const d = q[3]!
    for (const tri of [
      [a, b, c],
      [a, c, d],
    ] as const) {
      const [p0, p1, p2] = tri
      const ax = p1.x - p0.x
      const ay = p1.y - p0.y
      const az = p1.z - p0.z
      const bx = p2.x - p0.x
      const by = p2.y - p0.y
      const bz = p2.z - p0.z
      let nx = ay * bz - az * by
      let ny = az * bx - ax * bz
      let nz = ax * by - ay * bx
      const nl = Math.hypot(nx, ny, nz) || 1
      nx /= nl
      ny /= nl
      nz /= nl
      if (ny < 0) {
        nx = -nx
        ny = -ny
        nz = -nz
      }
      for (const v of [p0, p1, p2]) {
        pos.push(v.x, v.y, v.z)
        nrm.push(nx, ny, nz)
        col.push(rgb[0], rgb[1], rgb[2])
      }
    }
  }
}

function farmStripeRgb(x: number, z: number): Rgb {
  const band = Math.floor((x + z) / 3.2)
  const on = ((band % 2) + 2) % 2 === 0
  const base = RGB_LAND.farm
  if (on) return base
  return [base[0]! * 0.72, base[1]! * 0.78, base[2]! * 0.55]
}

function buildPlotMeshes(
  morph: ReturnType<typeof buildMorphology>,
  heightAt: HeightFn,
  view: DecayViewParams,
  landById?: ReadonlyMap<number, PlotLandUse>,
) {
  const pos: number[] = []
  const nrm: number[] = []
  const col: number[] = []
  const linePos: number[] = []

  for (const plot of morph.plots) {
    const lu = landById?.get(plot.id)
    const isPark = lu?.use === 'park'
    const isFarm = lu?.use === 'farm'
    const isOpen = plot.open && view.showOpenPlots
    const isCorner = plot.corner && view.showCornerPlots
    // Always draw park/farm ground cover; other plots follow showPlots flags.
    if (!isPark && !isFarm && !view.showPlots && !isOpen && !isCorner) continue

    const quads = plotQuads(plot.ring, heightAt, PLOT_LIFT)
    if (isFarm) {
      for (const q of quads) {
        const cx = (q[0]!.x + q[1]!.x + q[2]!.x + q[3]!.x) * 0.25
        const cz = (q[0]!.z + q[1]!.z + q[2]!.z + q[3]!.z) * 0.25
        pushRingTris(pos, nrm, col, [q], farmStripeRgb(cx, cz))
      }
    } else {
      let rgb = RGB_PLOT
      if (lu) rgb = RGB_LAND[lu.use]
      else if (isOpen) rgb = RGB_OPEN
      else if (isCorner) rgb = RGB_CORNER
      pushRingTris(pos, nrm, col, quads, rgb)
    }

    if (view.showBuildingLine && plot.buildingLine.length >= 2 && !isPark && !isFarm) {
      const ring = plot.buildingLine
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i]!
        const b = ring[(i + 1) % ring.length]!
        linePos.push(a.x, heightAt(a.x, a.z) + LINE_LIFT, a.z, b.x, heightAt(b.x, b.z) + LINE_LIFT, b.z)
      }
    }
  }

  const geo = new BufferGeometry()
  if (pos.length > 0) {
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
    geo.setAttribute('normal', new Float32BufferAttribute(nrm, 3))
    geo.setAttribute('color', new Float32BufferAttribute(col, 3))
    geo.computeBoundingSphere()
  }
  const lineGeo = new BufferGeometry()
  if (linePos.length > 0) {
    lineGeo.setAttribute('position', new Float32BufferAttribute(linePos, 3))
  }
  return { geo, lineGeo }
}

function appendLog(prev: string[], extra: string[]) {
  const next = [...prev, ...extra]
  return next.length > 600 ? next.slice(next.length - 600) : next
}

/** Screen-pixel threshold: smaller move = click, larger = camera drag. */
const CLICK_PX = 5
/** Node must be within this many screen pixels to count as a hit. */
const NODE_PICK_PX = 10
/** Road hit half-width in world units (Connect / Delete only). */
const EDGE_PICK_WORLD = 0.85

type PendingPick =
  | { kind: 'node'; id: number; x: number; y: number }
  | { kind: 'edge'; id: number; wx: number; wz: number; x: number; y: number }

function projectNode(
  camera: Camera,
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  z: number,
  out: Vector3,
): { sx: number; sy: number } | null {
  out.set(x, y, z).project(camera)
  if (!Number.isFinite(out.x) || !Number.isFinite(out.y)) return null
  if (out.z < -1 || out.z > 1) return null
  const rect = canvas.getBoundingClientRect()
  return {
    sx: (out.x * 0.5 + 0.5) * rect.width,
    sy: (-out.y * 0.5 + 0.5) * rect.height,
  }
}

/** Prefer the nearest node in screen space (few pixels), not a large world radius. */
function pickNodeScreen(
  graph: RoadGraph,
  camera: Camera,
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  heightAt: HeightFn,
  maxPx: number,
  scratch: Vector3,
): number | null {
  const rect = canvas.getBoundingClientRect()
  const mx = clientX - rect.left
  const my = clientY - rect.top
  let best: { id: number; d: number } | null = null
  for (const n of graph.nodes) {
    const p = projectNode(camera, canvas, n.x, heightAt(n.x, n.z) + LIFT, n.z, scratch)
    if (!p) continue
    const d = Math.hypot(p.sx - mx, p.sy - my)
    if (d <= maxPx && (!best || d < best.d)) best = { id: n.id, d }
  }
  return best?.id ?? null
}

function morphKeyOf(roads: RoadNetworkParams) {
  return [
    roads.mainWidth,
    roads.collectorWidth,
    roads.localWidth,
    roads.sidewalkWidth,
    roads.frontSetback,
    roads.sideSetback,
    roads.backSetback,
    roads.cornerRadius,
    roads.blockSize,
    roads.blockShape,
    roads.plotFrontage,
    roads.plotDepth,
    roads.backLanes ? 1 : 0,
    roads.openPlotShare,
    roads.mainEvery,
    roads.collectorEvery,
    roads.roadWidth,
  ].join('|')
}

export function RoadNetwork({
  terrain,
  roads,
  view,
  resetToken,
  onLog,
  onCensus,
  onSelection,
  fields,
  fieldRevision,
  buildings,
  materiality,
  timelineT,
  absenceClock,
  tintMode = 'landUse',
  onFieldsPainted,
  onBuildingHover,
  onAppendLog,
  onStageCensus,
  onStageSeries,
  claims = [],
  claimEnabled = false,
  onClaim,
}: {
  terrain: TerrainParams
  roads: RoadNetworkParams
  view: DecayViewParams
  resetToken: number
  onLog: (lines: string[]) => void
  onCensus: (census: RoadCensus) => void
  onSelection?: (sel: DecaySelection) => void
  fields: FieldMaps
  fieldRevision: number
  buildings: BuildingParams
  materiality: MaterialityParams
  timelineT: number
  absenceClock: AbsenceClockParams
  tintMode?: LandUseViewMode
  onFieldsPainted: () => void
  onBuildingHover: (info: BuildingHoverInfo | null, sx: number, sy: number) => void
  onAppendLog: (lines: string[]) => void
  onStageCensus: (counts: StageCounts) => void
  onStageSeries: (series: { t: number; counts: StageCounts }[]) => void
  claims?: PlayerClaim[]
  claimEnabled?: boolean
  onClaim?: (plotId: number) => void
}) {
  const heightAt = useMemo(() => makeHeightAt(terrain), [terrain])
  const [graph, setGraph] = useState<RoadGraph>(() => emptyGraph())
  const logRef = useRef<string[]>([])
  const morphCacheRef = useRef<MorphCache>(emptyMorphCache())
  const roadsRef = useRef(roads)
  roadsRef.current = roads
  const heightRef = useRef(heightAt)
  heightRef.current = heightAt
  const graphRef = useRef(graph)
  graphRef.current = graph
  const onCensusRef = useRef(onCensus)
  onCensusRef.current = onCensus

  const genKey = [
    resetToken,
    roads.spacing,
    roads.angleDeg,
    roads.diagonals ? 1 : 0,
    roads.diagonalSpacing,
    roads.slopeLimit,
    roads.halfExtent,
    roads.mainEvery,
    roads.collectorEvery,
    terrain.noiseId,
    terrain.frequency,
    terrain.amplitude,
    terrain.extras[terrain.noiseId],
  ].join('|')

  const morphKey = morphKeyOf(roads)

  const [hoverNode, setHoverNode] = useState<number | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)
  const dragMoved = useRef(false)
  const draggingRef = useRef<number | null>(null)
  const pendingRef = useRef<PendingPick | null>(null)
  const viewRef = useRef(view)
  viewRef.current = view
  const selectedRef = useRef(selected)
  selectedRef.current = selected
  const nodeMeshRef = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  const nodeColor = useMemo(() => new Color('#3a322c'), [])
  const { camera, gl } = useThree()
  const controls = useThree((s) => s.controls) as
    | { enabled?: boolean; enableRotate?: boolean; enablePan?: boolean; enableZoom?: boolean }
    | undefined
  const controlsRef = useRef(controls)
  controlsRef.current = controls
  const xzPlane = useMemo(() => new Plane(new Vector3(0, 1, 0), 0), [])
  const raycaster = useMemo(() => new Raycaster(), [])
  const ndc = useMemo(() => new Vector2(), [])
  const hit = useMemo(() => new Vector3(), [])
  const projScratch = useMemo(() => new Vector3(), [])

  const setControlsEnabled = (on: boolean) => {
    const c = controlsRef.current
    if (!c) return
    c.enabled = on
  }

  const publish = (lines: string[]) => {
    logRef.current = lines
    onLog(lines)
  }

  const report = (
    g: RoadGraph,
    morph: ReturnType<typeof buildMorphology>,
    landCounts?: {
      industry: number
      commerce: number
      housing: number
      civic: number
      park: number
      farm: number
      yard: number
    },
  ) => {
    onCensusRef.current({
      nodes: g.nodes.length,
      roads: g.edges.length,
      plots: morph.stats.plots,
      blocks: morph.stats.blocks,
      junctions: morph.stats.junctions,
      deadEnds: morph.stats.deadEnds,
      cornerPlots: morph.stats.cornerPlots,
      openPlots: morph.stats.openPlots,
      avgPlotArea: morph.stats.avgPlotArea,
      roadShare: morph.stats.roadShare,
      sidewalkShare: morph.stats.sidewalkShare,
      plotShare: morph.stats.plotShare,
      landIndustry: landCounts?.industry ?? 0,
      landCommerce: landCounts?.commerce ?? 0,
      landHousing: landCounts?.housing ?? 0,
      landCivic: landCounts?.civic ?? 0,
      landPark: landCounts?.park ?? 0,
      landFarm: landCounts?.farm ?? 0,
      landYard: landCounts?.yard ?? 0,
    })
  }

  const runMorph = (g: RoadGraph, extra: string[] = [], replaceLog = false) => {
    const morph = buildMorphology(g, roadsRef.current, heightRef.current, morphCacheRef.current)
    morphCacheRef.current = morph.cache
    const land = assignLandUse(morph.plots, g, roadsRef.current)
    if (replaceLog) publish([...extra, ...morph.log, land.summary])
    else publish(appendLog(logRef.current.filter((l) => !l.startsWith('[land]')), [...extra, ...morph.log, land.summary]))
    report(g, morph, land.counts)
    return morph
  }

  const apply = (next: RoadGraph, extra: string[]) => {
    setGraph(next)
    runMorph(next, extra)
  }

  useEffect(() => {
    const { graph: g, log } = buildGridGraph(roadsRef.current, heightRef.current)
    morphCacheRef.current = emptyMorphCache()
    setGraph(g)
    setSelected(null)
    setDragging(null)
    onSelection?.({ draggingId: null, selectedId: null })
    runMorph(g, log, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genKey])

  // Morphology-only param changes: fingerprint invalidates every block; rebuild plots.
  useEffect(() => {
    if (graph.nodes.length === 0) return
    morphCacheRef.current = emptyMorphCache()
    runMorph(graph)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [morphKey])

  // Camera stays on unless a node is actively being dragged.
  useEffect(() => {
    setControlsEnabled(dragging == null)
    return () => setControlsEnabled(true)
  }, [dragging])

  const morph = useMemo(() => {
    const result = buildMorphology(graph, roads, heightAt, morphCacheRef.current)
    morphCacheRef.current = result.cache
    return result
  }, [graph, roads, heightAt, morphKey])

  const landUse = useMemo(
    () => assignLandUse(morph.plots, graph, roads),
    [morph.plots, graph, roads.halfExtent, morphKey],
  )

  // Keep census land counts in sync with the live morph (runMorph also reports).
  useEffect(() => {
    report(graph, morph, landUse.counts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landUse.summary, graph, morph])

  const roadGeo = useMemo(
    () => buildRoadMesh(graph, heightAt, roads),
    [graph, heightAt, roads.mainWidth, roads.collectorWidth, roads.localWidth, roads.cornerRadius],
  )
  const walkGeo = useMemo(
    () => buildSidewalkMesh(graph, heightAt, roads),
    [graph, heightAt, roads.mainWidth, roads.collectorWidth, roads.localWidth, roads.sidewalkWidth],
  )
  const plotBuilt = useMemo(
    () => buildPlotMeshes(morph, heightAt, view, landUse.byId),
    [morph, heightAt, view.showPlots, view.showCornerPlots, view.showOpenPlots, view.showBuildingLine, landUse.byId],
  )

  useEffect(() => {
    onSelection?.({ draggingId: dragging, selectedId: selected })
  }, [dragging, selected, onSelection])

  useEffect(() => () => roadGeo.dispose(), [roadGeo])
  useEffect(() => () => walkGeo.dispose(), [walkGeo])
  useEffect(
    () => () => {
      plotBuilt.geo.dispose()
      plotBuilt.lineGeo.dispose()
    },
    [plotBuilt],
  )

  useLayoutEffect(() => {
    const mesh = nodeMeshRef.current
    if (!mesh) return
    const nodes = graph.nodes
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]!
      dummy.position.set(n.x, heightAt(n.x, n.z) + LIFT + 0.08, n.z)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.count = nodes.length
  }, [graph, heightAt, dummy])

  const clickNode = (id: number) => {
    const tool = viewRef.current.editTool
    if (tool === 'delete') {
      const result = deleteNode(graphRef.current, id)
      if (result) apply(result.graph, result.log)
      setSelected(null)
      return
    }
    if (tool === 'connect') {
      const cur = selectedRef.current
      if (cur == null) setSelected(id)
      else if (cur === id) setSelected(null)
      else {
        const result = connectNodes(
          graphRef.current,
          cur,
          id,
          heightRef.current,
          roadsRef.current.slopeLimit,
        )
        if (result) apply(result.graph, result.log)
        setSelected(null)
      }
      return
    }
    // Edit: click selects (drag of a selected node moves it — see pointer handlers).
    setSelected(id)
  }

  const clickEdge = (edgeId: number, x: number, z: number) => {
    const tool = viewRef.current.editTool
    if (tool === 'delete') {
      const result = deleteEdge(graphRef.current, edgeId)
      if (result) apply(result.graph, result.log)
      return
    }
    if (tool === 'connect') return
    // Edit: click on road inserts a node (only on confirmed click, not drag).
    const hitPt = closestPointOnEdge(graphRef.current, edgeId, x, z)
    if (!hitPt) return
    const result = insertNodeOnEdge(
      graphRef.current,
      edgeId,
      hitPt.x,
      hitPt.z,
      heightRef.current,
      roadsRef.current.slopeLimit,
    )
    if (result) apply(result.graph, result.log)
  }

  const beginNodeDrag = (id: number) => {
    draggingRef.current = id
    dragMoved.current = false
    setDragging(id)
    setControlsEnabled(false)
  }

  const endNodeDrag = () => {
    const id = draggingRef.current
    if (id != null && dragMoved.current) {
      const n = getNode(graphRef.current, id)
      const extra = n ? [`[node] moved n${n.id} to ${n.x.toFixed(1)}, ${n.z.toFixed(1)}`] : []
      runMorph(graphRef.current, extra)
    }
    draggingRef.current = null
    dragMoved.current = false
    setDragging(null)
    setControlsEnabled(true)
    onSelection?.({ draggingId: null, selectedId: selectedRef.current })
  }

  useEffect(() => {
    const el = gl.domElement
    let moveTicks = 0

    const groundHit = (clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect()
      ndc.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      )
      raycaster.setFromCamera(ndc, camera)
      if (!raycaster.ray.intersectPlane(xzPlane, hit)) return null
      return { x: hit.x, z: hit.z }
    }

    const onDown = (ev: PointerEvent) => {
      if (ev.button !== 0) return
      if (!viewRef.current.editingEnabled) {
        pendingRef.current = null
        return
      }
      // Already dragging a node — ignore.
      if (draggingRef.current != null) return

      const tool = viewRef.current.editTool
      const nodeId = pickNodeScreen(
        graphRef.current,
        camera,
        el,
        ev.clientX,
        ev.clientY,
        heightRef.current,
        NODE_PICK_PX,
        projScratch,
      )

      // Edit: press on already-selected node → steal so orbit doesn't start;
      // move past threshold = node drag, release without move = click.
      if (tool === 'edit' && nodeId != null && selectedRef.current === nodeId) {
        pendingRef.current = { kind: 'node', id: nodeId, x: ev.clientX, y: ev.clientY }
        ev.stopImmediatePropagation()
        return
      }

      // Tight node pick — do not stopPropagation (camera still gets the event).
      // Click confirmed on pointerup if movement stays under CLICK_PX.
      if (nodeId != null) {
        pendingRef.current = { kind: 'node', id: nodeId, x: ev.clientX, y: ev.clientY }
        return
      }

      // Connect is nodes-only.
      if (tool === 'connect') {
        pendingRef.current = null
        return
      }

      // Edit insert / Delete road: pending edge click only (no capture).
      const g = groundHit(ev.clientX, ev.clientY)
      if (!g) {
        pendingRef.current = null
        return
      }
      const edgePick = pickNearest(graphRef.current, g.x, g.z, 0, EDGE_PICK_WORLD)
      if (edgePick?.kind === 'edge' && (tool === 'edit' || tool === 'delete')) {
        pendingRef.current = {
          kind: 'edge',
          id: edgePick.id,
          wx: edgePick.x,
          wz: edgePick.z,
          x: ev.clientX,
          y: ev.clientY,
        }
        return
      }
      pendingRef.current = null
    }

    const onMove = (ev: PointerEvent) => {
      // Active node drag → move the node.
      const dragId = draggingRef.current
      if (dragId != null) {
        const g = groundHit(ev.clientX, ev.clientY)
        if (!g) return
        dragMoved.current = true
        const { graph: next } = moveNode(graphRef.current, dragId, g.x, g.z)
        graphRef.current = next
        setGraph(next)
        moveTicks += 1
        if (moveTicks % 2 === 0) runMorph(next)
        return
      }

      const pending = pendingRef.current
      if (pending) {
        const dist = Math.hypot(ev.clientX - pending.x, ev.clientY - pending.y)
        if (dist > CLICK_PX) {
          // Past click threshold.
          if (
            pending.kind === 'node' &&
            viewRef.current.editTool === 'edit' &&
            selectedRef.current === pending.id
          ) {
            // Selected node drag → take over from camera.
            ev.stopImmediatePropagation()
            beginNodeDrag(pending.id)
            pendingRef.current = null
            const g = groundHit(ev.clientX, ev.clientY)
            if (g) {
              dragMoved.current = true
              const { graph: next } = moveNode(graphRef.current, pending.id, g.x, g.z)
              graphRef.current = next
              setGraph(next)
            }
            return
          }
          // Otherwise it's a camera drag — drop the pending edit.
          pendingRef.current = null
        }
      }

      // Hover highlight only (does not capture).
      if (!viewRef.current.editingEnabled) {
        setHoverNode(null)
        return
      }
      const hover = pickNodeScreen(
        graphRef.current,
        camera,
        el,
        ev.clientX,
        ev.clientY,
        heightRef.current,
        NODE_PICK_PX,
        projScratch,
      )
      setHoverNode(hover)
    }

    const onUp = (ev: PointerEvent) => {
      if (draggingRef.current != null) {
        endNodeDrag()
        pendingRef.current = null
        return
      }
      const pending = pendingRef.current
      pendingRef.current = null
      if (!pending || !viewRef.current.editingEnabled) return
      if (ev.button !== 0) return
      const dist = Math.hypot(ev.clientX - pending.x, ev.clientY - pending.y)
      if (dist > CLICK_PX) return // was a camera drag
      if (pending.kind === 'node') {
        setHoverNode(pending.id)
        clickNode(pending.id)
      } else {
        clickEdge(pending.id, pending.wx, pending.wz)
      }
    }

    const onCancel = () => {
      if (draggingRef.current != null) endNodeDrag()
      pendingRef.current = null
      setControlsEnabled(true)
    }

    // Bubble phase — do NOT capture. OrbitControls sees the event first / alongside.
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('blur', onCancel)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('blur', onCancel)
      setControlsEnabled(true)
    }
  }, [camera, gl, hit, ndc, raycaster, xzPlane, projScratch])

  return (
    <group>
      <BuildingLayer
        plots={morph.plots}
        heightAt={heightAt}
        fields={fields}
        fieldRevision={fieldRevision}
        buildings={buildings}
        materiality={materiality}
        halfExtent={roads.halfExtent}
        view={view}
        timelineT={timelineT}
        absenceClock={absenceClock}
        tintMode={tintMode}
        onFieldsPainted={onFieldsPainted}
        onHover={onBuildingHover}
        onAppendLog={onAppendLog}
        onStageCensus={onStageCensus}
        onStageSeries={onStageSeries}
        claims={claims}
        claimEnabled={claimEnabled}
        onClaim={onClaim}
        landUseById={landUse.byId}
      />
      {view.showPlots || view.showCornerPlots || view.showOpenPlots ? (
        plotBuilt.geo.attributes.position ? (
          <mesh
            geometry={plotBuilt.geo}
            frustumCulled={false}
            renderOrder={1}
            raycast={() => null}
          >
            <meshStandardMaterial
              vertexColors
              side={DoubleSide}
              roughness={0.98}
              metalness={0}
              transparent
              opacity={0.62}
              depthWrite={false}
              polygonOffset
              polygonOffsetFactor={-1}
              polygonOffsetUnits={-1}
            />
          </mesh>
        ) : null
      ) : null}
      {view.showSidewalks && walkGeo.attributes.position ? (
        <mesh geometry={walkGeo} frustumCulled={false} renderOrder={2} raycast={() => null}>
          <meshStandardMaterial
            vertexColors
            side={DoubleSide}
            roughness={0.95}
            metalness={0}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      ) : null}
      {view.showRoads ? (
        <mesh geometry={roadGeo} frustumCulled={false} renderOrder={3} raycast={() => null}>
          <meshStandardMaterial
            vertexColors
            side={DoubleSide}
            roughness={0.88}
            metalness={0}
            emissive="#2c241e"
            emissiveIntensity={0.28}
            polygonOffset
            polygonOffsetFactor={-3}
            polygonOffsetUnits={-3}
          />
        </mesh>
      ) : null}
      {view.showBuildingLine && plotBuilt.lineGeo.attributes.position ? (
        <lineSegments geometry={plotBuilt.lineGeo} frustumCulled={false} renderOrder={4} raycast={() => null}>
          <lineBasicMaterial color={DECAY_MORPH.buildingLine} transparent opacity={0.85} />
        </lineSegments>
      ) : null}
      {view.showNodes && graph.nodes.length > 0 ? (
        <instancedMesh
          ref={nodeMeshRef}
          key={graph.nodes.length}
          args={[undefined, undefined, Math.max(1, graph.nodes.length)]}
          frustumCulled={false}
          renderOrder={5}
          raycast={() => null}
        >
          <cylinderGeometry args={[0.48, 0.48, 0.2, 8]} />
          <meshStandardMaterial color={nodeColor} roughness={0.7} metalness={0.05} />
        </instancedMesh>
      ) : null}
      {(() => {
        const id = dragging ?? selected ?? hoverNode
        const n = id != null ? getNode(graph, id) : null
        if (!n) return null
        return (
          <mesh
            position={[n.x, heightAt(n.x, n.z) + LIFT + 0.14, n.z]}
            rotation={[-Math.PI / 2, 0, 0]}
            renderOrder={6}
            raycast={() => null}
          >
            <ringGeometry args={[0.9, 1.15, 24]} />
            <meshBasicMaterial color="#e10600" transparent opacity={0.9} side={DoubleSide} />
          </mesh>
        )
      })()}
    </group>
  )
}
