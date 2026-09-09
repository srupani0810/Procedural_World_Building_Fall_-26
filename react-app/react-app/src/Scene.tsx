import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import { Color, Object3D } from 'three'
import type { InstancedMesh } from 'three'

const RESOLUTION = 8
const COUNT = RESOLUTION * RESOLUTION * RESOLUTION

function PixelCube() {
  const meshRef = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const dummy = new Object3D()
    const color = new Color()
    const cell = 1 / RESOLUTION
    const offset = (RESOLUTION - 1) / 2
    let index = 0

    for (let x = 0; x < RESOLUTION; x++) {
      for (let y = 0; y < RESOLUTION; y++) {
        for (let z = 0; z < RESOLUTION; z++) {
          dummy.position.set((x - offset) * cell, (y - offset) * cell, (z - offset) * cell)
          dummy.updateMatrix()
          mesh.setMatrixAt(index, dummy.matrix)

          const shade = 0.52 + ((x + y + z) % 3) * 0.1
          color.setRGB(shade * 0.55, shade * 0.53, shade * 0.5)
          mesh.setColorAt(index, color)
          index += 1
        }
      }
    }

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true
    }
  }, [])

  const voxel = 1 / RESOLUTION - 1 / RESOLUTION / 12

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]}>
      <boxGeometry args={[voxel, voxel, voxel]} />
      <meshStandardMaterial roughness={0.9} metalness={0} />
    </instancedMesh>
  )
}

export default function Scene() {
  return (
    <Canvas
      className="scene-canvas"
      camera={{ position: [2.6, 2.1, 2.6], fov: 45 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#0a0a0a']} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 6, 3]} intensity={1.35} />
      <directionalLight position={[-3, -1, -2]} intensity={0.22} />
      <PixelCube />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan
        minDistance={1.5}
        maxDistance={12}
      />
    </Canvas>
  )
}
