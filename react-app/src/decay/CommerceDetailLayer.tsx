/**
 * Commerce low-rise meshes from the parts kit (Before palette).
 * Corner shop + main-street block only.
 * Params from buildingTypeTable via commerceForms.
 */

import { useLayoutEffect, useMemo, useRef } from 'react'
import { InstancedMesh, Object3D, type BufferGeometry } from 'three'
import type { BuildingInstance } from './buildings.ts'
import {
  commerceArchetypeKey,
  commerceGeometryCached,
  commerceVariantFromInstance,
  type CommerceVariant,
} from './commerceForms.ts'

type Place = {
  inst: BuildingInstance
  variant: CommerceVariant
  key: string
}

function rimOf(x: number, z: number, half: number) {
  return Math.min(1, Math.hypot(x, z) / Math.max(1, half))
}

export function CommerceDetailLayer({
  instances,
  halfExtent,
  visible,
}: {
  instances: BuildingInstance[]
  halfExtent: number
  visible: boolean
}) {
  const places = useMemo(() => {
    const out: Place[] = []
    for (const inst of instances) {
      if (!inst.commerceKind) continue
      if (inst.part && inst.part !== 'shell') continue
      const rim = rimOf(inst.x, inst.z, halfExtent)
      const variant = commerceVariantFromInstance(
        inst.plotId,
        inst.commerceKind,
        inst.stories,
        rim,
        inst.heightField,
      )
      out.push({
        inst,
        variant,
        key: commerceArchetypeKey(variant),
      })
    }
    return out
  }, [instances, halfExtent])

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
        <CommerceArchetypeMesh key={key} places={list} />
      ))}
    </group>
  )
}

function CommerceArchetypeMesh({ places }: { places: Place[] }) {
  const mesh = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  const geo: BufferGeometry = useMemo(
    () => commerceGeometryCached(places[0]!.variant),
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
