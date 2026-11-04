/**
 * Building Lab 3D viewer — plot, sidewalk, street, scale figure.
 * Brighter lighting; turntable + reset view. Same parts kit as the city.
 */

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import {
  Color,
  DoubleSide,
  Group,
  MeshStandardMaterial,
  PerspectiveCamera,
  Vector3,
} from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { BuildingTypeParams } from '../buildingTypeTable.ts'
import { DebugPerfProbe } from '../debug/DebugPerfProbe.tsx'
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
  debugEnabled?: boolean
  turntable: boolean
  viewReset: number
  onTurntable: (on: boolean) => void
  onResetView: () => void
}

function ScalePerson({ x, z }: { x: number; z: number }) {
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
  const geo = useMemo(() => buildLabRowHouseGeometry(variant, draft), [variant, draft])

  useEffect(() => () => geo.dispose(), [geo])

  const mat = useMemo(
    () =>
      new MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.78,
        metalness: 0.03,
        side: DoubleSide,
      }),
    [],
  )
  useEffect(() => () => mat.dispose(), [mat])

  return (
    <mesh
      geometry={geo}
      material={mat}
      scale={[width, storyHeight, depth]}
      castShadow
      receiveShadow
    />
  )
}

/** Frame so the house fills ~60% of the vertical FOV. */
function FitCamera({
  targetHeight,
  depth,
  zCenter,
  viewReset,
}: {
  targetHeight: number
  depth: number
  zCenter: number
  viewReset: number
}) {
  const { camera, controls } = useThree()
  useLayoutEffect(() => {
    const cam = camera as PerspectiveCamera
    const look = new Vector3(0, targetHeight * 0.42, zCenter)
    const vFov = (cam.fov * Math.PI) / 180
    const span = Math.max(targetHeight, depth * 0.85)
    const dist = span / (2 * Math.tan(vFov * 0.5) * 0.6)
    const yaw = 0.55
    cam.position.set(
      Math.sin(yaw) * dist,
      targetHeight * 0.55 + span * 0.12,
      zCenter + Math.cos(yaw) * dist,
    )
    cam.near = 0.05
    cam.far = 200
    cam.lookAt(look)
    cam.updateProjectionMatrix()
    const orbit = controls as OrbitControlsImpl | null
    if (orbit) {
      orbit.target.copy(look)
      orbit.update()
    }
  }, [camera, controls, targetHeight, depth, zCenter, viewReset])
  return null
}

function Turntable({
  enabled,
  zCenter,
  children,
}: {
  enabled: boolean
  zCenter: number
  children: ReactNode
}) {
  const ref = useRef<Group>(null)
  useFrame((_, dt) => {
    if (!enabled || !ref.current) return
    ref.current.rotation.y += dt * 0.35
  })
  useEffect(() => {
    if (!enabled && ref.current) ref.current.rotation.y = 0
  }, [enabled])
  return (
    <group ref={ref} position={[0, 0, zCenter]}>
      {children}
    </group>
  )
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
  const yard = props.draft.size.yardFrac ?? 0.38
  const frontShift = props.draft.size.frontShiftFrac ?? 0.5
  const massDepth = mass.depth
  const rearYard = depth * yard
  const zCenter =
    -depth * 0.5 +
    rearYard +
    massDepth * 0.5 +
    (depth - rearYard - massDepth) * (1 - frontShift)

  const plotMat = useMemo(
    () => new MeshStandardMaterial({ color: new Color('#d8d0c4'), roughness: 0.92 }),
    [],
  )
  const walkMat = useMemo(
    () => new MeshStandardMaterial({ color: new Color('#c4beb4'), roughness: 0.88 }),
    [],
  )
  const roadMat = useMemo(
    () => new MeshStandardMaterial({ color: new Color('#9a9590'), roughness: 0.9 }),
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
      <color attach="background" args={['#e8e4dc']} />
      <ambientLight intensity={0.72} color="#fff4e8" />
      <hemisphereLight args={['#f2f0ea', '#c8b8a0', 0.55]} />
      <directionalLight
        position={[7, 12, 5]}
        intensity={1.35}
        color="#ffe2b8"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-5, 4, -3]} intensity={0.35} color="#d0d8e8" />

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.01, 0]}
        material={plotMat}
        receiveShadow
      >
        <planeGeometry args={[front, depth]} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.025, -depth * 0.5 - walk * 0.5]}
        material={walkMat}
        receiveShadow
      >
        <planeGeometry args={[front + walk * 0.5, walk]} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.005, -depth * 0.5 - walk - road * 0.5]}
        material={roadMat}
        receiveShadow
      >
        <planeGeometry args={[front + 4, road]} />
      </mesh>

      <Turntable enabled={props.turntable} zCenter={zCenter}>
        <LabHouseMesh
          draft={props.draft}
          preview={props.preview}
          width={mass.width}
          depth={mass.depth}
          storyHeight={props.storyHeight}
        />
      </Turntable>

      <ScalePerson
        x={mass.width * 0.55 + 0.35}
        z={zCenter - mass.depth * 0.5 - 0.35}
      />

      <FitCamera
        targetHeight={houseH}
        depth={mass.depth}
        zCenter={zCenter}
        viewReset={props.viewReset}
      />
      <OrbitControls
        makeDefault
        target={[0, houseH * 0.4, zCenter]}
        enablePan
        minDistance={3}
        maxDistance={40}
        maxPolarAngle={Math.PI * 0.49}
      />
      {props.debugEnabled ? <DebugPerfProbe /> : null}
    </>
  )
}

export function BuildingLabViewer(props: Props) {
  return (
    <div className="decay-lab-viewer">
      <div className="decay-lab-viewer-tools">
        <label className="decay-lab-tool-check">
          <input
            type="checkbox"
            checked={props.turntable}
            onChange={(e) => props.onTurntable(e.target.checked)}
          />
          <span>Turntable</span>
        </label>
        <button type="button" className="decay-lab-tool-btn" onClick={props.onResetView}>
          Reset view
        </button>
      </div>
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
