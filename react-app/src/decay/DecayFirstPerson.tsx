/**
 * DECAY Jump In — first-person walk.
 * Arrows / WASD: forward-back + turn · Q/E strafe · Shift run · drag look.
 */

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Euler, PerspectiveCamera, Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { HeightFn } from './directionField.ts'
import { findJumpInSpawn, type JumpInSpawn } from './jumpInSpawn.ts'
import {
  PLAYER_RADIUS,
  resolveCircleSolids,
  type SolidGrid,
} from './jumpSolids.ts'
import {
  CURB_EASE,
  curbTargetAt,
  EYE_FOLLOW,
  eyeY,
  JUMP_CURB,
  JUMP_EYE_HEIGHT,
  slopeAllowed,
  surfaceY,
} from './jumpSurface.ts'
import type { RoadNetworkParams } from './params.ts'
import type { RoadGraph } from './roadGraph.ts'
import {
  firstSidewalkPoint,
  isWalkable,
  JUMP_WALK_RECENTER,
  nearestWalkable,
  sampleWalk,
  WALK_SIDEWALK,
  walkSpeedMult,
  type WalkableMap,
} from './walkableMap.ts'

const MOVE_SPEED = 3.4
const RUN_MULT = 1.85
const TURN_SPEED = 1.85
const LOOK_SENS = 0.0022
const PITCH_LIMIT = Math.PI / 2 - 0.04
/**
 * Near clip in Jump In. Kept modest; wall clearance (PLAYER_RADIUS) must stay larger
 * so façades never enter the near plane.
 */
const JUMP_NEAR = 0.05
const ORBIT_NEAR = 0.05
/** Extra clearance vs solids so the near plane can’t cut into façades. */
const WALL_PAD = 0.12
/** Snap to sidewalk if stuck in a blocked cell this long. */
const STUCK_SNAP_SEC = 0.5

/** Movement / look keys — always `event.code` (layout-independent). */
const MOVE_CODES = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyQ',
  'KeyE',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ShiftLeft',
  'ShiftRight',
])

function isTextField(el: Element | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  const tag = el.tagName
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag !== 'INPUT') return false
  const type = (el as HTMLInputElement).type
  return (
    type === 'text' ||
    type === 'search' ||
    type === 'password' ||
    type === 'email' ||
    type === 'number' ||
    type === 'url' ||
    type === 'tel' ||
    type === ''
  )
}

/** Blur sliders / buttons / tabs so arrows move the player — leave text fields alone. */
function blurNonTextFocus() {
  const el = document.activeElement
  if (!(el instanceof HTMLElement) || el === document.body) return
  if (isTextField(el)) return
  el.blur()
}

function focusCanvas(el: HTMLCanvasElement) {
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0')
  try {
    el.focus({ preventScroll: true })
  } catch {
    el.focus()
  }
}

/** Prefer a sidewalk cell; else any nearest walkable. */
function snapToWalkable(map: WalkableMap, x: number, z: number): { x: number; z: number } | null {
  const near = nearestWalkable(map, x, z)
  if (near && sampleWalk(map, near.x, near.z) === WALK_SIDEWALK) return near
  const side = firstSidewalkPoint(map)
  if (side) return side
  return near
}

export type JumpDebugInfo = {
  keys: string
  x: number
  z: number
  walkable: boolean
  moveX: number
  moveZ: number
  /** Desired step before collision (world xz). */
  wantDx: number
  wantDz: number
  /** Applied step after collision. */
  gotDx: number
  gotDz: number
}

type DecayFirstPersonProps = {
  enabled: boolean
  graph: RoadGraph
  roads: RoadNetworkParams
  heightAt: HeightFn
  walkMap: WalkableMap | null
  solidGrid: SolidGrid | null
  onExit: () => void
  /** Cancel Jump In and return to orbit with a short reason. */
  onFail?: (reason: string) => void
  /** Ask parent to rebuild the ~60 m walk/solid window around the player. */
  onWindowFollow?: (x: number, z: number) => void
  onSpawnLog?: (line: string) => void
  /** Live Jump In debug line (keys / pose / walkable / move). */
  onDebug?: (info: JumpDebugInfo) => void
}

function tryMove(
  walkMap: WalkableMap | null,
  solidGrid: SolidGrid | null,
  heightAt: HeightFn,
  slopeLimit: number,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
): { x: number; z: number } {
  let x = x1
  let z = z1

  const solidR = PLAYER_RADIUS + WALL_PAD
  if (solidGrid) {
    const slid = resolveCircleSolids(solidGrid, x, z, solidR)
    x = slid.x
    z = slid.z
  }

  if (walkMap) {
    if (!isWalkable(sampleWalk(walkMap, x, z))) {
      const okX = isWalkable(sampleWalk(walkMap, x, z0))
      const okZ = isWalkable(sampleWalk(walkMap, x0, z))
      if (okX && !okZ) z = z0
      else if (okZ && !okX) x = x0
      else if (okX && okZ) {
        if (Math.abs(x - x0) >= Math.abs(z - z0)) z = z0
        else x = x0
      } else {
        x = x0
        z = z0
      }
      if (solidGrid) {
        const again = resolveCircleSolids(solidGrid, x, z, solidR)
        x = again.x
        z = again.z
      }
    }

    if (!isWalkable(sampleWalk(walkMap, x, z))) {
      const near = nearestWalkable(walkMap, x, z)
      if (near) {
        x = near.x
        z = near.z
        if (solidGrid) {
          const again = resolveCircleSolids(solidGrid, x, z, solidR)
          x = again.x
          z = again.z
        }
      } else {
        x = x0
        z = z0
      }
    }
  }

  // Slope gate — refuse the step if rise/run or destination slope exceeds the road limit.
  if (!slopeAllowed(heightAt, x0, z0, x, z, slopeLimit)) {
    const ax = slopeAllowed(heightAt, x0, z0, x, z0, slopeLimit)
    const az = slopeAllowed(heightAt, x0, z0, x0, z, slopeLimit)
    if (ax && !az) z = z0
    else if (az && !ax) x = x0
    else {
      x = x0
      z = z0
    }
  }

  return { x, z }
}

export function DecayFirstPerson({
  enabled,
  graph,
  roads,
  heightAt,
  walkMap,
  solidGrid,
  onExit,
  onFail,
  onWindowFollow,
  onSpawnLog,
  onDebug,
}: DecayFirstPersonProps) {
  const { camera, gl, controls } = useThree()
  const keys = useRef(new Set<string>())
  const euler = useRef(new Euler(0, 0, 0, 'YXZ'))
  const dragging = useRef(false)
  const forward = useRef(new Vector3())
  const right = useRef(new Vector3())
  const placed = useRef(false)
  const wasEnabled = useRef(false)
  const heightRef = useRef(heightAt)
  heightRef.current = heightAt
  const walkRef = useRef(walkMap)
  walkRef.current = walkMap
  const solidRef = useRef(solidGrid)
  solidRef.current = solidGrid
  const slopeLimitRef = useRef(roads.slopeLimit)
  slopeLimitRef.current = roads.slopeLimit
  const curbRef = useRef(JUMP_CURB)
  const spawnRef = useRef<JumpInSpawn | null>(null)
  const savedNear = useRef(ORBIT_NEAR)
  const followRef = useRef(onWindowFollow)
  followRef.current = onWindowFollow
  const failRef = useRef(onFail)
  failRef.current = onFail
  const exitRef = useRef(onExit)
  exitRef.current = onExit
  const debugRef = useRef(onDebug)
  debugRef.current = onDebug
  const lastFollowAt = useRef(0)
  const lastDebugAt = useRef(0)
  const stuckSec = useRef(0)
  const orbitSaved = useRef<{
    enableRotate: boolean
    enablePan: boolean
    enableZoom: boolean
  } | null>(null)

  // If the error boundary unmounts us mid-Jump In, still restore near clip / orbit.
  useEffect(() => {
    const persp = camera as PerspectiveCamera
    return () => {
      if (!wasEnabled.current) return
      wasEnabled.current = false
      placed.current = false
      persp.near = savedNear.current > 0 ? savedNear.current : ORBIT_NEAR
      persp.updateProjectionMatrix()
      if (document.pointerLockElement === gl.domElement) {
        document.exitPointerLock()
      }
      const orbit = controls as OrbitControlsImpl | null
      if (orbit && orbitSaved.current) {
        orbit.enableRotate = orbitSaved.current.enableRotate
        orbit.enablePan = orbitSaved.current.enablePan
        orbit.enableZoom = orbitSaved.current.enableZoom
        orbitSaved.current = null
      }
    }
  }, [camera, gl.domElement, controls])

  // Enter / exit + near clip + orbit pointer off
  useEffect(() => {
    const persp = camera as PerspectiveCamera
    const orbit = controls as OrbitControlsImpl | null

    if (!enabled) {
      const leaving = wasEnabled.current
      wasEnabled.current = false
      placed.current = false
      dragging.current = false
      stuckSec.current = 0
      spawnRef.current = null
      keys.current.clear()
      if (document.pointerLockElement === gl.domElement) {
        document.exitPointerLock()
      }
      if (orbit && orbitSaved.current) {
        orbit.enableRotate = orbitSaved.current.enableRotate
        orbit.enablePan = orbitSaved.current.enablePan
        orbit.enableZoom = orbitSaved.current.enableZoom
        orbitSaved.current = null
      }
      if (leaving) {
        persp.near = savedNear.current
        persp.updateProjectionMatrix()
        if (orbit) {
          const dir = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
          dir.y = 0
          if (dir.lengthSq() > 1e-6) dir.normalize()
          else dir.set(0, 0, -1)
          const tx = camera.position.x + dir.x * 8
          const tz = camera.position.z + dir.z * 8
          const ty = surfaceY(heightRef.current, tx, tz, JUMP_CURB)
          orbit.target.set(tx, ty, tz)
          orbit.update()
        }
      }
      return
    }

    wasEnabled.current = true

    // Steal focus from panel sliders/tabs; put it on the 3D canvas.
    blurNonTextFocus()
    focusCanvas(gl.domElement)

    // Kill OrbitControls pointer handling while walking (keyboard already keyEvents={false}).
    if (orbit && !orbitSaved.current) {
      orbitSaved.current = {
        enableRotate: orbit.enableRotate,
        enablePan: orbit.enablePan,
        enableZoom: orbit.enableZoom,
      }
      orbit.enableRotate = false
      orbit.enablePan = false
      orbit.enableZoom = false
      orbit.enabled = false
    }

    if (placed.current) return
    placed.current = true

    try {
      savedNear.current = Number.isFinite(persp.near) && persp.near > 0 ? persp.near : ORBIT_NEAR
      persp.near = JUMP_NEAR
      persp.updateProjectionMatrix()

      let spawn = findJumpInSpawn(graph, roads, heightRef.current)
      const map = walkRef.current

      if (spawn && map) {
        if (!isWalkable(sampleWalk(map, spawn.x, spawn.z))) {
          const near = snapToWalkable(map, spawn.x, spawn.z)
          if (near) {
            spawn = {
              ...spawn,
              x: near.x,
              z: near.z,
              y: eyeY(heightRef.current, near.x, near.z, JUMP_CURB),
              rule: `${spawn.rule} · snapped to walkable sidewalk`,
            }
          } else {
            spawn = null
          }
        }
      } else if (!spawn && map) {
        const fallback = firstSidewalkPoint(map)
        if (fallback) {
          spawn = {
            x: fallback.x,
            z: fallback.z,
            y: eyeY(heightRef.current, fallback.x, fallback.z, JUMP_CURB),
            yaw: 0,
            rule: '[jump] spawn · first sidewalk in window',
          }
        }
      }

      if (!spawn) {
        const reason = 'no walkable sidewalk'
        console.error('[jump] Jump In failed:', reason)
        placed.current = false
        wasEnabled.current = false
        failRef.current?.(reason)
        return
      }

      if (solidRef.current) {
        const slid = resolveCircleSolids(
          solidRef.current,
          spawn.x,
          spawn.z,
          PLAYER_RADIUS + WALL_PAD,
        )
        if (!Number.isFinite(slid.x) || !Number.isFinite(slid.z)) {
          throw new Error('NaN collision slide at spawn')
        }
        spawn = {
          ...spawn,
          x: slid.x,
          z: slid.z,
          y: eyeY(heightRef.current, slid.x, slid.z, JUMP_CURB),
        }
      }

      // After solid slide, ensure sidewalk again.
      if (map && !isWalkable(sampleWalk(map, spawn.x, spawn.z))) {
        const near = snapToWalkable(map, spawn.x, spawn.z)
        if (near) {
          spawn = {
            ...spawn,
            x: near.x,
            z: near.z,
            y: eyeY(heightRef.current, near.x, near.z, JUMP_CURB),
          }
        }
      }

      if (
        !Number.isFinite(spawn.x) ||
        !Number.isFinite(spawn.y) ||
        !Number.isFinite(spawn.z) ||
        !Number.isFinite(spawn.yaw)
      ) {
        throw new Error('NaN spawn pose')
      }

      spawnRef.current = spawn
      curbRef.current = JUMP_CURB
      stuckSec.current = 0
      camera.position.set(spawn.x, spawn.y, spawn.z)
      camera.rotation.order = 'YXZ'
      euler.current.set(0, spawn.yaw, 0)
      camera.rotation.copy(euler.current)
      followRef.current?.(spawn.x, spawn.z)
      onSpawnLog?.(spawn.rule)
      onSpawnLog?.(
        `[jump] surface eye ${JUMP_EYE_HEIGHT.toFixed(2)} · curb ${JUMP_CURB.toFixed(2)} · near ${JUMP_NEAR}`,
      )
      focusCanvas(gl.domElement)
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      console.error('[jump] Jump In failed:', err)
      placed.current = false
      wasEnabled.current = false
      persp.near = savedNear.current
      persp.updateProjectionMatrix()
      failRef.current?.(reason)
    }
  }, [enabled, camera, controls, gl.domElement, graph, roads, onSpawnLog])

  // Keyboard + drag look — listeners stay stable (callbacks via refs).
  useEffect(() => {
    if (!enabled) return

    const el = gl.domElement
    focusCanvas(el)

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTextField(document.activeElement)) return

      if (event.code === 'Escape') {
        event.preventDefault()
        exitRef.current()
        return
      }
      if (!MOVE_CODES.has(event.code)) return
      // Stop page/panel scroll and range-slider nudges (arrows especially).
      event.preventDefault()
      keys.current.add(event.code)
    }
    const onKeyUp = (event: KeyboardEvent) => {
      keys.current.delete(event.code)
    }
    const clearKeys = () => {
      keys.current.clear()
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      blurNonTextFocus()
      focusCanvas(el)
      dragging.current = true
      el.setPointerCapture?.(event.pointerId)
    }
    const onPointerUp = (event: PointerEvent) => {
      dragging.current = false
      try {
        el.releasePointerCapture?.(event.pointerId)
      } catch {
        /* already released */
      }
    }
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging.current) return
      euler.current.y -= event.movementX * LOOK_SENS
      euler.current.x -= event.movementY * LOOK_SENS
      euler.current.x = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, euler.current.x))
      camera.rotation.copy(euler.current)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', clearKeys)
    document.addEventListener('visibilitychange', clearKeys)
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('lostpointercapture', onPointerUp)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', clearKeys)
      document.removeEventListener('visibilitychange', clearKeys)
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('lostpointercapture', onPointerUp)
      keys.current.clear()
    }
  }, [enabled, camera, gl.domElement])

  useFrame((_, delta) => {
    if (!enabled) return

    const dt = Math.min(delta, 0.05)
    const pressed = keys.current

    // Turn in place (A/D + Left/Right).
    let turn = 0
    if (pressed.has('KeyA') || pressed.has('ArrowLeft')) turn += 1
    if (pressed.has('KeyD') || pressed.has('ArrowRight')) turn -= 1
    if (turn !== 0) {
      euler.current.y += turn * TURN_SPEED * dt
    }

    // Walk forward/back + Q/E strafe.
    let walk = 0
    let strafe = 0
    if (pressed.has('KeyW') || pressed.has('ArrowUp')) walk += 1
    if (pressed.has('KeyS') || pressed.has('ArrowDown')) walk -= 1
    if (pressed.has('KeyQ')) strafe -= 1
    if (pressed.has('KeyE')) strafe += 1

    const running = pressed.has('ShiftLeft') || pressed.has('ShiftRight')
    const x0 = camera.position.x
    const z0 = camera.position.z
    const hAt = heightRef.current
    const surface = walkRef.current ? sampleWalk(walkRef.current, x0, z0) : 3
    const surfMult = walkSpeedMult(surface)
    const speed = MOVE_SPEED * (running ? RUN_MULT : 1) * (surfMult > 0 ? surfMult : 1)

    // Debug move vector = walk/strafe intent (not the old strafe-A/D scheme).
    const moveX = strafe
    const moveZ = walk

    let wantDx = 0
    let wantDz = 0
    let gotDx = 0
    let gotDz = 0

    if (walk !== 0 || strafe !== 0) {
      forward.current.set(0, 0, -1).applyEuler(euler.current)
      forward.current.y = 0
      if (forward.current.lengthSq() > 1e-6) forward.current.normalize()
      right.current.set(1, 0, 0).applyEuler(euler.current)
      right.current.y = 0
      if (right.current.lengthSq() > 1e-6) right.current.normalize()

      const len = Math.hypot(walk, strafe) || 1
      const step = speed * dt
      const x1 =
        x0 + right.current.x * (strafe / len) * step + forward.current.x * (walk / len) * step
      const z1 =
        z0 + right.current.z * (strafe / len) * step + forward.current.z * (walk / len) * step
      wantDx = x1 - x0
      wantDz = z1 - z0
      const next = tryMove(
        walkRef.current,
        solidRef.current,
        hAt,
        slopeLimitRef.current,
        x0,
        z0,
        x1,
        z1,
      )
      camera.position.x = next.x
      camera.position.z = next.z
      gotDx = next.x - x0
      gotDz = next.z - z0
    }

    // Stuck in a blocked cell → accumulate time, then snap to sidewalk.
    const map = walkRef.current
    const walkOk = map ? isWalkable(sampleWalk(map, camera.position.x, camera.position.z)) : true
    if (map && !walkOk) {
      stuckSec.current += dt
      if (stuckSec.current >= STUCK_SNAP_SEC) {
        const near = snapToWalkable(map, camera.position.x, camera.position.z)
        if (near) {
          camera.position.x = near.x
          camera.position.z = near.z
          gotDx = near.x - x0
          gotDz = near.z - z0
        }
        stuckSec.current = 0
      }
    } else {
      stuckSec.current = 0
    }

    // Eased curb (sidewalk ↔ road) + smooth eye follow (Y only — never overwrites xz).
    const targetCurb = curbTargetAt(walkRef.current, camera.position.x, camera.position.z)
    const curbT = Math.min(1, dt * CURB_EASE)
    curbRef.current += (targetCurb - curbRef.current) * curbT
    const wantY = eyeY(hAt, camera.position.x, camera.position.z, curbRef.current)
    const eyeT = Math.min(1, dt * EYE_FOLLOW)
    camera.position.y += (wantY - camera.position.y) * eyeT

    // Recenter the ~60 m walk/solid window when the player drifts.
    if (map && followRef.current) {
      const dx = camera.position.x - map.originX
      const dz = camera.position.z - map.originZ
      if (dx * dx + dz * dz > JUMP_WALK_RECENTER * JUMP_WALK_RECENTER) {
        const now = performance.now()
        if (now - lastFollowAt.current > 250) {
          lastFollowAt.current = now
          followRef.current(camera.position.x, camera.position.z)
        }
      }
    }

    camera.rotation.order = 'YXZ'
    camera.rotation.copy(euler.current)

    // Debug line — throttle DOM updates (~10 Hz).
    if (debugRef.current) {
      const now = performance.now()
      if (now - lastDebugAt.current > 100) {
        lastDebugAt.current = now
        const keyList = [...pressed].sort().join('+') || '(none)'
        const info: JumpDebugInfo = {
          keys: keyList,
          x: camera.position.x,
          z: camera.position.z,
          walkable: map
            ? isWalkable(sampleWalk(map, camera.position.x, camera.position.z))
            : false,
          moveX,
          moveZ,
          wantDx,
          wantDz,
          gotDx,
          gotDz,
        }
        debugRef.current(info)
        ;(window as unknown as { __jumpDebug?: JumpDebugInfo }).__jumpDebug = info
      }
    }
  })

  return null
}
