import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { IcosahedronGeometry, Vector3 } from 'three'
import type { BlobParams } from './blobParams.ts'

function Blob({ params }: { params: BlobParams }) {
  const geometry = useMemo(() => {
    const geo = new IcosahedronGeometry(1, 6)
    const pos = geo.attributes.position
    const vertex = new Vector3()
    const { blobiness, frequency } = params

    for (let i = 0; i < pos.count; i++) {
      vertex.fromBufferAttribute(pos, i)
      const bulge =
        blobiness *
          Math.sin(vertex.x * frequency) *
          Math.cos(vertex.y * frequency * 0.87) *
          Math.sin(vertex.z * frequency * 1.1) +
        blobiness * 0.55 * Math.sin(vertex.x * frequency * 2.3 + vertex.y * frequency * 1.32)
      vertex.normalize().multiplyScalar(1 + bulge)
      pos.setXYZ(i, vertex.x, vertex.y, vertex.z)
    }

    geo.computeVertexNormals()
    return geo
  }, [params.blobiness, params.frequency])

  useEffect(() => {
    return () => {
      geometry.dispose()
    }
  }, [geometry])

  return (
    <mesh
      geometry={geometry}
      scale={params.size}
      rotation={[0, (params.rotation * Math.PI) / 180, 0]}
    >
      <meshStandardMaterial
        color="#8a8680"
        metalness={params.metalness}
        roughness={params.roughness}
      />
    </mesh>
  )
}

export default function Scene({ params }: { params: BlobParams }) {
  return (
    <Canvas
      className="scene-canvas"
      camera={{ position: [2.6, 2.1, 2.6], fov: 45 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#0a0a0a']} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[4, 6, 3]} intensity={1.35} />
      <directionalLight position={[-3, -1, -2]} intensity={0.25} />
      <Blob params={params} />
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
