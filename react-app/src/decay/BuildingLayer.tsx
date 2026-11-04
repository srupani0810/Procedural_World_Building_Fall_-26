/**
 * Instanced building + foundation layer over morphology plots.
 * Shared wear material; instance attrs carry material id + wear.
 * Hover uses a grid lookup; never disables OrbitControls.
 */

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedMesh,
  Object3D,
  Plane,
  Raycaster,
  Vector2,
  Vector3,
} from 'three'
import {
  buildBuildings,
  buildClaimedBuildings,
  buildHoverIndex,
  lookupHover,
  type BuildingHoverInfo,
} from './buildings.ts'
import {
  claimableHover,
  claimVacateProfile,
  findClaimablePlot,
  type PlayerClaim,
} from './claims.ts'
import {
  landUseIndex,
  type LandUseViewMode,
  type PlotLandUse,
} from './landUse.ts'
import {
  createBuildingWearMaterial,
  resolveMatId,
  seedFromPlot,
  syncWearUniforms,
} from './buildingWearMaterial.ts'
import {
  fieldArray,
  heatmapColor,
  paintField,
  type FieldKind,
  type FieldMaps,
} from './fields.ts'
import type { HeightFn } from './directionField.ts'
import {
  exposedFailSide,
  wearForBuilding,
  type MaterialityParams,
} from './materiality.ts'
import type { MorphPlot } from './morphology.ts'
import {
  DECAY_FIELD_HALF,
  DECAY_FIELD_SIZE,
  type BuildingParams,
  type DecayViewParams,
} from './params.ts'
import {
  buildVacateProfiles,
  countStages,
  formatStageLog,
  profileMap,
  sampleStageSeries,
  stageAtTime,
  stageIndex,
  type AbsenceClockParams,
  type LotStage,
  type StageCounts,
} from './timeline.ts'

const HOVER_MS = 70
const MAX_FOUNDATION_POOL = 12000
const MAX_DEBRIS = 8000
const MAX_TARP = 4000
const HEAT_RES = 96
/** Debris / tarp appear only at high wear and stop growing past this. */
const GEO_WEAR_MIN = 2.15
const GEO_WEAR_CAP = 2.55

function kindOf(params: BuildingParams): FieldKind {
  return params.activeField
}

function sampleGrid(grid: Float32Array, res: number, u: number, v: number) {
  const gx = u * (res - 1)
  const gz = v * (res - 1)
  const x0 = Math.max(0, Math.min(res - 2, Math.floor(gx)))
  const z0 = Math.max(0, Math.min(res - 2, Math.floor(gz)))
  const fx = gx - x0
  const fz = gz - z0
  const i00 = z0 * res + x0
  const a = grid[i00]!
  const b = grid[i00 + 1]!
  const c = grid[i00 + res]!
  const d = grid[i00 + res + 1]!
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz
}

function buildHeatGeometry(
  fields: FieldMaps,
  kind: FieldKind,
  heightAt: HeightFn,
): BufferGeometry {
  const res = HEAT_RES
  const grid = fieldArray(fields, kind)
  const fres = fields.res
  const pos = new Float32Array(res * res * 3)
  const col = new Float32Array(res * res * 3)
  const idx: number[] = []
  for (let iz = 0; iz < res; iz++) {
    for (let ix = 0; ix < res; ix++) {
      const u = ix / (res - 1)
      const v = iz / (res - 1)
      const x = -DECAY_FIELD_HALF + u * DECAY_FIELD_SIZE
      const z = -DECAY_FIELD_HALF + v * DECAY_FIELD_SIZE
      const i = iz * res + ix
      pos[i * 3] = x
      pos[i * 3 + 1] = heightAt(x, z) + 0.55
      pos[i * 3 + 2] = z
      const t = sampleGrid(grid, fres, u, v)
      const [r, g, b] = heatmapColor(t)
      col[i * 3] = r
      col[i * 3 + 1] = g
      col[i * 3 + 2] = b
    }
  }
  for (let iz = 0; iz < res - 1; iz++) {
    for (let ix = 0; ix < res - 1; ix++) {
      const a = iz * res + ix
      const b = a + 1
      const c = a + res
      const d = c + 1
      idx.push(a, c, b, b, c, d)
    }
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  geo.setAttribute('color', new BufferAttribute(col, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

/** Local offset of a face center (unit box), failSide 0..3. */
function failFaceLocal(side: number): { x: number; y: number; z: number; yaw: number } {
  if (side === 1) return { x: 0.5, y: 0, z: 0, yaw: Math.PI / 2 }
  if (side === 2) return { x: 0, y: 0, z: 0.5, yaw: 0 }
  if (side === 3) return { x: -0.5, y: 0, z: 0, yaw: -Math.PI / 2 }
  return { x: 0, y: 0, z: -0.5, yaw: Math.PI }
}

function worldFromLocal(
  b: BuildingInstance,
  lx: number,
  ly: number,
  lz: number,
): { x: number; y: number; z: number } {
  const h = b.stories * b.storyHeight
  const cos = Math.cos(b.yaw)
  const sin = Math.sin(b.yaw)
  const wx = lx * b.width
  const wz = lz * b.depth
  return {
    x: b.x + wx * cos - wz * sin,
    y: b.floorY + (ly + 0.5) * h,
    z: b.z + wx * sin + wz * cos,
  }
}

export function BuildingLayer({
  plots,
  heightAt,
  fields,
  fieldRevision,
  buildings,
  materiality,
  halfExtent,
  view,
  timelineT,
  absenceClock,
  tintMode = 'landUse',
  onFieldsPainted,
  onHover,
  onAppendLog,
  onStageCensus,
  onStageSeries,
  claims = [],
  claimEnabled = false,
  onClaim,
  landUseById,
}: {
  plots: MorphPlot[]
  heightAt: HeightFn
  fields: FieldMaps
  fieldRevision: number
  buildings: BuildingParams
  materiality: MaterialityParams
  halfExtent: number
  view: DecayViewParams
  timelineT: number
  absenceClock: AbsenceClockParams
  tintMode?: LandUseViewMode
  onFieldsPainted: () => void
  onHover: (info: BuildingHoverInfo | null, sx: number, sy: number) => void
  onAppendLog: (lines: string[]) => void
  onStageCensus: (counts: StageCounts) => void
  onStageSeries: (series: { t: number; counts: StageCounts }[]) => void
  /** Phase 2 player claims (open plots only). */
  claims?: PlayerClaim[]
  /** When true, click empty open lot to claim; hover shows claimable. */
  claimEnabled?: boolean
  onClaim?: (plotId: number) => void
  landUseById?: ReadonlyMap<number, PlotLandUse>
}) {
  const buildingMesh = useRef<InstancedMesh>(null)
  const foundationMesh = useRef<InstancedMesh>(null)
  const debrisMesh = useRef<InstancedMesh>(null)
  const tarpMesh = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  const { camera, gl } = useThree()
  const controls = useThree((s) => s.controls) as { enabled?: boolean } | undefined
  const controlsRef = useRef(controls)
  controlsRef.current = controls
  const raycaster = useMemo(() => new Raycaster(), [])
  const ndc = useMemo(() => new Vector2(), [])
  const hit = useMemo(() => new Vector3(), [])
  const xzPlane = useMemo(() => new Plane(new Vector3(0, 1, 0), 0), [])

  const wearBundle = useMemo(() => createBuildingWearMaterial(materiality), [])
  const wearUniforms = wearBundle.uniforms
  const wearMaterial = wearBundle.material

  useEffect(() => {
    syncWearUniforms(wearUniforms, materiality, tintMode)
    wearMaterial.needsUpdate = true
  }, [materiality, wearUniforms, wearMaterial, tintMode])

  useEffect(
    () => () => {
      wearMaterial.dispose()
    },
    [wearMaterial],
  )

  const claimById = useMemo(() => {
    const m = new Map<number, PlayerClaim>()
    for (const c of claims) m.set(c.plotId, c)
    return m
  }, [claims])

  const seedInstances = useMemo(
    () => buildBuildings(plots, fields, heightAt, buildings, landUseById, halfExtent),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      plots,
      fields,
      fieldRevision,
      heightAt,
      halfExtent,
      landUseById,
      buildings.storyHeight,
      buildings.minStories,
      buildings.maxStories,
      buildings.minSizeFill,
      buildings.maxSizeFill,
      buildings.floorMode,
      buildings.terrace,
      buildings.terraceStep,
      buildings.steepShrink,
    ],
  )

  /** One shell per plot for vacate / census — accents share plot id. */
  const seedShells = useMemo(
    () => seedInstances.filter((b) => b.part !== 'accent'),
    [seedInstances],
  )

  const claimedInstances = useMemo(
    () => buildClaimedBuildings(plots, fields, heightAt, buildings, claimById),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      plots,
      fields,
      fieldRevision,
      heightAt,
      claimById,
      buildings.storyHeight,
      buildings.minStories,
      buildings.maxStories,
      buildings.minSizeFill,
      buildings.maxSizeFill,
      buildings.floorMode,
      buildings.terrace,
      buildings.terraceStep,
      buildings.steepShrink,
    ],
  )

  const instances = useMemo(
    () =>
      claimedInstances.length === 0
        ? seedInstances
        : [...seedInstances, ...claimedInstances],
    [seedInstances, claimedInstances],
  )

  // Seed vacate ranks stay frozen when claims are added — Phase 1 end state unchanged.
  const seedVacateProfiles = useMemo(
    () => buildVacateProfiles(seedShells, halfExtent),
    [seedShells, halfExtent],
  )
  const vacateById = useMemo(() => {
    const m = profileMap(seedVacateProfiles)
    for (const c of claims) m.set(c.plotId, claimVacateProfile(c))
    return m
  }, [seedVacateProfiles, claims])
  const vacateByIdRef = useRef(vacateById)
  vacateByIdRef.current = vacateById
  const clockRef = useRef(absenceClock)
  clockRef.current = absenceClock
  const timelineTRef = useRef(timelineT)
  timelineTRef.current = timelineT
  const claimByIdRef = useRef(claimById)
  claimByIdRef.current = claimById
  const claimEnabledRef = useRef(claimEnabled)
  claimEnabledRef.current = claimEnabled
  const onClaimRef = useRef(onClaim)
  onClaimRef.current = onClaim
  const plotsRef = useRef(plots)
  plotsRef.current = plots
  const prevStagesRef = useRef<Map<number, LotStage>>(new Map())
  const claimPointerRef = useRef<{ x: number; y: number } | null>(null)

  const censusInstances = useMemo(
    () => instances.filter((b) => b.part !== 'accent'),
    [instances],
  )

  useEffect(() => {
    // Chart history is seed-only so Phase 2 claims do not rewrite the intro series.
    onStageSeries(sampleStageSeries(seedShells, profileMap(seedVacateProfiles), absenceClock))
    onStageCensus(countStages(censusInstances, timelineT, vacateById, absenceClock))
  }, [
    seedShells,
    seedVacateProfiles,
    censusInstances,
    vacateById,
    absenceClock,
    timelineT,
    onStageSeries,
    onStageCensus,
  ])

  const hoverIndex = useMemo(() => buildHoverIndex(instances), [instances])
  const hoverIndexRef = useRef(hoverIndex)
  hoverIndexRef.current = hoverIndex
  const heightRef = useRef(heightAt)
  heightRef.current = heightAt
  const buildingsRef = useRef(buildings)
  buildingsRef.current = buildings
  const fieldsRef = useRef(fields)
  fieldsRef.current = fields
  const onPaintRef = useRef(onFieldsPainted)
  onPaintRef.current = onFieldsPainted
  const onHoverRef = useRef(onHover)
  onHoverRef.current = onHover
  const onAppendLogRef = useRef(onAppendLog)
  onAppendLogRef.current = onAppendLog
  const lastHoverAt = useRef(0)
  const lastPointer = useRef({ x: 0, y: 0, moved: false })
  const paintingRef = useRef(false)

  const foundationCount = useMemo(() => {
    let n = 0
    for (const b of instances) n += b.foundations.length
    return n
  }, [instances])

  const buildingCap = Math.max(4, instances.length || 4)

  useLayoutEffect(() => {
    const mesh = buildingMesh.current
    const found = foundationMesh.current
    const debris = debrisMesh.current
    const tarp = tarpMesh.current
    if (!mesh || !found) return

    const n = instances.length
    const matIds = new Float32Array(Math.max(n, 1))
    const wears = new Float32Array(Math.max(n, 1))
    const fails = new Float32Array(Math.max(n, 1))
    const seeds = new Float32Array(Math.max(n, 1))
    const stages = new Float32Array(Math.max(n, 1))
    const lands = new Float32Array(Math.max(n, 1))
    const stageLogs: string[] = []
    const prev = prevStagesRef.current
    const nextPrev = new Map<number, LotStage>()

    let fi = 0
    let di = 0
    let ti = 0

    for (let i = 0; i < n; i++) {
      const b = instances[i]!
      const h = Math.max(0.2, b.stories * b.storyHeight)
      const st = stageAtTime(b.plotId, timelineT, vacateById, absenceClock)
      // Materiality wear scrub can still preview; timeline stage drives aStage tint.
      const wear = Math.max(wearForBuilding(materiality, b.x, b.z), st.age > 0 ? stageIndex(st.stage) : 0)
      const fail = exposedFailSide(b.x, b.z, b.yaw)
      matIds[i] = resolveMatId(
        materiality,
        Math.max(1, b.stories),
        buildings.maxStories,
        b.x,
        b.z,
        halfExtent,
      )
      wears[i] = wear
      fails[i] = fail
      seeds[i] = seedFromPlot(b.plotId)
      stages[i] = stageIndex(st.stage)
      lands[i] = b.landUse != null ? landUseIndex(b.landUse) : 2
      if (b.part !== 'accent') {
        nextPrev.set(b.plotId, st.stage)
        const was = prev.get(b.plotId)
        if (was != null && was !== st.stage) {
          stageLogs.push(formatStageLog(b.plotId, was, st.stage, st.rule, timelineT))
        }
      }

      dummy.position.set(b.x, b.floorY + h * 0.5, b.z)
      dummy.rotation.set(0, b.yaw, 0)
      dummy.scale.set(b.width, h, b.depth)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)

      for (const slab of b.foundations) {
        if (fi >= MAX_FOUNDATION_POOL) break
        dummy.position.set(b.x, slab.y, b.z)
        dummy.rotation.set(0, b.yaw, 0)
        dummy.scale.set(b.width * 1.02, Math.max(0.08, slab.height), b.depth * 1.02)
        dummy.updateMatrix()
        found.setMatrixAt(fi, dummy.matrix)
        fi++
      }

      // Geometry weathering — high wear only, one side, capped (no further growth).
      const geoT = Math.min(1, Math.max(0, (wear - GEO_WEAR_MIN) / (GEO_WEAR_CAP - GEO_WEAR_MIN)))
      if (geoT > 0 && materiality.debris && debris) {
        const scraps = Math.min(3, 1 + Math.floor(geoT * 2))
        const face = failFaceLocal(fail)
        for (let s = 0; s < scraps && di < MAX_DEBRIS; s++) {
          const along = ((seedFromPlot(b.plotId * 17 + s) - 0.5) * 0.7)
          const lx = face.x * 0.55 + (fail === 1 || fail === 3 ? 0 : along)
          const lz = face.z * 0.55 + (fail === 0 || fail === 2 ? 0 : along)
          const w = worldFromLocal(b, lx, -0.48, lz)
          const size = 0.25 + geoT * 0.2 * (0.5 + seedFromPlot(b.plotId + s * 3))
          dummy.position.set(w.x, b.floorY + size * 0.35, w.z)
          dummy.rotation.set(0, b.yaw + face.yaw * 0.15, 0)
          dummy.scale.set(size, size * 0.45, size * 0.7)
          dummy.updateMatrix()
          debris.setMatrixAt(di, dummy.matrix)
          di++
        }
      }

      if (geoT > 0.35 && materiality.tarp && tarp && ti < MAX_TARP) {
        const face = failFaceLocal(fail)
        const w = worldFromLocal(b, face.x * 0.52, 0.15, face.z * 0.52)
        const tw = Math.min(b.width, b.depth) * (0.28 + geoT * 0.08)
        const th = 0.04
        const td = tw * 0.7
        dummy.position.set(w.x, w.y, w.z)
        dummy.rotation.set(-0.35, b.yaw + face.yaw, 0.08)
        dummy.scale.set(tw, th, td)
        dummy.updateMatrix()
        tarp.setMatrixAt(ti, dummy.matrix)
        ti++
      }
    }

    const geo = mesh.geometry
    geo.setAttribute('aMatId', new InstancedBufferAttribute(matIds, 1))
    geo.setAttribute('aWear', new InstancedBufferAttribute(wears, 1))
    geo.setAttribute('aFailSide', new InstancedBufferAttribute(fails, 1))
    geo.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 1))
    geo.setAttribute('aStage', new InstancedBufferAttribute(stages, 1))
    geo.setAttribute('aLandUse', new InstancedBufferAttribute(lands, 1))

    mesh.count = n
    mesh.instanceMatrix.needsUpdate = true
    found.count = fi
    found.instanceMatrix.needsUpdate = true
    if (debris) {
      debris.count = di
      debris.instanceMatrix.needsUpdate = true
    }
    if (tarp) {
      tarp.count = ti
      tarp.instanceMatrix.needsUpdate = true
    }

    prevStagesRef.current = nextPrev
    if (stageLogs.length > 0) onAppendLogRef.current(stageLogs)
  }, [
    instances,
    dummy,
    materiality,
    buildings.maxStories,
    halfExtent,
    timelineT,
    absenceClock,
    vacateById,
  ])

  const heatGeo = useMemo(() => {
    if (!buildings.heatmap) return null
    return buildHeatGeometry(fields, kindOf(buildings), heightAt)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildings.heatmap, buildings.activeField, fields, fieldRevision, heightAt])

  useEffect(() => () => heatGeo?.dispose(), [heatGeo])

  useEffect(() => {
    const el = gl.domElement
    const CLICK_PX = 6

    const worldHit = (clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect()
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(ndc, camera)
      const y0 = heightRef.current(0, 0)
      xzPlane.constant = -y0
      if (!raycaster.ray.intersectPlane(xzPlane, hit)) return null
      const y = heightRef.current(hit.x, hit.z)
      xzPlane.constant = -y
      if (!raycaster.ray.intersectPlane(xzPlane, hit)) return null
      return { x: hit.x, z: hit.z }
    }

    const paintAt = (clientX: number, clientY: number) => {
      const bp = buildingsRef.current
      if (!bp.painting) return
      const w = worldHit(clientX, clientY)
      if (!w) return
      const maps = fieldsRef.current
      paintField(
        fieldArray(maps, kindOf(bp)),
        maps.res,
        w.x,
        w.z,
        bp.brushRadius,
        bp.brushStrength,
        bp.paintMode === 'raise',
      )
      onPaintRef.current()
    }

    const onMove = (e: PointerEvent) => {
      lastPointer.current = { x: e.clientX, y: e.clientY, moved: true }
      if (paintingRef.current && buildingsRef.current.painting && e.buttons & 1) {
        paintAt(e.clientX, e.clientY)
      }
    }

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      if (buildingsRef.current.painting) {
        paintingRef.current = true
        claimPointerRef.current = null
        if (controlsRef.current) controlsRef.current.enabled = false
        paintAt(e.clientX, e.clientY)
        return
      }
      if (claimEnabledRef.current) {
        claimPointerRef.current = { x: e.clientX, y: e.clientY }
      }
    }

    const onUp = (e: PointerEvent) => {
      if (paintingRef.current && controlsRef.current) controlsRef.current.enabled = true
      paintingRef.current = false

      const pending = claimPointerRef.current
      claimPointerRef.current = null
      if (!pending || !claimEnabledRef.current || !onClaimRef.current) return
      if (e.button !== 0) return
      const dist = Math.hypot(e.clientX - pending.x, e.clientY - pending.y)
      if (dist > CLICK_PX) return
      const w = worldHit(e.clientX, e.clientY)
      if (!w) return
      const plot = findClaimablePlot(plotsRef.current, w.x, w.z, claimByIdRef.current)
      if (plot) onClaimRef.current(plot.id)
    }

    el.addEventListener('pointermove', onMove, { passive: true })
    el.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('pointerup', onUp, { passive: true })
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
    }
  }, [camera, gl, ndc, raycaster, hit, xzPlane])

  useFrame(() => {
    const now = performance.now()
    if (!lastPointer.current.moved && now - lastHoverAt.current < HOVER_MS) return
    if (now - lastHoverAt.current < HOVER_MS) return
    lastHoverAt.current = now
    lastPointer.current.moved = false
    const { x: cx, y: cy } = lastPointer.current
    const rect = gl.domElement.getBoundingClientRect()
    if (cx < rect.left || cy < rect.top || cx > rect.right || cy > rect.bottom) {
      onHoverRef.current(null, 0, 0)
      return
    }
    ndc.x = ((cx - rect.left) / rect.width) * 2 - 1
    ndc.y = -((cy - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(ndc, camera)
    const yGuess = heightRef.current(0, 0)
    xzPlane.constant = -yGuess
    if (!raycaster.ray.intersectPlane(xzPlane, hit)) {
      onHoverRef.current(null, cx, cy)
      return
    }
    const y = heightRef.current(hit.x, hit.z)
    xzPlane.constant = -y
    raycaster.ray.intersectPlane(xzPlane, hit)
    let info = lookupHover(hoverIndexRef.current, hit.x, hit.z)
    if (info) {
      const st = stageAtTime(
        info.plotId,
        timelineTRef.current,
        vacateByIdRef.current,
        clockRef.current,
      )
      info.stage = st.stage
      info.age = st.age
    } else if (claimEnabledRef.current) {
      const plot = findClaimablePlot(
        plotsRef.current,
        hit.x,
        hit.z,
        claimByIdRef.current,
      )
      if (plot) info = claimableHover(plot, hit.x, hit.z)
    }
    onHoverRef.current(info, cx, cy)
  })

  if (!view.showBuildings) return null

  const foundationCap = Math.max(
    4,
    Math.min(MAX_FOUNDATION_POOL, Math.max(foundationCount, 4)),
  )

  return (
    <group>
      <instancedMesh
        key={`b-${buildingCap}`}
        ref={buildingMesh}
        args={[undefined, undefined, buildingCap]}
        material={wearMaterial}
        frustumCulled={false}
        raycast={() => null}
      >
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <instancedMesh
        key={`f-${foundationCap}`}
        ref={foundationMesh}
        args={[undefined, undefined, foundationCap]}
        frustumCulled={false}
        raycast={() => null}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#5a5048" roughness={0.92} metalness={0.02} />
      </instancedMesh>
      <instancedMesh
        key={`d-${buildingCap}`}
        ref={debrisMesh}
        args={[undefined, undefined, Math.max(4, Math.min(MAX_DEBRIS, buildingCap * 3))]}
        frustumCulled={false}
        raycast={() => null}
        visible={materiality.debris}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#4a4038" roughness={0.95} metalness={0.02} />
      </instancedMesh>
      <instancedMesh
        key={`t-${buildingCap}`}
        ref={tarpMesh}
        args={[undefined, undefined, Math.max(4, Math.min(MAX_TARP, buildingCap))]}
        frustumCulled={false}
        raycast={() => null}
        visible={materiality.tarp}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#3a4838" roughness={0.9} metalness={0.05} />
      </instancedMesh>
      {heatGeo ? (
        <mesh geometry={heatGeo} raycast={() => null} renderOrder={2}>
          <meshBasicMaterial
            vertexColors
            transparent
            opacity={0.52}
            depthWrite={false}
            side={DoubleSide}
          />
        </mesh>
      ) : null}
    </group>
  )
}
