/**
 * Building Lab variant strip — V1…V6 from block position (no Math.random).
 * Same builder as the main viewer; click loads that variant.
 */

import { Canvas, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo } from 'react'
import { DoubleSide, MeshStandardMaterial, Vector3 } from 'three'
import type { BuildingTypeParams } from '../buildingTypeTable.ts'
import { buildLabRowHouseGeometry } from '../rowHouseForm.ts'
import {
  LAB_VARIANT_COUNT,
  labPlotMass,
  labVariantAt,
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

function ThumbScene({
  draft,
  lotPosition,
  storyHeight,
  width,
  depth,
}: {
  draft: BuildingTypeParams
  lotPosition: number
  storyHeight: number
  width: number
  depth: number
}) {
  const variant = useMemo(
    () => labVariantAt(draft, lotPosition),
    [draft, lotPosition],
  )
  const geo = useMemo(
    () => buildLabRowHouseGeometry(variant, draft),
    [variant, draft],
  )
  useEffect(() => () => geo.dispose(), [geo])
  const mat = useMemo(
    () =>
      new MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.8,
        metalness: 0.03,
        side: DoubleSide,
      }),
    [],
  )
  useEffect(() => () => mat.dispose(), [mat])
  const h = storyHeight * variant.stories
  const camY = h * 0.7
  const camDist = Math.max(width, depth, h) * 1.55
  const { camera } = useThree()
  useLayoutEffect(() => {
    camera.position.set(camDist * 0.75, camY, camDist * 0.95)
    camera.lookAt(new Vector3(0, h * 0.4, 0))
    camera.updateProjectionMatrix()
  }, [camera, camDist, camY, h])

  return (
    <>
      <color attach="background" args={['#e8e4dc']} />
      <ambientLight intensity={0.75} color="#fff4e8" />
      <directionalLight position={[4, 8, 5]} intensity={1.2} color="#ffe2b8" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow={false}>
        <planeGeometry args={[width * 2.4, depth * 2.4]} />
        <meshStandardMaterial color="#d8d0c4" />
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
            title={`V${i + 1} · lot position ${i}`}
          >
            <span className="decay-lab-variant-label">V{i + 1}</span>
            <div className="decay-lab-variant-canvas">
              <Canvas
                dpr={1}
                gl={{ antialias: true, alpha: false, powerPreference: 'low-power' }}
                camera={{
                  fov: 40,
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
