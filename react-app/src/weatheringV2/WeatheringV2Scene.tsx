import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { TerrainParams } from '../terrainParams.ts'
import type { VoxelParams } from '../voxelParams.ts'
import type { V2Params } from './params.ts'
import { V2NoiseGround, useV2HeightAt } from './terrainGround.tsx'
import { Town } from './Town.tsx'

type Props = {
  terrain: TerrainParams
  /** Kept for World panel parity (Resolution / Load radius / Isolevel). */
  voxel: VoxelParams
  params: V2Params
  gridReset: number
  stepToken: number
  onLog: (lines: string[]) => void
  onCensus: (summary: string) => void
}

/**
 * Weathering v2 scene — separate from Weathering.
 * Noise heightfield ground copied from Weathering; no water, no fog.
 */
export default function WeatheringV2Scene({
  terrain,
  voxel,
  params,
  gridReset,
  stepToken,
  onLog,
  onCensus,
}: Props) {
  void voxel
  const heightAt = useV2HeightAt(terrain)
  const groundTapRef = useRef<(wx: number, wy: number, wz: number) => void>(() => {})
  const onTapPlace = useMemo(
    () => (wx: number, wy: number, wz: number) => groundTapRef.current(wx, wy, wz),
    [],
  )

  return (
    <Canvas
      camera={{ position: [11, 9, 14], fov: 42, near: 0.1, far: 4000 }}
      gl={{ antialias: true }}
      dpr={[1, 2]}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#0e1014']} />
      <ambientLight intensity={0.55} color="#b4bcc6" />
      <hemisphereLight args={['#4a5560', '#1a1e24', 0.7]} />
      <directionalLight position={[6, 10, 3]} intensity={1.05} color="#e0e4ea" />
      <directionalLight position={[-4, 3, -5]} intensity={0.3} color="#8a949e" />
      <V2NoiseGround terrain={terrain} editEnabled onTapPlace={onTapPlace} />
      <Town
        params={params}
        gridReset={gridReset}
        heightAt={heightAt}
        stepToken={stepToken}
        groundTapRef={groundTapRef}
        onLog={onLog}
        onCensus={onCensus}
      />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan
        enableZoom
        minDistance={1.4}
        maxDistance={900}
        maxPolarAngle={Math.PI / 2.05}
      />
    </Canvas>
  )
}
