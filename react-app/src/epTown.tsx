import { memo, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  MeshStandardMaterial,
  ShaderMaterial,
} from 'three'
import {
  GRID_ORTHO,
  cellCentroid,
  cellCorners,
  gridKey,
  neighborCell,
  pickGrowthCell,
  type GridCell,
  type GridLayout,
  type XZ,
} from './epGrid.ts'

export const TOWN_STORY = 1.05
const COLUMN_R = 0.2
const WALL_T = 0.16

/** Claimed settlement cell. Identity and corners live on the grid. */
export type TownCell = GridCell

export const TOWN_SWATCHES = [
  { id: 'magenta', label: 'Magenta', plaster: '#2a2428', glow: '#ff2bd6' },
  { id: 'cyan', label: 'Cyan', plaster: '#1c2428', glow: '#3ee0ff' },
  { id: 'red', label: 'Red', plaster: '#2a1818', glow: '#ff3344' },
  { id: 'ash', label: 'Ash', plaster: '#16181b', glow: '#9aa3ad' },
] as const

type V = [number, number, number]
type RGB = [number, number, number]

const plasterRgb = TOWN_SWATCHES.map((swatch) => {
  const c = new Color(swatch.plaster)
  return [c.r, c.g, c.b] as RGB
})
const glowRgb = TOWN_SWATCHES.map((swatch) => {
  const c = new Color(swatch.glow)
  return [c.r, c.g, c.b] as RGB
})

function hash2(ix: number, iz: number, salt: number) {
  const n = Math.sin(ix * 127.1 + iz * 311.7 + salt * 17.3) * 43758.5453
  return n - Math.floor(n)
}

function pushQuad(
  dst: number[],
  nrm: number[],
  col: number[],
  a: V,
  b: V,
  c: V,
  d: V,
  rgb: RGB,
  outwardFrom: V,
) {
  const ax = b[0] - a[0]
  const ay = b[1] - a[1]
  const az = b[2] - a[2]
  const bx = c[0] - a[0]
  const by = c[1] - a[1]
  const bz = c[2] - a[2]
  let nx = ay * bz - az * by
  let ny = az * bx - ax * bz
  let nz = ax * by - ay * bx
  const len = Math.hypot(nx, ny, nz) || 1
  nx /= len
  ny /= len
  nz /= len
  const toward =
    nx * (a[0] - outwardFrom[0]) + ny * (a[1] - outwardFrom[1]) + nz * (a[2] - outwardFrom[2])
  const flip = toward < 0
  const tris = flip
    ? [
        [a, c, b],
        [a, d, c],
      ]
    : [
        [a, b, c],
        [a, c, d],
      ]
  const fn = flip ? ([-nx, -ny, -nz] as V) : ([nx, ny, nz] as V)
  for (const [p, q, r] of tris) {
    for (const v of [p, q, r]) {
      dst.push(v[0], v[1], v[2])
      nrm.push(fn[0], fn[1], fn[2])
      col.push(rgb[0], rgb[1], rgb[2])
    }
  }
}

function toGeo(pos: number[], nrm: number[], col: number[]) {
  const geo = new BufferGeometry()
  if (pos.length > 0) {
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
    geo.setAttribute('normal', new Float32BufferAttribute(nrm, 3))
    geo.setAttribute('color', new Float32BufferAttribute(col, 3))
  }
  return geo
}

type Side = { open: boolean; neighbor: TownCell | null; a: XZ; b: XZ; inward: XZ }

function lotSides(cell: TownCell, around: Array<TownCell | null>, layout: GridLayout): Side[] {
  const corners = cellCorners(cell.ix, cell.iz, layout)
  const [cx, cz] = cellCentroid(cell.ix, cell.iz, layout)
  return corners.map((a, i) => {
    const b = corners[(i + 1) % 4]
    const mx = (a[0] + b[0]) / 2
    const mz = (a[1] + b[1]) / 2
    const vx = cx - mx
    const vz = cz - mz
    const len = Math.hypot(vx, vz) || 1
    const neighbor = around[i] ?? null
    return {
      open: !neighbor || neighbor.height < cell.height,
      neighbor,
      a,
      b,
      inward: [vx / len, vz / len] as XZ,
    }
  })
}

function addColumn(
  pos: number[],
  nrm: number[],
  col: number[],
  x: number,
  z: number,
  y0: number,
  y1: number,
  rgb: RGB,
) {
  const steps = 10
  const center: V = [x, (y0 + y1) / 2, z]
  for (let i = 0; i < steps; i++) {
    const a0 = (i / steps) * Math.PI * 2
    const a1 = ((i + 1) / steps) * Math.PI * 2
    const p0: V = [x + Math.cos(a0) * COLUMN_R, y0, z + Math.sin(a0) * COLUMN_R]
    const p1: V = [x + Math.cos(a1) * COLUMN_R, y0, z + Math.sin(a1) * COLUMN_R]
    const p2: V = [p1[0], y1, p1[2]]
    const p3: V = [p0[0], y1, p0[2]]
    pushQuad(pos, nrm, col, p0, p1, p2, p3, rgb, center)
  }
  const cap = Array.from({ length: steps }, (_, i) => {
    const a = (i / steps) * Math.PI * 2
    return [x + Math.cos(a) * COLUMN_R, y1, z + Math.sin(a) * COLUMN_R] as V
  })
  for (let i = 1; i < steps - 1; i++) {
    pushQuad(pos, nrm, col, cap[0], cap[i], cap[i + 1], cap[0], rgb, [x, y0, z])
  }
}

function addArchWall(
  pos: number[],
  nrm: number[],
  col: number[],
  gpos: number[],
  gnrm: number[],
  gcol: number[],
  side: Side,
  y0: number,
  y1: number,
  rgb: RGB,
  glow: RGB,
  withOpening: boolean,
) {
  const span: V = [side.b[0] - side.a[0], 0, side.b[1] - side.a[1]]
  const length = Math.hypot(span[0], span[2]) || 1
  const tx = span[0] / length
  const tz = span[2] / length
  const cut = COLUMN_R * 1.15
  const x0 = side.a[0] + tx * cut
  const z0 = side.a[1] + tz * cut
  const x1 = side.b[0] - tx * cut
  const z1 = side.b[1] - tz * cut
  const inn = side.inward
  const yMid = y0 + (y1 - y0) * 0.62
  const center: V = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]

  const prism = (ax: number, az: number, bx: number, bz: number, ya: number, yb: number) => {
    const a0: V = [ax, ya, az]
    const b0: V = [bx, ya, bz]
    const a1: V = [ax, yb, az]
    const b1: V = [bx, yb, bz]
    const ai0: V = [ax + inn[0] * WALL_T, ya, az + inn[1] * WALL_T]
    const bi0: V = [bx + inn[0] * WALL_T, ya, bz + inn[1] * WALL_T]
    const ai1: V = [ai0[0], yb, ai0[2]]
    const bi1: V = [bi0[0], yb, bi0[2]]
    pushQuad(pos, nrm, col, a0, b0, b1, a1, rgb, center)
    pushQuad(pos, nrm, col, ai0, ai1, bi1, bi0, rgb, center)
    pushQuad(pos, nrm, col, a1, b1, bi1, ai1, rgb, [center[0], ya - 1, center[2]])
    pushQuad(pos, nrm, col, a0, ai0, bi0, b0, rgb, [center[0], yb + 1, center[2]])
  }

  if (!withOpening) {
    prism(x0, z0, x1, z1, y0, y1)
    return
  }

  const leftX = x0 + (x1 - x0) * 0.22
  const leftZ = z0 + (z1 - z0) * 0.22
  const rightX = x0 + (x1 - x0) * 0.78
  const rightZ = z0 + (z1 - z0) * 0.78
  prism(x0, z0, leftX, leftZ, y0, y1)
  prism(rightX, rightZ, x1, z1, y0, y1)
  prism(leftX, leftZ, rightX, rightZ, yMid, y1)

  const archSteps = 8
  for (let i = 0; i < archSteps; i++) {
    const t0 = Math.PI - (i / archSteps) * Math.PI
    const t1 = Math.PI - ((i + 1) / archSteps) * Math.PI
    const u0 = (Math.cos(t0) * -1 + 1) / 2
    const u1 = (Math.cos(t1) * -1 + 1) / 2
    const h0 = Math.sin(t0) * (yMid - y0) * 0.92
    const h1 = Math.sin(t1) * (yMid - y0) * 0.92
    const ax = leftX + (rightX - leftX) * u0
    const az = leftZ + (rightZ - leftZ) * u0
    const bx = leftX + (rightX - leftX) * u1
    const bz = leftZ + (rightZ - leftZ) * u1
    prism(ax, az, bx, bz, y0 + Math.min(h0, h1), y0 + Math.max(h0, h1) + WALL_T)
    const slit: V = [ax + inn[0] * (WALL_T + 0.02), y0 + (h0 + h1) / 2, az + inn[1] * (WALL_T + 0.02)]
    const slitB: V = [bx + inn[0] * (WALL_T + 0.02), slit[1], bz + inn[1] * (WALL_T + 0.02)]
    const slitT: V = [slitB[0], slit[1] + 0.05, slitB[2]]
    const slitT0: V = [slit[0], slit[1] + 0.05, slit[2]]
    pushQuad(gpos, gnrm, gcol, slit, slitB, slitT, slitT0, glow, [center[0] - inn[0], center[1], center[2] - inn[1]])
  }

  const wx0 = leftX + (rightX - leftX) * 0.35
  const wz0 = leftZ + (rightZ - leftZ) * 0.35
  const wx1 = leftX + (rightX - leftX) * 0.65
  const wz1 = leftZ + (rightZ - leftZ) * 0.65
  const wy = yMid + (y1 - yMid) * 0.45
  const glowY = 0.07
  const face = (y: number, lift: number): [V, V, V, V] => {
    const s = 1 + lift
    const a: V = [wx0 + inn[0] * WALL_T * s, y, wz0 + inn[1] * WALL_T * s]
    const b: V = [wx1 + inn[0] * WALL_T * s, y, wz1 + inn[1] * WALL_T * s]
    return [a, b, [b[0], y + glowY, b[2]], [a[0], y + glowY, a[2]]]
  }
  const core = face(wy, 1.05)
  pushQuad(gpos, gnrm, gcol, core[0], core[1], core[2], core[3], glow, center)
  const halo = face(wy - 0.04, 1.8)
  const dim: RGB = [glow[0] * 0.22, glow[1] * 0.22, glow[2] * 0.22]
  pushQuad(gpos, gnrm, gcol, halo[0], halo[1], halo[2], halo[3], dim, center)
}

function addStairs(
  pos: number[],
  nrm: number[],
  col: number[],
  side: Side,
  yLow: number,
  yHigh: number,
  rgb: RGB,
) {
  const steps = Math.min(7, Math.max(3, Math.ceil((yHigh - yLow) / 0.24)))
  const [cx, , cz] = [side.inward[0], 0, side.inward[1]]
  const center: V = [(side.a[0] + side.b[0]) / 2, (yLow + yHigh) / 2, (side.a[1] + side.b[1]) / 2]
  for (let s = 0; s < steps; s++) {
    const t0 = s / steps
    const t1 = (s + 1) / steps
    const yA = yLow + (yHigh - yLow) * t0
    const yB = yLow + (yHigh - yLow) * t1
    const d0 = 0.18 + t0 * 0.7
    const d1 = 0.18 + t1 * 0.7
    const a0: V = [side.a[0] + cx * d0, yB, side.a[1] + cz * d0]
    const b0: V = [side.b[0] + cx * d0, yB, side.b[1] + cz * d0]
    const a1: V = [side.a[0] + cx * d1, yB, side.a[1] + cz * d1]
    const b1: V = [side.b[0] + cx * d1, yB, side.b[1] + cz * d1]
    pushQuad(pos, nrm, col, a0, b0, b1, a1, rgb, [center[0], yA - 1, center[2]])
    pushQuad(pos, nrm, col, a0, a1, [a1[0], yA, a1[2]], [a0[0], yA, a0[2]], rgb, center)
  }
}

function addRoof(
  pos: number[],
  nrm: number[],
  col: number[],
  gpos: number[],
  gnrm: number[],
  gcol: number[],
  cell: TownCell,
  rgb: RGB,
  glow: RGB,
  showSign: boolean,
  layout: GridLayout,
) {
  const [cx, cz] = cellCentroid(cell.ix, cell.iz, layout)
  const y = cell.baseY + cell.height * TOWN_STORY
  const corners = cellCorners(cell.ix, cell.iz, layout)
  const outer = corners.map((p) => [p[0] + (cx - p[0]) * 0.08, p[1] + (cz - p[1]) * 0.08] as XZ)
  const inner = outer.map((p) => [p[0] + (cx - p[0]) * 0.22, p[1] + (cz - p[1]) * 0.22] as XZ)
  const thickness = 0.14
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4
    const o0: V = [outer[i][0], y, outer[i][1]]
    const o1: V = [outer[j][0], y, outer[j][1]]
    const i0: V = [inner[i][0], y + thickness, inner[i][1]]
    const i1: V = [inner[j][0], y + thickness, inner[j][1]]
    pushQuad(pos, nrm, col, o0, o1, i1, i0, rgb, [cx, y - 1, cz])
    const strip: RGB = [glow[0] * 0.55, glow[1] * 0.55, glow[2] * 0.55]
    const e0: V = [o0[0], y + 0.02, o0[2]]
    const e1: V = [o1[0], y + 0.02, o1[2]]
    pushQuad(
      gpos,
      gnrm,
      gcol,
      e0,
      e1,
      [e1[0], e1[1] + 0.035, e1[2]],
      [e0[0], e0[1] + 0.035, e0[2]],
      strip,
      [cx, y - 1, cz],
    )
  }
  const top = inner.map((p) => [p[0], y + thickness, p[1]] as V)
  pushQuad(pos, nrm, col, top[0], top[1], top[2], top[3], rgb, [cx, y - 1, cz])

  if (showSign) {
    const s = 0.06
    const mast: V[] = [
      [cx - s, y + thickness, cz - s],
      [cx + s, y + thickness, cz - s],
      [cx + s, y + thickness + 0.46, cz + s],
      [cx - s, y + thickness + 0.46, cz - s],
    ]
    pushQuad(gpos, gnrm, gcol, mast[0], mast[1], mast[2], mast[3], glow, [cx, y, cz])
  }
}

type LotNeighbors = {
  south: TownCell | null
  east: TownCell | null
  north: TownCell | null
  west: TownCell | null
}

export function buildLotGeometry(cell: TownCell, neighbors: LotNeighbors, layout: GridLayout) {
  const pos: number[] = []
  const nrm: number[] = []
  const col: number[] = []
  const gpos: number[] = []
  const gnrm: number[] = []
  const gcol: number[] = []
  const rgb = plasterRgb[cell.color] ?? plasterRgb[0]
  const glow = glowRgb[cell.color] ?? glowRgb[0]
  const around = [neighbors.south, neighbors.east, neighbors.north, neighbors.west]
  const sides = lotSides(cell, around, layout)
  const y0 = cell.baseY
  const y1 = cell.baseY + cell.height * TOWN_STORY
  const [cx, cz] = cellCentroid(cell.ix, cell.iz, layout)

  const corners = cellCorners(cell.ix, cell.iz, layout)
  for (let k = 0; k < 4; k++) {
    const prev = sides[(k + 3) % 4]
    const next = sides[k]
    if (prev.open && next.open) {
      const c = corners[k]
      const insetX = c[0] + (cx - c[0]) * 0.2
      const insetZ = c[1] + (cz - c[1]) * 0.2
      addColumn(pos, nrm, col, insetX, insetZ, y0, y1, rgb)
    }
  }

  sides.forEach((side) => {
    if (!side.open) return
    const neighbor = side.neighbor
    if (neighbor && neighbor.height < cell.height) {
      addStairs(
        pos,
        nrm,
        col,
        side,
        neighbor.baseY + neighbor.height * TOWN_STORY,
        y1,
        rgb,
      )
      addArchWall(pos, nrm, col, gpos, gnrm, gcol, side, neighbor.baseY + neighbor.height * TOWN_STORY, y1, rgb, glow, false)
      return
    }
    addArchWall(pos, nrm, col, gpos, gnrm, gcol, side, y0, y1, rgb, glow, true)
  })

  const mask =
    (neighbors.north ? 1 : 0) +
    (neighbors.east ? 2 : 0) +
    (neighbors.south ? 4 : 0) +
    (neighbors.west ? 8 : 0)
  addRoof(pos, nrm, col, gpos, gnrm, gcol, cell, rgb, glow, hash2(cell.ix, cell.iz, mask) > 0.62, layout)

  return { plaster: toGeo(pos, nrm, col), glow: toGeo(gpos, gnrm, gcol) }
}

const FEED_VERT = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.999, 1.0);
}
`
const FEED_FRAG = /* glsl */ `
uniform float uTime;
uniform float uAmount;
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
void main() {
  vec2 uv = gl_FragCoord.xy;
  float g = hash(floor(uv * 0.45) + floor(uTime * 10.0));
  float edge = smoothstep(48.0, 0.0, min(gl_FragCoord.x, gl_FragCoord.y));
  vec3 col = vec3(g * 0.14 * uAmount);
  col.r += edge * 0.09 * uAmount;
  col.b += edge * 0.04 * uAmount;
  gl_FragColor = vec4(col, 0.42);
}
`

function FeedGrade({ amount }: { amount: number }) {
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
        uniforms: { uTime: { value: 0 }, uAmount: { value: amount } },
        vertexShader: FEED_VERT,
        fragmentShader: FEED_FRAG,
      }),
    [],
  )
  useEffect(() => {
    if (mat.uniforms.uAmount) mat.uniforms.uAmount.value = amount
  }, [mat, amount])
  useEffect(() => () => mat.dispose(), [mat])
  useFrame((_, delta) => {
    if (mat.uniforms.uTime) mat.uniforms.uTime.value += delta
  })
  return (
    <mesh frustumCulled={false} renderOrder={1000} raycast={() => null}>
      <planeGeometry args={[2, 2]} />
      <primitive object={mat} attach="material" />
    </mesh>
  )
}

const LotMesh = memo(function LotMesh({
  cell,
  south,
  east,
  north,
  west,
  cellSize,
  warp,
}: {
  cell: TownCell
  south: TownCell | null
  east: TownCell | null
  north: TownCell | null
  west: TownCell | null
  cellSize: number
  warp: number
}) {
  const built = useMemo(
    () => buildLotGeometry(cell, { south, east, north, west }, { cellSize, warp }),
    [
      cell.ix,
      cell.iz,
      cell.height,
      cell.color,
      cell.baseY,
      south?.height,
      south?.baseY,
      east?.height,
      east?.baseY,
      north?.height,
      north?.baseY,
      west?.height,
      west?.baseY,
      cellSize,
      warp,
    ],
  )
  useEffect(() => {
    return () => {
      built.plaster.dispose()
      built.glow.dispose()
    }
  }, [built])

  const plasterMat = useMemo(
    () =>
      new MeshStandardMaterial({
        vertexColors: true,
        roughness: 1,
        metalness: 0,
        side: DoubleSide,
      }),
    [],
  )
  const glowMat = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {},
        vertexShader: /* glsl */ `
          attribute vec3 color;
          varying vec3 vColor;
          void main() {
            vColor = color;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec3 vColor;
          void main() {
            gl_FragColor = vec4(vColor, 1.0);
          }
        `,
        toneMapped: false,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      }),
    [],
  )
  useEffect(() => {
    return () => {
      plasterMat.dispose()
      glowMat.dispose()
    }
  }, [plasterMat, glowMat])

  const plasterCount = built.plaster.getAttribute('position')?.count ?? 0
  const glowCount = built.glow.getAttribute('position')?.count ?? 0
  return (
    <>
      {plasterCount > 0 ? <mesh geometry={built.plaster} material={plasterMat} /> : null}
      {glowCount > 0 ? <mesh geometry={built.glow} material={glowMat} raycast={() => null} /> : null}
    </>
  )
})

/** Each click on an existing cell advances its color. Height stays put until the palette wraps, which removes one story. */
export function applyTownClick(
  existing: TownCell | undefined,
  swatch: number,
  place: { ix: number; iz: number; baseY: number },
): TownCell | null {
  if (!existing) {
    return {
      ix: place.ix,
      iz: place.iz,
      baseY: place.baseY,
      height: 1,
      color: swatch,
    }
  }
  const nextColor = existing.color + 1
  if (nextColor < TOWN_SWATCHES.length) {
    return { ...existing, color: nextColor }
  }
  if (existing.height > 1) {
    return { ...existing, height: existing.height - 1, color: 0 }
  }
  return null
}

const TOUCH = [
  [0, 0],
  [GRID_ORTHO.south.dix, GRID_ORTHO.south.diz],
  [GRID_ORTHO.east.dix, GRID_ORTHO.east.diz],
  [GRID_ORTHO.north.dix, GRID_ORTHO.north.diz],
  [GRID_ORTHO.west.dix, GRID_ORTHO.west.diz],
] as const

function neighborColors(map: Map<string, TownCell>, ix: number, iz: number) {
  const colors: number[] = []
  for (const dir of Object.values(GRID_ORTHO)) {
    const neighbor = map.get(gridKey(ix + dir.dix, iz + dir.diz))
    if (neighbor) colors.push(neighbor.color)
  }
  return colors
}

type TownProps = {
  cellsRef: { current: Map<string, TownCell> }
  layout: GridLayout
  editEnabled: boolean
  grain: number
  /** Bumped when the grid map is cleared from outside (Reset Grid). */
  claimRevision: number
  editBridge: MutableRefObject<(ix: number, iz: number, y: number) => void>
  autoGrow: boolean
  autoGrowSeconds: number
  /** Terrain height at a cell, matching the ground sheet. */
  groundAt: (ix: number, iz: number) => number
}

export function EpSalvageTown({
  cellsRef,
  layout,
  editEnabled,
  grain,
  claimRevision,
  editBridge,
  autoGrow,
  autoGrowSeconds,
  groundAt,
}: TownProps) {
  const [color, setColor] = useState(0)
  const [lots, setLots] = useState<TownCell[]>([])
  const colorRef = useRef(color)
  colorRef.current = color
  const groundAtRef = useRef(groundAt)
  groundAtRef.current = groundAt

  const publish = (ix: number, iz: number) => {
    const map = cellsRef.current
    for (const [dx, dz] of TOUCH) {
      const item = map.get(gridKey(ix + dx, iz + dz))
      if (item) map.set(gridKey(ix + dx, iz + dz), { ...item })
    }
    setLots(Array.from(map.values()))
  }

  const editAt = (ix: number, iz: number, y: number) => {
    const key = gridKey(ix, iz)
    const map = cellsRef.current
    const next = applyTownClick(map.get(key), colorRef.current, { ix, iz, baseY: y })
    if (next) map.set(key, next)
    else map.delete(key)
    publish(ix, iz)
  }
  editBridge.current = editAt

  const growOnce = () => {
    const map = cellsRef.current
    const spot = pickGrowthCell(map)
    if (!spot) return
    const key = gridKey(spot.ix, spot.iz)
    if (map.has(key)) return
    const nearby = neighborColors(map, spot.ix, spot.iz)
    const swatch =
      nearby.length > 0 && Math.random() < 0.72
        ? nearby[Math.floor(Math.random() * nearby.length)]
        : Math.floor(Math.random() * TOWN_SWATCHES.length)
    const height = hash2(spot.ix, spot.iz, 9) > 0.78 ? 2 : 1
    map.set(key, {
      ix: spot.ix,
      iz: spot.iz,
      height,
      color: swatch,
      baseY: groundAtRef.current(spot.ix, spot.iz),
    })
    publish(spot.ix, spot.iz)
  }
  const growRef = useRef(growOnce)
  growRef.current = growOnce

  useEffect(() => {
    if (!autoGrow) return
    const delay = Math.max(0.25, autoGrowSeconds) * 1000
    const id = window.setInterval(() => growRef.current(), delay)
    return () => window.clearInterval(id)
  }, [autoGrow, autoGrowSeconds])

  useEffect(() => {
    setLots(Array.from(cellsRef.current.values()))
  }, [claimRevision, cellsRef])

  return (
    <>
      {lots.map((cell) => (
        <LotMesh
          key={gridKey(cell.ix, cell.iz)}
          cell={cell}
          cellSize={layout.cellSize}
          warp={layout.warp}
          south={neighborCell(cellsRef.current, cell.ix, cell.iz, GRID_ORTHO.south)}
          east={neighborCell(cellsRef.current, cell.ix, cell.iz, GRID_ORTHO.east)}
          north={neighborCell(cellsRef.current, cell.ix, cell.iz, GRID_ORTHO.north)}
          west={neighborCell(cellsRef.current, cell.ix, cell.iz, GRID_ORTHO.west)}
        />
      ))}
      <FeedGrade amount={0.35 + grain * 0.35} />
      {editEnabled ? (
        <Html fullscreen style={{ pointerEvents: 'none' }}>
          <div className="ep-swatches">
            {TOWN_SWATCHES.map((swatch, index) => (
              <button
                key={swatch.id}
                type="button"
                className={index === color ? 'is-active' : undefined}
                style={{ background: swatch.glow }}
                aria-label={swatch.label}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation()
                  setColor(index)
                }}
              />
            ))}
          </div>
        </Html>
      ) : null}
    </>
  )
}
