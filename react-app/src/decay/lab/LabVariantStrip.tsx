/**
 * Building Lab variant strip — V1…V6 from block position + dist-to-center.
 * Shared camera for every thumb; whole house framed and centered.
 */

import { Canvas, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo } from 'react'
import {
  BackSide,
  CanvasTexture,
  DoubleSide,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3,
} from 'three'
import type { BuildingTypeParams } from '../buildingTypeTable.ts'
import { buildLabRowHouseGeometry } from '../rowHouseForm.ts'
import {
  LAB_VARIANT_COUNT,
  labBuildParams,
  labPlotMass,
  labThumbCameraPose,
  labVariantAt,
  previewFromLotPosition,
  type LabPreview,
} from './labDraft.ts'

type Props = {
  draft: BuildingTypeParams
  preview: LabPreview
  plotFrontage: number
  plotDepth: number
  storyHeight: number
  onSelect: (lotPosition: number) => void
  onLotPosition: (lotPosition: number) => void
}

function makeThumbBackdrop(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 32
  c.height = 32
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(16, 14, 1, 16, 16, 18)
  g.addColorStop(0, '#23262c')
  g.addColorStop(1, '#15171b')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 32, 32)
  const tex = new CanvasTexture(c)
  tex.needsUpdate = true
  return tex
}

function ThumbScene({
  draft,
  lotPosition,
  storyHeight,
  width,
  depth,
  storyMax,
}: {
  draft: BuildingTypeParams
  lotPosition: number
  storyHeight: number
  width: number
  depth: number
  storyMax: number
}) {
  const look = useMemo(() => labVariantAt(draft, lotPosition), [draft, lotPosition])
  const preview = useMemo(
    () => previewFromLotPosition(draft, lotPosition),
    [draft, lotPosition],
  )
  const params = useMemo(() => labBuildParams(draft, preview), [draft, preview])
  const geo = useMemo(
    () => buildLabRowHouseGeometry(look, params),
    [look, params],
  )
  useEffect(() => () => geo.dispose(), [geo])

  const mat = useMemo(
    () =>
      new MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.72,
        metalness: 0.02,
        side: DoubleSide,
      }),
    [],
  )
  useEffect(() => () => mat.dispose(), [mat])

  const backdropTex = useMemo(() => makeThumbBackdrop(), [])
  const backdropMat = useMemo(
    () =>
      new MeshBasicMaterial({
        map: backdropTex,
        side: BackSide,
        depthWrite: false,
      }),
    [backdropTex],
  )
  useEffect(
    () => () => {
      backdropMat.dispose()
      backdropTex.dispose()
    },
    [backdropMat, backdropTex],
  )

  const pose = useMemo(
    () => labThumbCameraPose(width, depth, storyHeight, storyMax),
    [width, depth, storyHeight, storyMax],
  )
  const { camera } = useThree()
  useLayoutEffect(() => {
    const cam = camera as typeof camera & { fov: number }
    if ('fov' in cam) cam.fov = pose.fov
    camera.position.set(pose.position[0], pose.position[1], pose.position[2])
    camera.lookAt(new Vector3(pose.lookAt[0], pose.lookAt[1], pose.lookAt[2]))
    camera.updateProjectionMatrix()
  }, [camera, pose])

  return (
    <>
      <color attach="background" args={['#15171b']} />
      <ambientLight intensity={0.62} color="#ffe8d2" />
      <directionalLight position={[5, 9, 4]} intensity={1.2} color="#ffe2b8" />
      <directionalLight position={[1, 4, 8]} intensity={0.45} color="#d8e0ea" />
      <mesh scale={[40, 40, 40]} material={backdropMat} frustumCulled={false}>
        <sphereGeometry args={[1, 16, 12]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[width * 2.6, depth * 2.6]} />
        <meshStandardMaterial color="#3a3733" />
      </mesh>
      <mesh
        geometry={geo}
        material={mat}
        scale={[width, storyHeight, depth]}
        castShadow={false}
      />
    </>
  )
}

export function LabVariantStrip({
  draft,
  preview,
  plotFrontage,
  plotDepth,
  storyHeight,
  onSelect,
  onLotPosition,
}: Props) {
  const mass = labPlotMass(draft, plotFrontage, plotDepth, storyHeight)
  const storyMax = Math.max(draft.size.storyMax, draft.size.storyMin, 2)

  return (
    <div className="decay-lab-variants-wrap">
      <div className="decay-lab-variants" aria-label="Variants">
        {Array.from({ length: LAB_VARIANT_COUNT }, (_, i) => (
          <button
            key={i}
            type="button"
            className={
              preview.lotPosition === i
                ? 'decay-lab-variant-slot is-active'
                : 'decay-lab-variant-slot'
            }
            onClick={() => onSelect(i)}
            title={`V${i + 1} · lot ${i} · block + dist-to-center`}
          >
            <span className="decay-lab-variant-label">V{i + 1}</span>
            <div className="decay-lab-variant-canvas">
              <Canvas
                dpr={1}
                gl={{ antialias: true, alpha: false, powerPreference: 'low-power' }}
                camera={{
                  fov: 36,
                  near: 0.05,
                  far: 80,
                  position: [4, 3, 5],
                }}
              >
                <ThumbScene
                  draft={draft}
                  lotPosition={i}
                  storyHeight={storyHeight}
                  width={mass.width}
                  depth={mass.depth}
                  storyMax={storyMax}
                />
              </Canvas>
            </div>
          </button>
        ))}
      </div>
      <label className="decay-lab-lot-pos">
        <span>Lot position</span>
        <input
          type="range"
          min={0}
          max={LAB_VARIANT_COUNT - 1}
          step={1}
          value={preview.lotPosition}
          onChange={(e) => onLotPosition(Number(e.target.value))}
        />
        <input
          type="number"
          min={0}
          max={LAB_VARIANT_COUNT - 1}
          step={1}
          value={preview.lotPosition}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (Number.isFinite(n)) onLotPosition(n)
          }}
        />
      </label>
    </div>
  )
}
