/**
 * R3F probe — only mount while Debug is on.
 * Samples frame times every frame; publishes renderer/camera ~4 Hz.
 */

import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import { Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import {
  DEBUG_TICK_MS,
  isDebugRuntimeEnabled,
  pushFrameMs,
  recordPerf,
} from './debugRuntime.ts'

const _dir = new Vector3()

export function DebugPerfProbe() {
  const { gl, camera, controls } = useThree()
  const lastPub = useRef(0)

  useFrame((_, dt) => {
    if (!isDebugRuntimeEnabled()) return
    pushFrameMs(dt * 1000)
    const now = performance.now()
    if (now - lastPub.current < DEBUG_TICK_MS) return
    lastPub.current = now

    camera.getWorldDirection(_dir)
    const orbit = controls as OrbitControlsImpl | null
    const info = gl.info
    recordPerf({
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      camPos: [camera.position.x, camera.position.y, camera.position.z],
      camDir: [_dir.x, _dir.y, _dir.z],
      orbitEnabled: orbit ? orbit.enabled : null,
    })
  })

  return null
}
