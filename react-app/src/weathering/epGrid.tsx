import { useEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Raycaster,
  Vector2,
} from 'three'
import {
  GRID_DEBUG_Y,
  GRID_HALF_EXTENT,
  cornerXZ,
  resolveCell,
  type GridLayout,
} from './epGrid.ts'

type EpGridProps = {
  layout: GridLayout
  visible: boolean
  editEnabled: boolean
  onCell: (ix: number, iz: number, y: number) => void
}

/**
 * Debug lattice plus click resolution.
 * The pick ray hits the existing ground, then the hit is tested against warped quads.
 */
export function EpGrid({ layout, visible, editEnabled, onCell }: EpGridProps) {
  const { camera, gl, scene } = useThree()
  const raycaster = useMemo(() => new Raycaster(), [])
  const pointer = useMemo(() => new Vector2(), [])
  const onCellRef = useRef(onCell)
  onCellRef.current = onCell
  const layoutRef = useRef(layout)
  layoutRef.current = layout

  useEffect(() => {
    if (!editEnabled) return
    const el = gl.domElement
    let down: { id: number; x: number; y: number; dragged: boolean } | null = null
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      down = { id: event.pointerId, x: event.clientX, y: event.clientY, dragged: false }
    }
    const onMove = (event: PointerEvent) => {
      if (!down || event.pointerId !== down.id || down.dragged) return
      const dx = event.clientX - down.x
      const dy = event.clientY - down.y
      if (dx * dx + dy * dy > 36) down.dragged = true
    }
    const onUp = (event: PointerEvent) => {
      if (!down || event.pointerId !== down.id) return
      const dragged = down.dragged
      down = null
      if (dragged) return
      const target = event.target
      if (target instanceof Element && target.closest('.ep-swatches')) return
      const rect = el.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects(scene.children, true)
      const hit = hits.find((item) => item.object.visible && item.object.type === 'Mesh')
      if (!hit) return
      const { ix, iz } = resolveCell(hit.point.x, hit.point.z, layoutRef.current)
      onCellRef.current(ix, iz, hit.point.y)
    }
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [editEnabled, gl, camera, scene, raycaster, pointer])

  const group = useRef<Group>(null)

  useEffect(() => {
    const parent = group.current
    if (!parent || !visible) return
    const half = Math.ceil(GRID_HALF_EXTENT / Math.max(0.25, layout.cellSize))
    const positions: number[] = []
    const y = GRID_DEBUG_Y
    for (let iz = -half; iz <= half; iz++) {
      for (let ix = -half; ix < half; ix++) {
        const a = cornerXZ(ix, iz, layout)
        const b = cornerXZ(ix + 1, iz, layout)
        positions.push(a[0], y, a[1], b[0], y, b[1])
      }
    }
    for (let ix = -half; ix <= half; ix++) {
      for (let iz = -half; iz < half; iz++) {
        const a = cornerXZ(ix, iz, layout)
        const b = cornerXZ(ix, iz + 1, layout)
        positions.push(a[0], y, a[1], b[0], y, b[1])
      }
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geometry.computeBoundingSphere()
    const material = new LineBasicMaterial({
      color: '#f2f6fb',
      depthTest: false,
      depthWrite: false,
      fog: false,
    })
    const mesh = new LineSegments(geometry, material)
    mesh.frustumCulled = false
    mesh.renderOrder = 4
    mesh.raycast = () => {}
    parent.add(mesh)
    return () => {
      parent.remove(mesh)
      geometry.dispose()
      material.dispose()
    }
  }, [layout, visible])

  return <group ref={group} />
}
