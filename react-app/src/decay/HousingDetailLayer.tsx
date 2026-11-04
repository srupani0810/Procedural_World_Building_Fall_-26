/**
 * Detailed housing meshes from the parts kit (Before palette).
 * Row + walk-up; tenement stays on the box layer until its form passes.
 * Variants / colors / size bands read buildingTypeTable via form builders.
 */

import { useLayoutEffect, useMemo, useRef } from 'react'
import { InstancedMesh, Object3D, type BufferGeometry } from 'three'
import type { BuildingInstance } from './buildings.ts'
import {
  rowArchetypeKey,
  rowHouseGeometryCached,
  rowVariantFromSeed,
  type RowVariant,
} from './rowHouseForm.ts'
import {
  walkupArchetypeKey,
  walkupHouseGeometryCached,
  walkupVariantFromSeed,
  type WalkupVariant,
} from './walkupHouseForm.ts'
import { timedRebuild } from './debug/debugRuntime.ts'

type RowPlace = {
  inst: BuildingInstance
  variant: RowVariant
  key: string
}

type WalkupPlace = {
  inst: BuildingInstance
  variant: WalkupVariant
  key: string
}

function rimOf(x: number, z: number, half: number) {
  return Math.min(1, Math.hypot(x, z) / Math.max(1, half))
}

export function HousingDetailLayer({
  instances,
  halfExtent,
  visible,
  rowMeshRevision = 0,
}: {
  instances: BuildingInstance[]
  halfExtent: number
  visible: boolean
  /** Lab Apply bumps this so row meshes rebuild from buildingTypeTable. */
  rowMeshRevision?: number
}) {
  const rows = useMemo(() => {
    const out: RowPlace[] = []
    for (const inst of instances) {
      if (inst.housingKind !== 'row') continue
      const variant = rowVariantFromSeed(
        inst.plotId,
        inst.unitIndex ?? 0,
        inst.unitCount ?? 1,
        Math.max(2, Math.round(inst.stories)),
        inst.housingCorner ?? false,
      )
      out.push({
        inst,
        variant,
        key: `${rowArchetypeKey(variant)}|r${rowMeshRevision}`,
      })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instances, rowMeshRevision])

  const walkups = useMemo(() => {
    const out: WalkupPlace[] = []
    for (const inst of instances) {
      if (inst.housingKind !== 'walkup') continue
      const rim = rimOf(inst.x, inst.z, halfExtent)
      const variant = walkupVariantFromSeed(
        inst.plotId,
        rim,
        inst.housingCorner ?? false,
        Math.max(4, Math.min(6, Math.round(inst.stories))),
      )
      out.push({
        inst,
        variant,
        key: walkupArchetypeKey(variant),
      })
    }
    return out
  }, [instances, halfExtent])

  const rowsByKey = useMemo(() => {
    const m = new Map<string, RowPlace[]>()
    for (const r of rows) {
      const list = m.get(r.key)
      if (list) list.push(r)
      else m.set(r.key, [r])
    }
    return m
  }, [rows])

  const walkupsByKey = useMemo(() => {
    const m = new Map<string, WalkupPlace[]>()
    for (const w of walkups) {
      const list = m.get(w.key)
      if (list) list.push(w)
      else m.set(w.key, [w])
    }
    return m
  }, [walkups])

  if (!visible) return null

  return (
    <group>
      {[...rowsByKey.entries()].map(([key, list]) => (
        <RowArchetypeMesh key={`${key}|${rowMeshRevision}`} places={list} revision={rowMeshRevision} />
      ))}
      {[...walkupsByKey.entries()].map(([key, list]) => (
        <WalkupArchetypeMesh key={key} places={list} />
      ))}
    </group>
  )
}

function RowArchetypeMesh({
  places,
  revision,
}: {
  places: RowPlace[]
  revision: number
}) {
  const mesh = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  const geo: BufferGeometry = useMemo(
    () =>
      timedRebuild('row house mesh', `archetype ${places[0]!.key}`, () =>
        rowHouseGeometryCached(places[0]!.variant),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [places[0]!.key, revision],
  )
  const cap = Math.max(4, places.length)

  useLayoutEffect(() => {
    const m = mesh.current
    if (!m) return
    const storyH = places[0]?.inst.storyHeight ?? 3
    for (let i = 0; i < places.length; i++) {
      const { inst } = places[i]!
      dummy.position.set(inst.x, inst.floorY, inst.z)
      dummy.rotation.set(0, inst.yaw, 0)
      dummy.scale.set(inst.width, storyH, inst.depth)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    m.count = places.length
    m.instanceMatrix.needsUpdate = true
  }, [places, dummy])

  return (
    <instancedMesh
      ref={mesh}
      args={[geo, undefined, cap]}
      frustumCulled={false}
      raycast={() => null}
      castShadow={false}
      receiveShadow={false}
    >
      <meshStandardMaterial vertexColors roughness={0.82} metalness={0.04} />
    </instancedMesh>
  )
}

function WalkupArchetypeMesh({ places }: { places: WalkupPlace[] }) {
  const mesh = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  const geo: BufferGeometry = useMemo(
    () =>
      timedRebuild('walk-up mesh', `archetype ${places[0]!.key}`, () =>
        walkupHouseGeometryCached(places[0]!.variant),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [places[0]!.key],
  )
  const cap = Math.max(4, places.length)

  useLayoutEffect(() => {
    const m = mesh.current
    if (!m) return
    const storyH = places[0]?.inst.storyHeight ?? 3
    for (let i = 0; i < places.length; i++) {
      const { inst } = places[i]!
      dummy.position.set(inst.x, inst.floorY, inst.z)
      dummy.rotation.set(0, inst.yaw, 0)
      dummy.scale.set(inst.width, storyH, inst.depth)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    m.count = places.length
    m.instanceMatrix.needsUpdate = true
  }, [places, dummy])

  return (
    <instancedMesh
      ref={mesh}
      args={[geo, undefined, cap]}
      frustumCulled={false}
      raycast={() => null}
      castShadow={false}
      receiveShadow={false}
    >
      <meshStandardMaterial vertexColors roughness={0.8} metalness={0.04} />
    </instancedMesh>
  )
}
