import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { memo, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { DoubleSide, type Mesh } from 'three'
import { buildShellGeometry, footprintHalf, STORY } from './buildShell.ts'
import {
  ORTHO,
  cellCentroid,
  cellKey,
  neighborFaces,
  occupiedNeighborCount,
  pickGrowthTarget,
  resolveCell,
  syncStage,
  type V2Cell,
} from './grid.ts'
import type { V2Params } from './params.ts'
import { formatEvent, makeEvent, type ProcessEvent } from './processLog.ts'
import {
  DEMO_CLUSTER,
  PROGRAM_LABEL,
  formatProgramRule,
  resolveProgram,
} from './program.ts'
import {
  impactMode,
  STAGE_COLOR,
  STAGE_LABEL,
  vacateStage,
  type ImpactMode,
  type VacateStage,
} from './stages.ts'

type Props = {
  params: V2Params
  gridReset: number
  heightAt: (x: number, z: number) => number
  /** When stepped mode is on, bump to run one growth step. */
  stepToken: number
  /** Filled by Town so the noise ground can claim on tap. */
  groundTapRef: MutableRefObject<(wx: number, wy: number, wz: number) => void>
  onLog: (lines: string[]) => void
  onCensus: (summary: string) => void
}

export function Town({
  params,
  gridReset,
  heightAt,
  stepToken,
  groundTapRef,
  onLog,
  onCensus,
}: Props) {
  const mapRef = useRef(new Map<string, V2Cell>())
  const [revision, setRevision] = useState(0)
  const logRef = useRef<ProcessEvent[]>([])
  /** Last logged program signature — re-log when massing or height changes the program. */
  const programSigRef = useRef(new Map<string, string>())
  const growAcc = useRef(0)
  const paramsRef = useRef(params)
  paramsRef.current = params
  const marks = useMemo(
    () => ({
      thinningAt: params.thinningAt,
      vacatedAt: params.vacatedAt,
      impactedAt: params.impactedAt,
    }),
    [params.thinningAt, params.vacatedAt, params.impactedAt],
  )

  const pushLog = (event: ProcessEvent) => {
    logRef.current = [...logRef.current.slice(-96), event]
    onLog(logRef.current.map(formatEvent))
  }

  const publish = () => {
    setRevision((n) => n + 1)
    const marksNow = {
      thinningAt: paramsRef.current.thinningAt,
      vacatedAt: paramsRef.current.vacatedAt,
      impactedAt: paramsRef.current.impactedAt,
    }
    const counts: Record<VacateStage, number> = {
      held: 0,
      thinning: 0,
      vacated: 0,
      impacted: 0,
    }
    for (const cell of mapRef.current.values()) {
      counts[vacateStage(cell.age, marksNow)] += 1
    }
    onCensus(
      `${mapRef.current.size} shells · held ${counts.held} · thinning ${counts.thinning} · vacated ${counts.vacated} · impacted ${counts.impacted}`,
    )
  }

  const logProgramAround = (ix: number, iz: number) => {
    const targets = [{ ix, iz }, ...ORTHO.map(({ dix, diz }) => ({ ix: ix + dix, iz: iz + diz }))]
    for (const { ix: tx, iz: tz } of targets) {
      const cell = mapRef.current.get(cellKey(tx, tz))
      if (!cell) continue
      const key = cellKey(tx, tz)
      const { massing, program } = resolveProgram(tx, tz, cell.height, mapRef.current)
      const sig = `${program}|${massing}|${cell.height}`
      if (programSigRef.current.get(key) === sig) continue
      programSigRef.current.set(key, sig)
      pushLog(makeEvent('rule', key, formatProgramRule(program, massing, cell.height)))
    }
  }

  const claim = (ix: number, iz: number, height: number, reason: string) => {
    const key = cellKey(ix, iz)
    const existing = mapRef.current.get(key)
    const [cx, cz] = cellCentroid(ix, iz, paramsRef.current.cellSize)
    if (existing) {
      const cap = paramsRef.current.maxStories
      if (existing.height < cap) {
        existing.height += 1
        pushLog(makeEvent('stack', key, `story → ${existing.height} (${reason})`))
        const faces = neighborFaces(existing, mapRef.current)
        for (const face of faces) {
          pushLog(
            makeEvent(
              'rule',
              key,
              `${face.name}: ${face.open ? 'open wall' : `shared with ${face.neighbor!.ix},${face.neighbor!.iz}`}`,
            ),
          )
        }
        logProgramAround(ix, iz)
        publish()
      }
      return
    }
    const cell: V2Cell = {
      ix,
      iz,
      height: Math.max(1, Math.min(height, paramsRef.current.maxStories)),
      age: 0,
      lastStage: 'held',
      baseY: heightAt(cx, cz),
    }
    mapRef.current.set(key, cell)
    pushLog(makeEvent('claim', key, `${reason} · ${cell.height} stor${cell.height === 1 ? 'y' : 'ies'} · stage held`))
    // Program first so it stays in the truncated process log during dense demo seeds.
    logProgramAround(ix, iz)
    const size = paramsRef.current.cellSize
    const dens = occupiedNeighborCount(ix, iz, mapRef.current)
    const half = footprintHalf(ix, iz, size, mapRef.current)
    const frac = (half * 2) / size
    pushLog(
      makeEvent(
        'rule',
        key,
        `footprint ${(frac * 100).toFixed(0)}% of cell · density ${dens}/4 (seeded ix,iz)`,
      ),
    )
    const faces = neighborFaces(cell, mapRef.current)
    for (const face of faces) {
      pushLog(
        makeEvent(
          'rule',
          key,
          `${face.name}: ${face.open ? 'open wall' : `shared with ${face.neighbor!.ix},${face.neighbor!.iz}`}`,
        ),
      )
    }
    // Rebuild neighbor rule logs for adjacent claimed cells
    for (const face of faces) {
      if (!face.neighbor) continue
      const nKey = cellKey(face.neighbor.ix, face.neighbor.iz)
      pushLog(makeEvent('rule', nKey, `${opposite(face.name)} now shared with ${key}`))
    }
    // Neighbors may have changed massing when this lot filled in.
    logProgramAround(ix, iz)
    publish()
  }

  useEffect(() => {
    mapRef.current = new Map()
    logRef.current = []
    programSigRef.current = new Map()
    growAcc.current = 0
    pushLog(makeEvent('note', '—', 'grid reset · absence clock cleared'))
    pushLog(
      makeEvent(
        'note',
        '—',
        'demo cluster: mixed programs (pause Auto-grow to inspect)',
      ),
    )
    for (const seed of DEMO_CLUSTER) {
      claim(seed.ix, seed.iz, seed.height, seed.note)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridReset])

  useEffect(() => {
    if (stepToken <= 0) return
    const target = pickGrowthTarget(mapRef.current, paramsRef.current.maxStories)
    if (!target) {
      pushLog(makeEvent('note', '—', 'step: no empty neighbor'))
      return
    }
    claim(target.ix, target.iz, target.height, 'stepped growth')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepToken])

  useFrame((_, delta) => {
    const p = paramsRef.current
    const dt = Math.min(0.25, delta) * p.decaySpeed
    let stageChanged = false
    for (const cell of mapRef.current.values()) {
      cell.age += dt
      const next = syncStage(cell, {
        thinningAt: p.thinningAt,
        vacatedAt: p.vacatedAt,
        impactedAt: p.impactedAt,
      })
      if (next) {
        stageChanged = true
        pushLog(
          makeEvent(
            'stage',
            cellKey(cell.ix, cell.iz),
            `→ ${next} · ${STAGE_LABEL[next]} · impact ${impactMode(cell.age, {
              thinningAt: p.thinningAt,
              vacatedAt: p.vacatedAt,
              impactedAt: p.impactedAt,
            })}`,
          ),
        )
      }
    }
    if (stageChanged) publish()

    if (p.autoGrow && !p.steppedGeneration) {
      growAcc.current += delta
      if (growAcc.current >= p.growEvery) {
        growAcc.current = 0
        const target = pickGrowthTarget(mapRef.current, p.maxStories)
        if (target) claim(target.ix, target.iz, target.height, 'auto growth · attention relocating')
      }
    }
  })

  groundTapRef.current = (wx, _wy, wz) => {
    const { ix, iz } = resolveCell(wx, wz, paramsRef.current.cellSize)
    claim(ix, iz, 1, 'click claim')
  }

  const cells = useMemo(() => [...mapRef.current.values()], [revision])

  return (
    <group>
      {cells.map((cell) => (
        <Shell
          key={cellKey(cell.ix, cell.iz)}
          cell={cell}
          map={mapRef.current}
          cellSize={params.cellSize}
          marks={marks}
          revision={revision}
        />
      ))}
    </group>
  )
}

function opposite(name: string) {
  if (name === 'north') return 'south'
  if (name === 'south') return 'north'
  if (name === 'east') return 'west'
  return 'east'
}

const Shell = memo(function Shell({
  cell,
  map,
  cellSize,
  marks,
  revision,
}: {
  cell: V2Cell
  map: Map<string, V2Cell>
  cellSize: number
  marks: { thinningAt: number; vacatedAt: number; impactedAt: number }
  revision: number
}) {
  const stage = vacateStage(cell.age, marks)
  const impact = impactMode(cell.age, marks)
  const { massing, program } = useMemo(
    () => resolveProgram(cell.ix, cell.iz, cell.height, map),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cell.ix, cell.iz, cell.height, revision],
  )
  const geo = useMemo(
    () => buildShellGeometry(cell, map, stage, impact, cellSize),
    // revision forces rebuild when neighbors/height/density/program change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cell.ix, cell.iz, cell.height, stage, impact, cellSize, revision],
  )
  const meshRef = useRef<Mesh>(null)
  const [cx, cz] = cellCentroid(cell.ix, cell.iz, cellSize)
  const lean = impact === 'partial' ? 0.06 : impact === 'rust' ? 0.02 : 0

  useEffect(
    () => () => {
      geo.dispose()
    },
    [geo],
  )

  return (
    <group position={[cx, cell.baseY, cz]} rotation={[0, 0, lean]}>
      <mesh ref={meshRef} geometry={geo} castShadow={false} receiveShadow={false}>
        <meshStandardMaterial vertexColors roughness={0.95} metalness={0} side={DoubleSide} />
      </mesh>
      <Html
        position={[0, cell.height * STORY + 0.35, 0]}
        center
        style={{ pointerEvents: 'none', userSelect: 'none' }}
        distanceFactor={12}
      >
        <div
          style={{
            fontFamily: 'Martian Mono, ui-monospace, monospace',
            fontSize: 10,
            lineHeight: 1.25,
            color: '#eee',
            background: 'rgba(0,0,0,0.72)',
            border: `1px solid ${STAGE_COLOR[stage]}`,
            padding: '3px 6px',
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{ color: STAGE_COLOR[stage], fontWeight: 600 }}>
            {cell.ix},{cell.iz} · {PROGRAM_LABEL[program]}
          </div>
          <div>
            {massing} · h{cell.height} · {impactLabel(impact)}
          </div>
        </div>
      </Html>
    </group>
  )
})

function impactLabel(impact: ImpactMode) {
  if (impact === 'intact') return 'intact'
  if (impact === 'paint') return 'paint'
  if (impact === 'rust') return 'rust'
  return 'partial'
}
