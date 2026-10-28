/**
 * DECAY tab — empty noise terrain only for now.
 * Settlement returns incrementally; no buildings/claims here yet.
 */

import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { TerrainParams } from '../terrainParams.ts'
import { DecayFog, DecaySky, StreamedNoiseGround } from './noiseGround.tsx'
import { DECAY_SKY, type DecayViewParams } from './params.ts'

export type DecaySceneProps = {
  terrain: TerrainParams
  view: DecayViewParams
}

export default function DecayScene({ terrain, view }: DecaySceneProps) {
  return (
    <Canvas
      className="viewport-canvas"
      camera={{ position: [22, 14, 28], fov: 42, near: 0.05, far: 4000 }}
      gl={{ antialias: true }}
      dpr={[1, 1.75]}
    >
      <color attach="background" args={[DECAY_SKY]} />
      <DecaySky />
      <DecayFog density={view.fogDensity} />
      <ambientLight intensity={0.32} color="#c8c2b8" />
      <directionalLight position={[6, 10, 3]} intensity={1.05} color="#e0e4ea" />
      <directionalLight position={[-4, 3, -5]} intensity={0.3} color="#8a949e" />
      <StreamedNoiseGround terrain={terrain} fogDensity={view.fogDensity} />
      <OrbitControls
        makeDefault
        target={[0, 2, 0]}
        maxPolarAngle={Math.PI * 0.48}
        minDistance={6}
        maxDistance={180}
      />
    </Canvas>
  )
}
