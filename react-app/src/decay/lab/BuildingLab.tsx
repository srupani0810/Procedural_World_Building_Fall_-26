/**
 * DECAY Building Lab — full-page type studio (Row house only for steps 2–4).
 * Draft edits do not write the live city buildingTypeTable.
 */

import { useMemo, useState } from 'react'
import {
  BUILDING_FORM_IDS,
  BUILDING_TYPE_DEFAULTS,
  type BuildingFormId,
  type BuildingTypeParams,
} from '../buildingTypeTable.ts'
import type { DecayBuildingParams, RoadNetworkParams } from '../params.ts'
import { BuildingLabSettings } from './BuildingLabSettings.tsx'
import { BuildingLabViewer } from './BuildingLabViewer.tsx'
import {
  defaultLabDraft,
  defaultLabPreview,
  type LabPreview,
} from './labDraft.ts'

type Props = {
  roads: RoadNetworkParams
  buildings: DecayBuildingParams
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
      // Steps 2–4: Row house only.
      selectable: id === 'row',
    }
  })
}

export function BuildingLab({ roads, buildings }: Props) {
  const items = useMemo(() => typeList(), [])
  const [selected, setSelected] = useState<BuildingFormId>('row')
  const [draft, setDraft] = useState<BuildingTypeParams>(() => defaultLabDraft('row'))
  const [preview, setPreview] = useState<LabPreview>(() =>
    defaultLabPreview(defaultLabDraft('row')),
  )

  const resetType = () => {
    const next = defaultLabDraft(selected)
    setDraft(next)
    setPreview(defaultLabPreview(next))
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
                        selected === t.id && t.selectable
                          ? 'is-active'
                          : undefined
                      }
                      disabled={!t.selectable}
                      title={t.selectable ? t.label : 'Not built yet'}
                      onClick={() => {
                        if (!t.selectable) return
                        setSelected(t.id)
                        const next = defaultLabDraft(t.id)
                        setDraft(next)
                        setPreview(defaultLabPreview(next))
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
        />
        <div className="decay-lab-variants" aria-label="Variants">
          {/* Strip chrome for layout (full 6-up comes in a later step). */}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={
                i === 0
                  ? 'decay-lab-variant-slot is-active'
                  : 'decay-lab-variant-slot'
              }
            >
              <span>V{i + 1}</span>
            </div>
          ))}
        </div>
      </div>

      <BuildingLabSettings
        draft={draft}
        preview={preview}
        onDraft={setDraft}
        onPreview={setPreview}
        onReset={resetType}
      />
    </div>
  )
}
