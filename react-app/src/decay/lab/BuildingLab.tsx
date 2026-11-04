/**
 * DECAY Building Lab — Architecture + Materiality pages (shared draft).
 * Draft edits stay local until Apply writes buildingTypeTable + materiality.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  applyBuildingType,
  BUILDING_FORM_IDS,
  BUILDING_TYPE_DEFAULTS,
  buildingTypeChangeSummary,
  cloneBuildingType,
  getBuildingType,
  resetAllBuildingTypes,
  type BuildingFormId,
  type BuildingTypeParams,
} from '../buildingTypeTable.ts'
import {
  cloneMateriality,
  createDefaultMateriality,
  materialityFingerprint,
  type MaterialityParams,
} from '../materiality.ts'
import type { BuildingParams, RoadNetworkParams } from '../params.ts'
import { clearRowHouseGeoCache } from '../rowHouseForm.ts'
import { BuildingLabSettings } from './BuildingLabSettings.tsx'
import { BuildingLabViewer } from './BuildingLabViewer.tsx'
import { LabErrorBoundary } from './LabErrorBoundary.tsx'
import { LabVariantStrip } from './LabVariantStrip.tsx'
import { LabWearStrip } from './LabWearStrip.tsx'
import { MaterialityLabSettings } from './MaterialityLabSettings.tsx'
import { MaterialityLabViewer } from './MaterialityLabViewer.tsx'
import {
  defaultLabDraft,
  defaultLabPreview,
  draftFromLiveTable,
  draftHasChanges,
  LAB_VARIANT_COUNT,
  previewFromLotPosition,
  type LabPreview,
} from './labDraft.ts'

export type LabPage = 'architecture' | 'materiality'

type Props = {
  page: LabPage
  roads: RoadNetworkParams
  buildings: BuildingParams
  /** Live city materiality — Lab drafts a clone until Apply. */
  materialityLive: MaterialityParams
  debugEnabled?: boolean
  onAppendLog?: (lines: string[]) => void
  onRowMeshRebuild?: () => void
  onApplyMateriality?: (next: MaterialityParams) => void
}

type TypeListItem = {
  id: BuildingFormId
  label: string
  family: BuildingTypeParams['family']
  selectable: boolean
}

const FAMILY_ORDER: BuildingTypeParams['family'][] = [
  'housing',
  'commerce',
  'industry',
  'civic',
]

const FAMILY_LABEL: Record<BuildingTypeParams['family'], string> = {
  housing: 'Housing',
  commerce: 'Commerce',
  industry: 'Industry',
  civic: 'Civic',
}

function typeList(): TypeListItem[] {
  return BUILDING_FORM_IDS.map((id) => {
    const d = BUILDING_TYPE_DEFAULTS[id]
    return {
      id,
      label: d.label,
      family: d.family,
      selectable: id === 'row',
    }
  })
}

export function BuildingLab({
  page,
  roads,
  buildings,
  materialityLive,
  debugEnabled = false,
  onAppendLog,
  onRowMeshRebuild,
  onApplyMateriality,
}: Props) {
  const items = useMemo(() => typeList(), [])
  const [selected, setSelected] = useState<BuildingFormId>('row')
  const [draft, setDraft] = useState<BuildingTypeParams>(() =>
    draftFromLiveTable('row'),
  )
  const [preview, setPreview] = useState<LabPreview>(() =>
    defaultLabPreview(draftFromLiveTable('row')),
  )
  const [matDraft, setMatDraft] = useState<MaterialityParams>(() =>
    cloneMateriality(materialityLive),
  )
  const [turntable, setTurntable] = useState(false)
  const [viewReset, setViewReset] = useState(0)
  const [dirtyTick, setDirtyTick] = useState(0)

  const typeDirty = useMemo(() => {
    void dirtyTick
    return draftHasChanges(draft, selected)
  }, [draft, selected, dirtyTick])

  const matDirty = useMemo(() => {
    void dirtyTick
    return materialityFingerprint(matDraft) !== materialityFingerprint(materialityLive)
  }, [matDraft, materialityLive, dirtyTick])

  const dirty = typeDirty || matDirty

  const liveMatFp = materialityFingerprint(materialityLive)
  useEffect(() => {
    if (matDirty) return
    setMatDraft(cloneMateriality(materialityLive))
    // Sync Lab draft when city materiality updates and local mat draft is clean.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveMatFp])

  const setLot = (lotPosition: number) => {
    const i = Math.max(0, Math.min(LAB_VARIANT_COUNT - 1, Math.floor(lotPosition)))
    setPreview(previewFromLotPosition(draft, i))
  }

  const resetType = () => {
    const next = defaultLabDraft(selected)
    setDraft(next)
    setPreview(defaultLabPreview(next))
    setMatDraft(createDefaultMateriality())
    setDirtyTick((n) => n + 1)
  }

  const resetAll = () => {
    resetAllBuildingTypes()
    clearRowHouseGeoCache()
    const next = defaultLabDraft(selected)
    setDraft(next)
    setPreview(defaultLabPreview(next))
    const mat = createDefaultMateriality()
    setMatDraft(mat)
    onApplyMateriality?.(mat)
    onRowMeshRebuild?.()
    onAppendLog?.(['[lab] reset all building types + materiality → defaults'])
    setDirtyTick((n) => n + 1)
  }

  const revertDraft = () => {
    const next = draftFromLiveTable(selected)
    setDraft(next)
    setPreview(previewFromLotPosition(next, preview.lotPosition))
    setMatDraft(cloneMateriality(materialityLive))
    setDirtyTick((n) => n + 1)
  }

  const applyToCity = () => {
    if (selected !== 'row') return
    const before = cloneBuildingType(getBuildingType('row'))
    applyBuildingType('row', draft)
    clearRowHouseGeoCache()
    onRowMeshRebuild?.()
    onApplyMateriality?.(cloneMateriality(matDraft))
    const after = getBuildingType('row')
    const summary = buildingTypeChangeSummary(before, after)
    onAppendLog?.([`[lab] apply row + materiality · ${summary}`])
    setDirtyTick((n) => n + 1)
  }

  return (
    <div
      className="decay-lab"
      role="main"
      aria-label={
        page === 'architecture' ? 'Building Lab Architecture' : 'Building Lab Materiality'
      }
    >
      <nav className="decay-lab-types" aria-label="Building types">
        {FAMILY_ORDER.map((family) => {
          const group = items.filter((t) => t.family === family)
          if (group.length === 0) return null
          return (
            <div key={family} className="decay-lab-type-group">
              <h2>{FAMILY_LABEL[family]}</h2>
              <ul>
                {group.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      className={
                        selected === t.id && t.selectable ? 'is-active' : undefined
                      }
                      disabled={!t.selectable}
                      title={t.selectable ? t.label : 'Not built yet'}
                      onClick={() => {
                        if (!t.selectable) return
                        setSelected(t.id)
                        const next = draftFromLiveTable(t.id)
                        setDraft(next)
                        setPreview(defaultLabPreview(next))
                        setDirtyTick((n) => n + 1)
                      }}
                    >
                      <span className="decay-lab-type-label">{t.label}</span>
                      {!t.selectable ? (
                        <span className="decay-lab-type-todo">not built yet</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </nav>

      <div className="decay-lab-center">
        {/* Keep both pages mounted (hidden) so switching does not remount the
            canvas / reset the camera, and never rebuilds the city. */}
        <div
          className="decay-lab-page-pane"
          hidden={page !== 'architecture'}
          aria-hidden={page !== 'architecture'}
        >
          <LabErrorBoundary pageLabel="Architecture" onLog={onAppendLog}>
            <BuildingLabViewer
              draft={draft}
              preview={preview}
              plotFrontage={roads.plotFrontage}
              plotDepth={roads.plotDepth}
              storyHeight={buildings.storyHeight}
              sidewalkWidth={roads.sidewalkWidth}
              roadWidth={roads.localWidth}
              debugEnabled={debugEnabled}
              turntable={turntable}
              viewReset={viewReset}
              onTurntable={setTurntable}
              onResetView={() => setViewReset((n) => n + 1)}
            />
            <LabVariantStrip
              draft={draft}
              preview={preview}
              plotFrontage={roads.plotFrontage}
              plotDepth={roads.plotDepth}
              storyHeight={buildings.storyHeight}
              onSelect={setLot}
              onLotPosition={setLot}
            />
          </LabErrorBoundary>
        </div>
        <div
          className="decay-lab-page-pane"
          hidden={page !== 'materiality'}
          aria-hidden={page !== 'materiality'}
        >
          <LabErrorBoundary pageLabel="Materiality" onLog={onAppendLog}>
            <MaterialityLabViewer
              draft={draft}
              preview={preview}
              materiality={matDraft}
              plotFrontage={roads.plotFrontage}
              plotDepth={roads.plotDepth}
              storyHeight={buildings.storyHeight}
              sidewalkWidth={roads.sidewalkWidth}
              roadWidth={roads.localWidth}
              turntable={turntable}
              viewReset={viewReset}
              onTurntable={setTurntable}
              onResetView={() => setViewReset((n) => n + 1)}
              onMateriality={(next) => {
                setMatDraft(next)
                setDirtyTick((n) => n + 1)
              }}
            />
            <LabWearStrip
              draft={draft}
              preview={preview}
              materiality={matDraft}
              plotFrontage={roads.plotFrontage}
              plotDepth={roads.plotDepth}
              storyHeight={buildings.storyHeight}
            />
          </LabErrorBoundary>
        </div>
      </div>

      <div
        className="decay-lab-page-pane"
        hidden={page !== 'architecture'}
        aria-hidden={page !== 'architecture'}
      >
        <LabErrorBoundary pageLabel="Architecture settings" onLog={onAppendLog}>
          <BuildingLabSettings
            draft={draft}
            preview={preview}
            dirty={dirty}
            onDraft={(next) => {
              setDraft(next)
              setPreview(previewFromLotPosition(next, preview.lotPosition))
            }}
            onPreview={setPreview}
            onResetType={resetType}
            onResetAll={resetAll}
            onApply={applyToCity}
            onRevert={revertDraft}
          />
        </LabErrorBoundary>
      </div>
      <div
        className="decay-lab-page-pane"
        hidden={page !== 'materiality'}
        aria-hidden={page !== 'materiality'}
      >
        <LabErrorBoundary pageLabel="Materiality settings" onLog={onAppendLog}>
          <MaterialityLabSettings
            draft={draft}
            preview={preview}
            materiality={matDraft}
            dirty={dirty}
            onDraft={(next) => {
              setDraft(next)
              setPreview(previewFromLotPosition(next, preview.lotPosition))
            }}
            onPreview={setPreview}
            onMateriality={(next) => {
              setMatDraft(next)
              setDirtyTick((n) => n + 1)
            }}
            onResetType={resetType}
            onResetAll={resetAll}
            onApply={applyToCity}
            onRevert={revertDraft}
          />
        </LabErrorBoundary>
      </div>
    </div>
  )
}
