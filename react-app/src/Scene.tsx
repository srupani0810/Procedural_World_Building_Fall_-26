import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { Float32BufferAttribute, PlaneGeometry } from 'three'
import { heightToRgb } from './heightColor.ts'
import { createNoise } from './terrainParams.ts'
import type { TerrainParams } from './terrainParams.ts'

const SIZE = 4

function Terrain({ params }: { params: TerrainParams }) {
  const geometry = useMemo(() => {
    const segments = Math.round(params.detail)
    return new PlaneGeometry(SIZE, SIZE, segments, segments)
  }, [params.detail])

  const geometryRef = useRef(geometry)
  geometryRef.current = geometry

  useLayoutEffect(() => {
    const geo = geometryRef.current
    const sample = createNoise(params)
    const positions = geo.attributes.position
    const colors = new Float32Array(positions.count * 3)

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i)
      const y = positions.getY(i)
      const noise = sample(x, y)
      positions.setZ(i, noise * params.height)

      const [r, g, b] = heightToRgb((noise + 1) * 0.5)
      const offset = i * 3
      colors[offset] = r / 255
      colors[offset + 1] = g / 255
      colors[offset + 2] = b / 255
    }

    positions.needsUpdate = true
    geo.setAttribute('color', new Float32BufferAttribute(colors, 3))
    geo.computeVertexNormals()
  }, [params])

  useLayoutEffect(() => {
    return () => {
      geometry.dispose()
    }
  }, [geometry])

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <mesh geometry={geometry}>
        <meshStandardMaterial vertexColors roughness={0.88} metalness={0} />
      </mesh>
    </group>
  )
}

export default function Scene({ params }: { params: TerrainParams }) {
  return (
    <Canvas
      className="scene-canvas"
      camera={{ position: [3.4, 2.6, 3.4], fov: 45 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#0a0a0a']} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 3]} intensity={1.2} />
      <directionalLight position={[-3, 1, -2]} intensity={0.22} />
      <Terrain params={params} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan
        minDistance={1.5}
        maxDistance={14}
      />
    </Canvas>
  )
}
