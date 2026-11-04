/**
 * Materiality Lab center viewer — row house under wear / compare modes.
 * Wear 0 matches Architecture (vertex colors + same lights / backdrop).
 * Texture never moves vertices. No Math.random.
 */

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import {
  BackSide,
  BufferAttribute,
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Vector3,
  type BufferGeometry,
} from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import {
  createLabBuildingWearMaterial,
  seedFromPlot,
  syncWearUniforms,
} from '../buildingWearMaterial.ts'
import type { BuildingTypeParams } from '../buildingTypeTable.ts'
import { blendHouseRgbByEra } from '../housePalette.ts'
import {
  geoLayerAmount,
  materialId,
  materialityForCompare,
  type MaterialityParams,
  type ShellMaterial,
} from '../materiality.ts'
import { buildLabRowHouseGeometry } from '../rowHouseForm.ts'
import {
  labBuildParams,
  labPlotMass,
  labRowVariant,
  type LabPreview,
} from './labDraft.ts'

type Props = {
  draft: BuildingTypeParams
  preview: LabPreview
  materiality: MaterialityParams
  plotFrontage: number
  plotDepth: number
  storyHeight: number
  sidewalkWidth: number
  roadWidth: number
  turntable: boolean
  viewReset: number
  onTurntable: (on: boolean) => void
  onResetView: () => void
  onMateriality: (next: MaterialityParams) => void
}

function makeBackdropTexture(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(32, 28, 2, 32, 32, 34)
  g.addColorStop(0, '#23262c')
  g.addColorStop(1, '#15171b')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  const tex = new CanvasTexture(c)
  tex.needsUpdate = true
  return tex
}

function WearHouseMesh({
  draft,
  preview,
  materiality,
  width,
  depth,
  storyHeight,
  wearOverride,
  compareSlice,
}: {
  draft: BuildingTypeParams
  preview: LabPreview
  materiality: MaterialityParams
  width: number
  depth: number
  storyHeight: number
  wearOverride?: number
  compareSlice?: 'texture' | 'geometry' | 'both'
}) {
  const variant = useMemo(() => labRowVariant(draft, preview), [draft, preview])
  const params = useMemo(() => labBuildParams(draft, preview), [draft, preview])
  const baseGeo = useMemo(
    () => buildLabRowHouseGeometry(variant, params),
    [variant, params],
  )

  const matForShader = useMemo(() => {
    let m = materiality
    if (compareSlice === 'texture') {
      m = { ...m, compareMode: 'texture' }
    } else if (compareSlice === 'geometry') {
      m = { ...m, compareMode: 'geometry' }
    }
    return materialityForCompare(m)
  }, [materiality, compareSlice])

  const wear =
    wearOverride ??
    (matForShader.wearMode === 'scrub' ? matForShader.wear : matForShader.wear)

  const bundle = useMemo(() => createLabBuildingWearMaterial(matForShader), [])
  const { material, uniforms } = bundle

  useEffect(() => {
    syncWearUniforms(uniforms, matForShader, 'normal')
    uniforms.uUseVertexBase.value = 1
    material.needsUpdate = true
  }, [matForShader, uniforms, material])

  useEffect(() => () => material.dispose(), [material])

  const taggedGeo = useMemo(() => {
    const g = baseGeo.clone()
    const n = g.getAttribute('position').count
    const wears = new Float32Array(n)
    const matIds = new Float32Array(n)
    const fails = new Float32Array(n)
    const seeds = new Float32Array(n)
    const stages = new Float32Array(n)
    const lands = new Float32Array(n)
    const kind: ShellMaterial =
      matForShader.material === 'mixed' ? 'brick' : matForShader.material
    const mid = materialId(kind)
    const seed = seedFromPlot(17)
    const era = matForShader.era
    const srcColor = g.getAttribute('color')
    if (srcColor && era > 0) {
      const blended = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) {
        const [r, gv, b] = blendHouseRgbByEra(
          srcColor.getX(i),
          srcColor.getY(i),
          srcColor.getZ(i),
          era,
        )
        blended[i * 3] = r
        blended[i * 3 + 1] = gv
        blended[i * 3 + 2] = b
      }
      g.setAttribute('color', new BufferAttribute(blended, 3))
    }
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
    return g
  }, [baseGeo, wear, matForShader.material, matForShader.era])

  useEffect(
    () => () => {
      taggedGeo.dispose()
      baseGeo.dispose()
    },
    [taggedGeo, baseGeo],
  )

  const debrisAmt = geoLayerAmount(matForShader.debris, wear)
  const tarpAmt = geoLayerAmount(matForShader.tarp, wear)

  return (
    <group scale={[width, storyHeight, depth]}>
      <mesh
        geometry={taggedGeo as BufferGeometry}
        material={material}
        castShadow
        receiveShadow
      />
      {debrisAmt > 0 ? (
        <mesh
          position={[0.15, 0.02, -0.55]}
          scale={[0.2 * debrisAmt + 0.12, 0.08, 0.18]}
          castShadow
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#4a4038" roughness={0.95} />
        </mesh>
      ) : null}
      {tarpAmt > 0.2 ? (
        <mesh
          position={[0.2, 0.55, -0.52]}
          rotation={[-0.35, 0.1, 0.05]}
          scale={[0.35 + tarpAmt * 0.1, 0.03, 0.28]}
          castShadow
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#3a4838" roughness={0.9} />
        </mesh>
      ) : null}
    </group>
  )
}

function FitCamera({
  targetHeight,
  depth,
  zCenter,
  viewReset,
  sideBySide,
}: {
  targetHeight: number
  depth: number
  zCenter: number
  viewReset: number
  sideBySide: boolean
}) {
  const { camera, controls } = useThree()
  useLayoutEffect(() => {
    const cam = camera as PerspectiveCamera
    const look = new Vector3(0, targetHeight * 0.42, zCenter)
    const vFov = (cam.fov * Math.PI) / 180
    const span = Math.max(targetHeight, depth * 0.85) * (sideBySide ? 1.35 : 1)
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
  }, [camera, controls, targetHeight, depth, zCenter, viewReset, sideBySide])
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
  const sideBySide = props.materiality.compareMode === 'sideBySide'

  const plotMat = useMemo(
    () => new MeshStandardMaterial({ color: new Color('#3a3733'), roughness: 0.94 }),
    [],
  )
  const walkMat = useMemo(
    () => new MeshStandardMaterial({ color: new Color('#55514b'), roughness: 0.9 }),
    [],
  )
  const roadMat = useMemo(
    () => new MeshStandardMaterial({ color: new Color('#2e2c2a'), roughness: 0.92 }),
    [],
  )
  const backdropTex = useMemo(() => makeBackdropTexture(), [])
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
      plotMat.dispose()
      walkMat.dispose()
      roadMat.dispose()
      backdropMat.dispose()
      backdropTex.dispose()
    },
    [plotMat, walkMat, roadMat, backdropMat, backdropTex],
  )

  const compareSlice =
    props.materiality.compareMode === 'texture'
      ? 'texture'
      : props.materiality.compareMode === 'geometry'
        ? 'geometry'
        : 'both'

  return (
    <>
      <color attach="background" args={['#15171b']} />
      <ambientLight intensity={0.62} color="#ffe8d2" />
      <hemisphereLight args={['#8a909a', '#3a3733', 0.4]} />
      <directionalLight
        position={[7, 12, 5]}
        intensity={1.25}
        color="#ffe2b8"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0002}
        shadow-normalBias={0.03}
      />
      <directionalLight position={[-6, 5, -2]} intensity={0.28} color="#a8b0bc" />
      <directionalLight
        position={[1.5, 5, zCenter + 10]}
        intensity={0.55}
        color="#d8e0ea"
      />

      <mesh
        position={[0, houseH * 0.5, zCenter]}
        scale={[90, 90, 90]}
        material={backdropMat}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 24, 16]} />
      </mesh>

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
        {sideBySide ? (
          <group>
            <group position={[-mass.width * 0.85, 0, 0]}>
              <WearHouseMesh
                draft={props.draft}
                preview={props.preview}
                materiality={props.materiality}
                width={mass.width}
                depth={mass.depth}
                storyHeight={props.storyHeight}
                compareSlice="texture"
              />
            </group>
            <group position={[mass.width * 0.85, 0, 0]}>
              <WearHouseMesh
                draft={props.draft}
                preview={props.preview}
                materiality={props.materiality}
                width={mass.width}
                depth={mass.depth}
                storyHeight={props.storyHeight}
                compareSlice="geometry"
              />
            </group>
          </group>
        ) : (
          <WearHouseMesh
            draft={props.draft}
            preview={props.preview}
            materiality={props.materiality}
            width={mass.width}
            depth={mass.depth}
            storyHeight={props.storyHeight}
            compareSlice={compareSlice}
          />
        )}
      </Turntable>

      <FitCamera
        targetHeight={houseH}
        depth={mass.depth}
        zCenter={zCenter}
        viewReset={props.viewReset}
        sideBySide={sideBySide}
      />
      <OrbitControls
        makeDefault
        target={[0, houseH * 0.4, zCenter]}
        enablePan
        minDistance={3}
        maxDistance={40}
        maxPolarAngle={Math.PI * 0.49}
      />
    </>
  )
}

export function MaterialityLabViewer(props: Props) {
  const { materiality, onMateriality } = props
  return (
    <div className="decay-lab-viewer">
      <div className="decay-lab-viewer-tools" aria-label="Viewer tools">
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
        <label className="decay-lab-tool-slider">
          <span>Wear</span>
          <input
            type="range"
            min={0}
            max={3}
            step={0.05}
            value={materiality.wear}
            onChange={(e) =>
              onMateriality({
                ...materiality,
                wear: Number(e.target.value),
                wearMode: 'scrub',
              })
            }
          />
          <span className="decay-lab-tool-val">{materiality.wear.toFixed(2)}</span>
        </label>
        <label className="decay-lab-tool-slider">
          <span>Era</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={materiality.era}
            onChange={(e) =>
              onMateriality({
                ...materiality,
                era: Number(e.target.value),
              })
            }
          />
          <span className="decay-lab-tool-val">{materiality.era.toFixed(2)}</span>
        </label>
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
