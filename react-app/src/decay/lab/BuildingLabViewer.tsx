/**
 * Building Lab 3D viewer — one plot, sidewalk, street edge, scale figure.
 * Same parts kit / form builder as the city. Orbit + zoom only.
 */

import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  Color,
  DoubleSide,
  MeshStandardMaterial,
  PerspectiveCamera,
  Vector3,
} from 'three'
import type { BuildingTypeParams } from '../buildingTypeTable.ts'
import { buildLabRowHouseGeometry } from '../rowHouseForm.ts'
import { labPlotMass, labRowVariant, type LabPreview } from './labDraft.ts'

type Props = {
  draft: BuildingTypeParams
  preview: LabPreview
  plotFrontage: number
  plotDepth: number
  storyHeight: number
  sidewalkWidth: number
  roadWidth: number
}

function ScalePerson({
  x,
  z,
}: {
  x: number
  z: number
}) {
  // ~1.7 m figure for scale (city meters ≈ world units).
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.85, 0]} castShadow>
        <capsuleGeometry args={[0.18, 0.95, 4, 8]} />
        <meshStandardMaterial color="#c8b8a8" roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.55, 0]} castShadow>
        <sphereGeometry args={[0.16, 10, 10]} />
        <meshStandardMaterial color="#d4c4b0" roughness={0.8} />
      </mesh>
    </group>
  )
}

function LabHouseMesh({
  draft,
  preview,
  width,
  depth,
  storyHeight,
}: {
  draft: BuildingTypeParams
  preview: LabPreview
  width: number
  depth: number
  storyHeight: number
}) {
  const variant = useMemo(() => labRowVariant(draft, preview), [draft, preview])
  const geo = useMemo(() => {
    return buildLabRowHouseGeometry(variant, draft)
  }, [variant, draft])

  useEffect(() => {
    return () => {
      geo.dispose()
    }
  }, [geo])

  const mat = useMemo(
    () =>
      new MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.82,
        metalness: 0.04,
        side: DoubleSide,
      }),
    [],
  )

  useEffect(() => () => mat.dispose(), [mat])

  // Unit mesh is 1×stories×1; scale X/Z to plot mass, Y per story.
  return (
    <mesh
      geometry={geo}
      material={mat}
      scale={[width, storyHeight, depth]}
      position={[0, 0, 0]}
      castShadow
      receiveShadow
    />
  )
}

function FitCamera({
  targetHeight,
  depth,
}: {
  targetHeight: number
  depth: number
}) {
  const { camera } = useThree()
  const done = useRef(false)
  useLayoutEffect(() => {
    if (done.current) return
    done.current = true
    const cam = camera as PerspectiveCamera
    const look = new Vector3(0, targetHeight * 0.45, 0)
    // Fill the view with the house: distance from height + depth.
    const span = Math.max(targetHeight, depth) * 1.35
    cam.position.set(span * 0.85, targetHeight * 0.72, span * 1.05)
    cam.near = 0.05
    cam.far = 200
    cam.lookAt(look)
    cam.updateProjectionMatrix()
  }, [camera, targetHeight, depth])
  return null
}

function LabScene(props: Props) {
  const mass = labPlotMass(
    props.draft,
    props.plotFrontage,
    props.plotDepth,
    props.storyHeight,
  )
  const stories = Math.max(
    props.draft.size.storyMin,
    Math.min(props.draft.size.storyMax, props.preview.stories),
  )
  const houseH = props.storyHeight * stories
  const front = props.plotFrontage
  const depth = props.plotDepth
  const walk = props.sidewalkWidth
  const road = Math.max(props.roadWidth, 0.8)
  // Street along −Z of the plot; plot center at origin; building front-shifted.
  const yard = props.draft.size.yardFrac ?? 0.38
  const frontShift = props.draft.size.frontShiftFrac ?? 0.5
  const massDepth = mass.depth
  const rearYard = depth * yard
  const zCenter =
    -depth * 0.5 + rearYard + massDepth * 0.5 + (depth - rearYard - massDepth) * (1 - frontShift)

  const plotMat = useMemo(
    () => new MeshStandardMaterial({ color: new Color('#3a3630'), roughness: 0.95 }),
    [],
  )
  const walkMat = useMemo(
    () => new MeshStandardMaterial({ color: new Color('#6a6660'), roughness: 0.9 }),
    [],
  )
  const roadMat = useMemo(
    () => new MeshStandardMaterial({ color: new Color('#2a2826'), roughness: 0.88 }),
    [],
  )
  useEffect(
    () => () => {
      plotMat.dispose()
      walkMat.dispose()
      roadMat.dispose()
    },
    [plotMat, walkMat, roadMat],
  )

  return (
    <>
      <color attach="background" args={['#0c0c0c']} />
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[8, 14, 6]}
        intensity={1.15}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <hemisphereLight args={['#8a9aaa', '#2a2218', 0.35]} />

      {/* Plot pad */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.01, 0]}
        material={plotMat}
        receiveShadow
      >
        <planeGeometry args={[front, depth]} />
      </mesh>

      {/* Sidewalk strip at street edge (−Z) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.025, -depth * 0.5 - walk * 0.5]}
        material={walkMat}
        receiveShadow
      >
        <planeGeometry args={[front + walk * 0.5, walk]} />
      </mesh>

      {/* Street edge */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.005, -depth * 0.5 - walk - road * 0.5]}
        material={roadMat}
        receiveShadow
      >
        <planeGeometry args={[front + 4, road]} />
      </mesh>

      <group position={[0, 0, zCenter]}>
        <LabHouseMesh
          draft={props.draft}
          preview={props.preview}
          width={mass.width}
          depth={mass.depth}
          storyHeight={props.storyHeight}
        />
      </group>

      <ScalePerson
        x={mass.width * 0.55 + 0.35}
        z={zCenter - mass.depth * 0.5 - 0.35}
      />

      <FitCamera targetHeight={houseH} depth={mass.depth} />
      <OrbitControls
        makeDefault
        target={[0, houseH * 0.4, zCenter]}
        enablePan
        minDistance={4}
        maxDistance={40}
        maxPolarAngle={Math.PI * 0.49}
      />
    </>
  )
}

export function BuildingLabViewer(props: Props) {
  return (
    <div className="decay-lab-viewer">
      <Canvas
        className="decay-lab-canvas"
        shadows
        dpr={[1, 1.5]}
        camera={{ fov: 42, near: 0.05, far: 200, position: [10, 6, 12] }}
        gl={{ antialias: true, alpha: false }}
      >
        <LabScene {...props} />
      </Canvas>
    </div>
  )
}
