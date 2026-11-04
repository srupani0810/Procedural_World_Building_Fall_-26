/**
 * DECAY Building Lab — Stage A (Row house).
 * Draft edits stay local until Apply writes buildingTypeTable.
 */

import { useMemo, useState } from 'react'
import {
  applyBuildingType,
  BUILDING_FORM_IDS,
  BUILDING_TYPE_DEFAULTS,
  buildingTypeChangeSummary,
  cloneBuildingType,
  getBuildingType,
  resetAllBuildingTypes,
  resetBuildingType,
  type BuildingFormId,
  type BuildingTypeParams,
} from '../buildingTypeTable.ts'
import type { DecayBuildingParams, RoadNetworkParams } from '../params.ts'
import { clearRowHouseGeoCache } from '../rowHouseForm.ts'
import { BuildingLabSettings } from './BuildingLabSettings.tsx'
import { BuildingLabViewer } from './BuildingLabViewer.tsx'
import { LabVariantStrip } from './LabVariantStrip.tsx'
import {
  defaultLabDraft,
  defaultLabPreview,
  draftFromLiveTable,
  draftHasChanges,
  LAB_VARIANT_COUNT,
  previewFromLotPosition,
  type LabPreview,
} from './labDraft.ts'

type Props = {
  roads: RoadNetworkParams
  buildings: DecayBuildingParams
  debugEnabled?: boolean
  onAppendLog?: (lines: string[]) => void
  onRowMeshRebuild?: () => void
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
  roads,
  buildings,
  debugEnabled = false,
  onAppendLog,
  onRowMeshRebuild,
}: Props) {
  const items = useMemo(() => typeList(), [])
  const [selected, setSelected] = useState<BuildingFormId>('row')
  const [draft, setDraft] = useState<BuildingTypeParams>(() =>
    draftFromLiveTable('row'),
  )
  const [preview, setPreview] = useState<LabPreview>(() =>
    defaultLabPreview(draftFromLiveTable('row')),
  )
  const [turntable, setTurntable] = useState(false)
  const [viewReset, setViewReset] = useState(0)
  const [dirtyTick, setDirtyTick] = useState(0)

  const dirty = useMemo(() => {
    void dirtyTick
    return draftHasChanges(draft, selected)
  }, [draft, selected, dirtyTick])

  const setLot = (lotPosition: number) => {
    const i = Math.max(0, Math.min(LAB_VARIANT_COUNT - 1, Math.floor(lotPosition)))
    setPreview(previewFromLotPosition(draft, i))
  }

  const resetType = () => {
    resetBuildingType(selected)
    const next = defaultLabDraft(selected)
    setDraft(next)
    setPreview(defaultLabPreview(next))
    if (selected === 'row') {
      clearRowHouseGeoCache()
      onRowMeshRebuild?.()
    }
    onAppendLog?.([`[lab] reset type ${selected} → defaults`])
    setDirtyTick((n) => n + 1)
  }

  const resetAll = () => {
    resetAllBuildingTypes()
    clearRowHouseGeoCache()
    const next = defaultLabDraft(selected)
    setDraft(next)
    setPreview(defaultLabPreview(next))
    onRowMeshRebuild?.()
    onAppendLog?.(['[lab] reset all building types → defaults'])
    setDirtyTick((n) => n + 1)
  }

  const revertDraft = () => {
    const next = draftFromLiveTable(selected)
    setDraft(next)
    setPreview(previewFromLotPosition(next, preview.lotPosition))
    setDirtyTick((n) => n + 1)
  }

  const applyToCity = () => {
    if (selected !== 'row') return
    const before = cloneBuildingType(getBuildingType('row'))
    applyBuildingType('row', draft)
    clearRowHouseGeoCache()
    onRowMeshRebuild?.()
    const after = getBuildingType('row')
    const summary = buildingTypeChangeSummary(before, after)
    onAppendLog?.([`[lab] apply row · ${summary}`])
    setDirtyTick((n) => n + 1)
  }

  return (
    <div className="decay-lab" role="main" aria-label="Building Lab">
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
      </div>

      <BuildingLabSettings
        draft={draft}
        preview={preview}
        dirty={dirty}
        onDraft={setDraft}
        onPreview={setPreview}
        onResetType={resetType}
        onResetAll={resetAll}
        onApply={applyToCity}
        onRevert={revertDraft}
      />
    </div>
  )
}
