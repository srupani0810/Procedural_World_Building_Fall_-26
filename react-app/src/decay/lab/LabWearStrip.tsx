/**
 * Materiality Lab wear strip — row house at wear 0 / 1 / 2 / 3.
 * Same wear material as the city. No Math.random.
 */

import { Canvas, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  BufferAttribute,
  Mesh,
  Vector3,
  type BufferGeometry,
} from 'three'
import {
  createLabBuildingWearMaterial,
  seedFromPlot,
  syncWearUniforms,
} from '../buildingWearMaterial.ts'
import type { BuildingTypeParams } from '../buildingTypeTable.ts'
import {
  materialId,
  materialityForCompare,
  type MaterialityParams,
  type ShellMaterial,
} from '../materiality.ts'
import { buildLabRowHouseGeometry } from '../rowHouseForm.ts'
import {
  labBuildParams,
  labRowVariant,
  labThumbCameraPose,
  type LabPreview,
} from './labDraft.ts'

const WEARS = [0, 1, 2, 3] as const
const LABELS = ['0', '1', '2', '3'] as const

function WearHouseThumb({
  draft,
  preview,
  materiality,
  wear,
  plotFrontage,
  plotDepth,
  storyHeight,
}: {
  draft: BuildingTypeParams
  preview: LabPreview
  materiality: MaterialityParams
  wear: number
  plotFrontage: number
  plotDepth: number
  storyHeight: number
}) {
  const mesh = useRef<Mesh>(null)
  const params = useMemo(
    () => labBuildParams(draft, preview),
    [draft, preview],
  )
  const variant = useMemo(
    () => labRowVariant(draft, preview),
    [draft, preview],
  )
  const geo = useMemo(
    () => buildLabRowHouseGeometry(variant, params),
    [variant, params],
  )
  const matLive = useMemo(
    () => materialityForCompare(materiality),
    [materiality],
  )
  const bundle = useMemo(() => createLabBuildingWearMaterial(matLive), [])
  const { material, uniforms } = bundle

  useEffect(() => {
    syncWearUniforms(uniforms, matLive, 'normal')
    uniforms.uUseVertexBase.value = 1
    material.needsUpdate = true
  }, [matLive, uniforms, material])

  useEffect(() => () => material.dispose(), [material])

  useLayoutEffect(() => {
    const g = geo.clone()
    const n = g.getAttribute('position').count
    const wears = new Float32Array(n)
    const matIds = new Float32Array(n)
    const fails = new Float32Array(n)
    const seeds = new Float32Array(n)
    const stages = new Float32Array(n)
    const lands = new Float32Array(n)
    const kind: ShellMaterial =
      matLive.material === 'mixed' ? 'brick' : matLive.material
    const mid = materialId(kind)
    const seed = seedFromPlot(40 + Math.floor(wear))
    for (let i = 0; i < n; i++) {
      wears[i] = wear
      matIds[i] = mid
      fails[i] = 0
      seeds[i] = seed
      stages[i] = Math.min(3, Math.floor(wear))
      lands[i] = 2
    }
    g.setAttribute('aWear', new BufferAttribute(wears, 1))
    g.setAttribute('aMatId', new BufferAttribute(matIds, 1))
    g.setAttribute('aFailSide', new BufferAttribute(fails, 1))
    g.setAttribute('aSeed', new BufferAttribute(seeds, 1))
    g.setAttribute('aStage', new BufferAttribute(stages, 1))
    g.setAttribute('aLandUse', new BufferAttribute(lands, 1))
    if (mesh.current) {
      const prev = mesh.current.geometry
      mesh.current.geometry = g
      if (prev !== geo) prev.dispose()
    }
    return () => {
      g.dispose()
    }
  }, [geo, wear, matLive])

  const width = Math.max(1.5, draft.size.minWidth)
  const depth = Math.max(1.8, draft.size.minDepth)
  const pose = useMemo(
    () =>
      labThumbCameraPose(
        width,
        depth,
        storyHeight,
        draft.size.storyMax,
      ),
    [width, depth, storyHeight, draft.size.storyMax],
  )
  const { camera } = useThree()
  useLayoutEffect(() => {
    const cam = camera as typeof camera & { fov: number }
    cam.fov = pose.fov
    camera.position.set(pose.position[0], pose.position[1], pose.position[2])
    camera.lookAt(new Vector3(pose.lookAt[0], pose.lookAt[1], pose.lookAt[2]))
    camera.updateProjectionMatrix()
  }, [camera, pose])

  void plotFrontage
  void plotDepth

  return (
    <mesh ref={mesh} geometry={geo as BufferGeometry} material={material} />
  )
}

export function LabWearStrip({
  draft,
  preview,
  materiality,
  plotFrontage,
  plotDepth,
  storyHeight,
}: {
  draft: BuildingTypeParams
  preview: LabPreview
  materiality: MaterialityParams
  plotFrontage: number
  plotDepth: number
  storyHeight: number
}) {
  return (
    <div className="decay-lab-wear-strip" aria-label="Wear strip">
      <p className="decay-lab-wear-strip-title">Wear strip</p>
      <div className="decay-lab-wear-strip-row">
        {WEARS.map((w, i) => (
          <div key={w} className="decay-lab-wear-slot">
            <span className="decay-lab-wear-label">{LABELS[i]}</span>
            <div className="decay-lab-wear-canvas">
              <Canvas
                frameloop="demand"
                dpr={[1, 1.5]}
                gl={{ antialias: true, alpha: false }}
                camera={{ fov: 36, near: 0.05, far: 80, position: [4, 3, 6] }}
              >
                <color attach="background" args={['#12141a']} />
                <ambientLight intensity={0.55} />
                <directionalLight position={[4, 8, 3]} intensity={1.1} />
                <WearHouseThumb
                  draft={draft}
                  preview={preview}
                  materiality={{ ...materiality, wear: w, wearMode: 'scrub' }}
                  wear={w}
                  plotFrontage={plotFrontage}
                  plotDepth={plotDepth}
                  storyHeight={storyHeight}
                />
              </Canvas>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
