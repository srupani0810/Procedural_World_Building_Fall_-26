import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Euler, Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { createNoise, terrainAmplitude } from './terrainParams.ts'
import type { TerrainParams } from './terrainParams.ts'

const EYE_HEIGHT = 0.38
const MOVE_SPEED = 3.2
const LOOK_SENS = 0.0022
const PITCH_LIMIT = Math.PI / 2 - 0.04

type FirstPersonControlsProps = {
  enabled: boolean
  terrain: TerrainParams
  onExit: () => void
}

/**
 * Additive first-person walk on the voxel heightfield.
 * OrbitControls should be disabled while `enabled` is true.
 */
export function FirstPersonControls({ enabled, terrain, onExit }: FirstPersonControlsProps) {
  const { camera, gl, controls } = useThree()
  const keys = useRef(new Set<string>())
  const euler = useRef(new Euler(0, 0, 0, 'YXZ'))
  const dragging = useRef(false)
  const forward = useRef(new Vector3())
  const right = useRef(new Vector3())
  const placed = useRef(false)
  const wasEnabled = useRef(false)

  const sample = useMemo(() => createNoise(terrain), [terrain])
  const heightScale = terrainAmplitude(terrain)
  const surfaceAt = (x: number, z: number) => sample(x, z) * heightScale

  // Enter: stand on terrain at the orbit focus; exit once resyncs OrbitControls (not every orbit frame).
  useEffect(() => {
    if (!enabled) {
      const leavingWalk = wasEnabled.current
      wasEnabled.current = false
      placed.current = false
      dragging.current = false
      if (document.pointerLockElement === gl.domElement) {
        document.exitPointerLock()
      }
      if (leavingWalk) {
        // Stale spherical state would otherwise snap the camera when orbit re-enables.
        const orbit = controls as OrbitControlsImpl | null
        if (orbit) {
          const dir = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
          dir.y = 0
          if (dir.lengthSq() > 1e-6) dir.normalize()
          else dir.set(0, 0, -1)
          const tx = camera.position.x + dir.x * 6
          const tz = camera.position.z + dir.z * 6
          orbit.target.set(tx, surfaceAt(tx, tz), tz)
          orbit.update()
        }
      }
      return
    }

    wasEnabled.current = true
    if (placed.current) return
    placed.current = true

    const orbit = controls as OrbitControlsImpl | null
    const fromX = camera.position.x
    const fromZ = camera.position.z
    const x = orbit?.target?.x ?? fromX
    const z = orbit?.target?.z ?? fromZ
    const y = surfaceAt(x, z) + EYE_HEIGHT

    camera.position.set(x, y, z)
    camera.rotation.order = 'YXZ'

    const dirX = x - fromX
    const dirZ = z - fromZ
    if (Math.hypot(dirX, dirZ) > 0.05) {
      camera.lookAt(x + dirX, y, z + dirZ)
    } else {
      camera.lookAt(x, y, z - 1)
    }
    euler.current.setFromQuaternion(camera.quaternion, 'YXZ')
    camera.rotation.copy(euler.current)
  }, [enabled, camera, controls, gl.domElement, sample, heightScale])

  // Keyboard + pointer look
  useEffect(() => {
    if (!enabled) return

    const el = gl.domElement

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        event.preventDefault()
        onExit()
        return
      }
      keys.current.add(event.code)
    }
    const onKeyUp = (event: KeyboardEvent) => {
      keys.current.delete(event.code)
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      dragging.current = true
      if (document.pointerLockElement !== el) {
        el.requestPointerLock?.()
      }
    }
    const onPointerUp = () => {
      dragging.current = false
    }
    const onPointerMove = (event: PointerEvent) => {
      const locked = document.pointerLockElement === el
      if (!locked && !dragging.current) return
      euler.current.y -= event.movementX * LOOK_SENS
      euler.current.x -= event.movementY * LOOK_SENS
      euler.current.x = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, euler.current.x))
      camera.rotation.copy(euler.current)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    el.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointermove', onPointerMove)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      el.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointermove', onPointerMove)
      keys.current.clear()
    }
  }, [enabled, camera, gl.domElement, onExit])

  useFrame((_, delta) => {
    if (!enabled) return

    const dt = Math.min(delta, 0.05)
    const pressed = keys.current
    let moveX = 0
    let moveZ = 0
    if (pressed.has('KeyW') || pressed.has('ArrowUp')) moveZ += 1
    if (pressed.has('KeyS') || pressed.has('ArrowDown')) moveZ -= 1
    if (pressed.has('KeyA') || pressed.has('ArrowLeft')) moveX -= 1
    if (pressed.has('KeyD') || pressed.has('ArrowRight')) moveX += 1

    if (moveX !== 0 || moveZ !== 0) {
      forward.current.set(0, 0, -1).applyEuler(euler.current)
      forward.current.y = 0
      if (forward.current.lengthSq() > 1e-6) forward.current.normalize()
      right.current.set(1, 0, 0).applyEuler(euler.current)
      right.current.y = 0
      if (right.current.lengthSq() > 1e-6) right.current.normalize()

      const len = Math.hypot(moveX, moveZ) || 1
      const step = MOVE_SPEED * dt
      camera.position.addScaledVector(right.current, (moveX / len) * step)
      camera.position.addScaledVector(forward.current, (moveZ / len) * step)
    }

    camera.position.y = surfaceAt(camera.position.x, camera.position.z) + EYE_HEIGHT
    camera.rotation.order = 'YXZ'
    camera.rotation.copy(euler.current)
  })

  return null
}
