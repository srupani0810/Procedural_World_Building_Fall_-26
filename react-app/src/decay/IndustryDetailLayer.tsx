/**
 * Industry + rail-yard meshes from the parts kit (Before city palette).
 * Params from buildingTypeTable via industryForms.
 */

import { useLayoutEffect, useMemo, useRef } from 'react'
import { InstancedMesh, Object3D, type BufferGeometry } from 'three'
import type { BuildingInstance } from './buildings.ts'
import {
  industryArchetypeKey,
  industryGeometryCached,
  industryVariantFromSeed,
  type IndustryVariant,
} from './industryForms.ts'

type Place = {
  inst: BuildingInstance
  variant: IndustryVariant
  key: string
}

export function IndustryDetailLayer({
  instances,
  visible,
}: {
  instances: BuildingInstance[]
  visible: boolean
}) {
  const places = useMemo(() => {
    const out: Place[] = []
    for (const inst of instances) {
      if (!inst.industryKind) continue
      if (inst.part && inst.part !== 'shell') continue
      const variant = industryVariantFromSeed(
        inst.plotId,
        inst.industryKind,
        Math.max(1, Math.round(inst.stories)),
      )
      out.push({
        inst,
        variant,
        key: industryArchetypeKey(variant),
      })
    }
    return out
  }, [instances])

  const byKey = useMemo(() => {
    const m = new Map<string, Place[]>()
    for (const p of places) {
      const list = m.get(p.key)
      if (list) list.push(p)
      else m.set(p.key, [p])
    }
    return m
  }, [places])

  if (!visible) return null

  return (
    <group>
      {[...byKey.entries()].map(([key, list]) => (
        <IndustryArchetypeMesh key={key} places={list} />
      ))}
    </group>
  )
}

function IndustryArchetypeMesh({ places }: { places: Place[] }) {
  const mesh = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  const geo: BufferGeometry = useMemo(
    () => industryGeometryCached(places[0]!.variant),
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
      <meshStandardMaterial vertexColors roughness={0.84} metalness={0.06} />
    </instancedMesh>
  )
}
