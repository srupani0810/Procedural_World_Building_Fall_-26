/**
 * Panel preview: one shell at wear 0 / 1 / 2 / 3 side by side.
 * Same shared wear material as the field (procedural, no bitmaps).
 */

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import {
  InstancedBufferAttribute,
  InstancedMesh,
  Object3D,
} from 'three'
import {
  createBuildingWearMaterial,
  resolveMatId,
  seedFromPlot,
  syncWearUniforms,
} from './buildingWearMaterial.ts'
import { materialId } from './materiality.ts'
import type { MaterialityParams, ShellMaterial } from './materiality.ts'

const WEARS = [0, 1, 2, 3] as const
const LABELS = ['0 new', '1 settled', '2 abandoned', '3 reclaimed']

function PreviewShells({ materiality }: { materiality: MaterialityParams }) {
  const mesh = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  const bundle = useMemo(() => createBuildingWearMaterial(materiality), [])
  const { material, uniforms } = bundle

  useEffect(() => {
    syncWearUniforms(uniforms, materiality)
    material.needsUpdate = true
  }, [materiality, uniforms, material])

  useEffect(() => () => material.dispose(), [material])

  useLayoutEffect(() => {
    const m = mesh.current
    if (!m) return
    const kind: ShellMaterial =
      materiality.material === 'mixed' ? 'brick' : materiality.material
    const matIds = new Float32Array(4)
    const wears = new Float32Array(4)
    const fails = new Float32Array(4)
    const seeds = new Float32Array(4)
    const stages = new Float32Array(4)
    for (let i = 0; i < 4; i++) {
      matIds[i] =
        materiality.material === 'mixed'
          ? resolveMatId(materiality, 3, 8, i * 10, 0, 100)
          : materialId(kind)
      wears[i] = WEARS[i]!
      fails[i] = 0
      seeds[i] = seedFromPlot(40 + i)
      stages[i] = i
      dummy.position.set((i - 1.5) * 1.55, 0.9, 0)
      dummy.rotation.set(0, 0.35, 0)
      dummy.scale.set(0.85, 1.8, 0.7)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    m.geometry.setAttribute('aMatId', new InstancedBufferAttribute(matIds, 1))
    m.geometry.setAttribute('aWear', new InstancedBufferAttribute(wears, 1))
    m.geometry.setAttribute('aFailSide', new InstancedBufferAttribute(fails, 1))
    m.geometry.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 1))
    m.geometry.setAttribute('aStage', new InstancedBufferAttribute(stages, 1))
    m.count = 4
    m.instanceMatrix.needsUpdate = true
  }, [materiality, dummy])

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, 4]} material={material} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
    </instancedMesh>
  )
}

export function MaterialityPreview({ materiality }: { materiality: MaterialityParams }) {
  return (
    <div className="decay-mat-preview">
      <div className="decay-mat-preview-canvas">
        <Canvas
          camera={{ position: [0, 1.6, 5.2], fov: 35 }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true }}
        >
          <color attach="background" args={['#0a0a0a']} />
          <ambientLight intensity={0.45} color="#c8c2b8" />
          <directionalLight position={[3, 5, 2]} intensity={1.1} color="#e0e4ea" />
          <PreviewShells materiality={materiality} />
        </Canvas>
      </div>
      <div className="decay-mat-preview-labels">
        {LABELS.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </div>
  )
}
