/**
 * DECAY shared building-type table — single source for massing + form params.
 * City mass* / applyLandUseMassing / detail builders read from here.
 * Values match the previous hard-coded builders (visual parity). No Math.random.
 *
 * Lab (later) can mutate rows and rebuild; defaults stay in BUILDING_TYPE_DEFAULTS.
 */

import { COMMERCE_BEFORE } from './commercePalette.ts'
import { HOUSE_BEFORE } from './housePalette.ts'
import { INDUSTRY_BEFORE } from './industryPalette.ts'

/** Form ids used by the Lab + city table. */
export type BuildingFormId =
  | 'row'
  | 'walkup'
  | 'tenement'
  | 'cornerShop'
  | 'mainBlock'
  | 'factory'
  | 'warehouse'
  | 'heavyPlant'
  | 'railYard'
  | 'civic'

export type RoofKind =
  | 'gable'
  | 'flatCornice'
  | 'sawtooth'
  | 'shed'
  | 'none'
  /** Row: pick between gable and flatCornice by variation. */
  | 'gableOrFlat'

export type WindowLayoutId = 'even' | 'paired' | 'bay'

/** How variants are chosen — never Math.random. */
export type VariationRule =
  | 'blockPosition'
  | 'distanceToCenter'
  | 'blockPositionAndRim'
  | 'none'

export type BuildingTypeSize = {
  storyMin: number
  storyMax: number
  /** Multiplier on oriented footprint width. */
  widthMult: number
  /** Multiplier on oriented footprint depth. */
  depthMult: number
  minWidth: number
  minDepth: number
  /** Row house unit band along the front. */
  unitMin?: number
  unitMax?: number
  unitGap?: number
  /** Fraction of plot depth left as rear yard (row). */
  yardFrac?: number
  /**
   * How far the mass sits toward the street: 0 = centered,
   * 0.5 = front-aligned by (plotDepth − massDepth) * frac.
   */
  frontShiftFrac?: number
}

export type BuildingTypeRoof = {
  kind: RoofKind
  /** Pitch rise (unit space) for gable / sawtooth — 0 if flat/none. */
  pitch: number
  overhang: number
  parapetHeight: number
}

export type BuildingTypeWindows = {
  /** TODO when parts kit missing. */
  implemented: boolean
  columns: number
  /** Vertical window bands (Lab); city still uses story loop. */
  rows: number
  /** Layouts available for variation (row). */
  layouts: readonly WindowLayoutId[]
  sizeW: number
  sizeH: number
  frameDepth: number
  sillDepth: number
  lintel: boolean
  bayAllowed: boolean
}

export type BuildingTypeEntrance = {
  /** Absolute |door X| in unit space (row / walk-up). */
  doorOffset: number
  stoopSteps: number
  chimneyCount: number
  /** Porch canopy over the stoop (row). */
  porchRoof: boolean
  awning: boolean
  fireEscape: boolean
  waterTank: boolean
}

export type BuildingTypeColors = {
  /** Primary wall hex, or tone list for pickIndex. */
  wall: string
  wallTones: readonly string[]
  trim: string
  roof: string
  doorTones: readonly string[]
  awningTones: readonly string[]
}

export type BuildingTypeVariation = {
  rule: VariationRule
  note: string
}

export type BuildingTypeParams = {
  id: BuildingFormId
  label: string
  family: 'housing' | 'commerce' | 'industry' | 'civic'
  /** Parts-kit mesh exists in the city today. */
  partsKit: boolean
  /** Gaps the Lab should show as “not built yet”. */
  todos: readonly string[]
  size: BuildingTypeSize
  roof: BuildingTypeRoof
  windows: BuildingTypeWindows
  entrance: BuildingTypeEntrance
  colors: BuildingTypeColors
  variation: BuildingTypeVariation
}

const NO_WINDOWS: BuildingTypeWindows = {
  implemented: false,
  columns: 0,
  rows: 0,
  layouts: [],
  sizeW: 0,
  sizeH: 0,
  frameDepth: 0,
  sillDepth: 0,
  lintel: false,
  bayAllowed: false,
}


/** Immutable defaults — Lab Reset restores from this. */
export const BUILDING_TYPE_DEFAULTS: Record<BuildingFormId, BuildingTypeParams> = {
  row: {
    id: 'row',
    label: 'Row house',
    family: 'housing',
    partsKit: true,
    todos: [],
    size: {
      storyMin: 2,
      storyMax: 4,
      widthMult: 1,
      depthMult: 1,
      minWidth: 2.15,
      minDepth: 2.4,
      unitMin: 2.15,
      unitMax: 3.4,
      unitGap: 0.38,
      yardFrac: 0.38,
      frontShiftFrac: 0.5,
    },
    roof: {
      kind: 'gableOrFlat',
      pitch: 0.35,
      overhang: 0.06,
      parapetHeight: 0.18,
    },
    windows: {
      implemented: true,
      columns: 2,
      /** ≥ storyMax so city keeps a window band on every story. */
      rows: 4,
      layouts: ['even', 'paired', 'bay'],
      sizeW: 0.16,
      sizeH: 0.22,
      frameDepth: 0.02,
      sillDepth: 0.05,
      lintel: true,
      bayAllowed: true,
    },
    entrance: {
      doorOffset: 0.22,
      stoopSteps: 3,
      chimneyCount: 1,
      porchRoof: true,
      awning: false,
      fireEscape: false,
      waterTank: false,
    },
    colors: {
      wall: HOUSE_BEFORE.brick,
      wallTones: [HOUSE_BEFORE.brick],
      trim: HOUSE_BEFORE.trim,
      roof: HOUSE_BEFORE.roof,
      doorTones: HOUSE_BEFORE.doors,
      awningTones: [],
    },
    variation: {
      rule: 'blockPosition',
      note: 'plotId × unitIndex along the block → roof, door side, door color, window layout',
    },
  },

  walkup: {
    id: 'walkup',
    label: 'Walk-up',
    family: 'housing',
    partsKit: true,
    todos: [],
    size: {
      storyMin: 4,
      storyMax: 6,
      widthMult: 0.96,
      depthMult: 0.72,
      minWidth: 5.5,
      minDepth: 3.6,
      frontShiftFrac: 0.5,
    },
    roof: {
      kind: 'flatCornice',
      pitch: 0,
      overhang: 0.06,
      parapetHeight: 0.18,
    },
    windows: {
      implemented: true,
      columns: 3,
      rows: 2,
      layouts: ['even', 'bay'],
      sizeW: 0.14,
      sizeH: 0.22,
      frameDepth: 0.02,
      sillDepth: 0.05,
      lintel: true,
      bayAllowed: true,
    },
    entrance: {
      doorOffset: 0,
      stoopSteps: 2,
      chimneyCount: 1,
      porchRoof: false,
      awning: false,
      fireEscape: true,
      waterTank: false,
    },
    colors: {
      wall: HOUSE_BEFORE.walkupBodies[0]!,
      wallTones: HOUSE_BEFORE.walkupBodies,
      trim: HOUSE_BEFORE.trim,
      roof: HOUSE_BEFORE.roof,
      doorTones: HOUSE_BEFORE.doors,
      awningTones: [],
    },
    variation: {
      rule: 'blockPositionAndRim',
      note: 'plotId + rim (distance to center) → body/door tone, bay, chimney',
    },
  },

  tenement: {
    id: 'tenement',
    label: 'Tenement',
    family: 'housing',
    partsKit: false,
    todos: [
      'parts kit mesh',
      'roof (flat + water tank)',
      'windows',
      'entrance / fire escape',
      'Before palette on mesh (box wear today)',
    ],
    size: {
      storyMin: 4,
      storyMax: 6,
      widthMult: 0.95,
      depthMult: 0.82,
      minWidth: 5.5,
      minDepth: 4.2,
      frontShiftFrac: 0.25,
    },
    roof: { kind: 'none', pitch: 0, overhang: 0, parapetHeight: 0 },
    windows: NO_WINDOWS,
    entrance: {
      doorOffset: 0,
      stoopSteps: 0,
      chimneyCount: 0,
      porchRoof: false,
      awning: false,
      fireEscape: false,
      waterTank: true,
    },
    colors: {
      wall: HOUSE_BEFORE.brick,
      wallTones: [HOUSE_BEFORE.brick],
      trim: HOUSE_BEFORE.trim,
      roof: HOUSE_BEFORE.roof,
      doorTones: HOUSE_BEFORE.doors,
      awningTones: [],
    },
    variation: {
      rule: 'none',
      note: 'box shell only — variation TODO with parts kit',
    },
  },

  cornerShop: {
    id: 'cornerShop',
    label: 'Corner shop',
    family: 'commerce',
    partsKit: true,
    todos: [],
    size: {
      storyMin: 1,
      storyMax: 2,
      widthMult: 0.95,
      depthMult: 0.9,
      minWidth: 4.2,
      minDepth: 3.6,
      frontShiftFrac: 0,
    },
    roof: {
      kind: 'flatCornice',
      pitch: 0,
      overhang: 0.06,
      parapetHeight: 0.12,
    },
    windows: {
      implemented: true,
      columns: 3,
      rows: 2,
      layouts: ['even'],
      sizeW: 0.2,
      sizeH: 0.55,
      frameDepth: 0.02,
      sillDepth: 0.04,
      lintel: false,
      bayAllowed: false,
    },
    entrance: {
      doorOffset: 0,
      stoopSteps: 0,
      chimneyCount: 0,
      porchRoof: false,
      awning: true,
      fireEscape: false,
      waterTank: false,
    },
    colors: {
      wall: COMMERCE_BEFORE.bricks[0]!,
      wallTones: COMMERCE_BEFORE.bricks,
      trim: COMMERCE_BEFORE.trim,
      roof: COMMERCE_BEFORE.roof,
      doorTones: COMMERCE_BEFORE.awnings,
      awningTones: COMMERCE_BEFORE.awnings,
    },
    variation: {
      rule: 'blockPositionAndRim',
      note: 'plotId + rim → brick / awning tone; floors from Height field',
    },
  },

  mainBlock: {
    id: 'mainBlock',
    label: 'Main-street block',
    family: 'commerce',
    partsKit: true,
    todos: [],
    size: {
      storyMin: 2,
      storyMax: 4,
      widthMult: 0.95,
      depthMult: 0.9,
      minWidth: 4.2,
      minDepth: 3.6,
      frontShiftFrac: 0,
    },
    roof: {
      kind: 'flatCornice',
      pitch: 0,
      overhang: 0.06,
      parapetHeight: 0.12,
    },
    windows: {
      implemented: true,
      columns: 4,
      rows: 2,
      layouts: ['even'],
      sizeW: 0.14,
      sizeH: 0.28,
      frameDepth: 0.02,
      sillDepth: 0.04,
      lintel: true,
      bayAllowed: false,
    },
    entrance: {
      doorOffset: 0,
      stoopSteps: 0,
      chimneyCount: 0,
      porchRoof: false,
      awning: true,
      fireEscape: false,
      waterTank: false,
    },
    colors: {
      wall: COMMERCE_BEFORE.bricks[0]!,
      wallTones: COMMERCE_BEFORE.bricks,
      trim: COMMERCE_BEFORE.trim,
      roof: COMMERCE_BEFORE.roof,
      doorTones: COMMERCE_BEFORE.awnings,
      awningTones: COMMERCE_BEFORE.awnings,
    },
    variation: {
      rule: 'blockPositionAndRim',
      note: 'plotId + rim → brick / awning; upper window grid columns fixed',
    },
  },

  factory: {
    id: 'factory',
    label: 'Factory',
    family: 'industry',
    partsKit: true,
    todos: ['long-façade windows'],
    size: {
      storyMin: 1,
      storyMax: 3,
      widthMult: 1.4,
      depthMult: 1.05,
      minWidth: 6.5,
      minDepth: 4.2,
      frontShiftFrac: 0.35,
    },
    roof: {
      kind: 'sawtooth',
      pitch: 0.2,
      overhang: 0.04,
      parapetHeight: 0,
    },
    windows: NO_WINDOWS,
    entrance: {
      doorOffset: 0,
      stoopSteps: 0,
      chimneyCount: 1,
      porchRoof: false,
      awning: false,
      fireEscape: false,
      waterTank: false,
    },
    colors: {
      wall: INDUSTRY_BEFORE.bodies[0]!,
      wallTones: INDUSTRY_BEFORE.bodies,
      trim: INDUSTRY_BEFORE.trim,
      roof: INDUSTRY_BEFORE.roof,
      doorTones: [],
      awningTones: [],
    },
    variation: {
      rule: 'blockPosition',
      note: 'plotId → body tone; stack / yard from recipe',
    },
  },

  warehouse: {
    id: 'warehouse',
    label: 'Warehouse',
    family: 'industry',
    partsKit: true,
    todos: [],
    size: {
      storyMin: 1,
      storyMax: 2,
      widthMult: 1.35,
      depthMult: 0.7,
      minWidth: 6,
      minDepth: 3.2,
      frontShiftFrac: 0.45,
    },
    roof: {
      kind: 'shed',
      pitch: 0.08,
      overhang: 0.04,
      parapetHeight: 0,
    },
    windows: {
      implemented: true,
      columns: 2,
      rows: 2,
      layouts: ['even'],
      sizeW: 0.14,
      sizeH: 0.18,
      frameDepth: 0.02,
      sillDepth: 0,
      lintel: false,
      bayAllowed: false,
    },
    entrance: {
      doorOffset: 0,
      stoopSteps: 0,
      chimneyCount: 0,
      porchRoof: false,
      awning: false,
      fireEscape: false,
      waterTank: false,
    },
    colors: {
      wall: INDUSTRY_BEFORE.bodies[0]!,
      wallTones: INDUSTRY_BEFORE.bodies,
      trim: INDUSTRY_BEFORE.trim,
      roof: INDUSTRY_BEFORE.roof,
      doorTones: [],
      awningTones: [],
    },
    variation: {
      rule: 'blockPosition',
      note: 'plotId → body tone; end windows from recipe',
    },
  },

  heavyPlant: {
    id: 'heavyPlant',
    label: 'Heavy plant',
    family: 'industry',
    partsKit: true,
    todos: ['façade windows'],
    size: {
      storyMin: 2,
      storyMax: 4,
      widthMult: 1.5,
      depthMult: 1.15,
      minWidth: 7,
      minDepth: 5,
      frontShiftFrac: 0,
    },
    roof: {
      kind: 'shed',
      pitch: 0.08,
      overhang: 0.04,
      parapetHeight: 0,
    },
    windows: NO_WINDOWS,
    entrance: {
      doorOffset: 0,
      stoopSteps: 0,
      chimneyCount: 3,
      porchRoof: false,
      awning: false,
      fireEscape: false,
      waterTank: true,
    },
    colors: {
      wall: INDUSTRY_BEFORE.bodies[0]!,
      wallTones: INDUSTRY_BEFORE.bodies,
      trim: INDUSTRY_BEFORE.trim,
      roof: INDUSTRY_BEFORE.roof,
      doorTones: [],
      awningTones: [],
    },
    variation: {
      rule: 'blockPosition',
      note: 'plotId → body tone + stack count (2|3)',
    },
  },

  railYard: {
    id: 'railYard',
    label: 'Rail yard',
    family: 'industry',
    partsKit: true,
    todos: ['building roof (pad + water tower only)'],
    size: {
      storyMin: 1,
      storyMax: 1,
      widthMult: 1.2,
      depthMult: 1.15,
      minWidth: 0,
      minDepth: 0,
      frontShiftFrac: 0,
    },
    roof: { kind: 'none', pitch: 0, overhang: 0, parapetHeight: 0 },
    windows: NO_WINDOWS,
    entrance: {
      doorOffset: 0,
      stoopSteps: 0,
      chimneyCount: 0,
      porchRoof: false,
      awning: false,
      fireEscape: false,
      waterTank: true,
    },
    colors: {
      wall: INDUSTRY_BEFORE.ballast,
      wallTones: [INDUSTRY_BEFORE.ballast],
      trim: INDUSTRY_BEFORE.metalDark,
      roof: INDUSTRY_BEFORE.roof,
      doorTones: [],
      awningTones: [],
    },
    variation: {
      rule: 'none',
      note: 'yard land-use → rail pad; no block variants',
    },
  },

  civic: {
    id: 'civic',
    label: 'Civic',
    family: 'civic',
    partsKit: false,
    todos: [
      'parts kit mesh',
      'roof',
      'windows',
      'entrance / details',
      'town hall subtype',
      'other civic form subtypes',
      'Before palette on mesh (box wear today)',
    ],
    size: {
      storyMin: 2,
      storyMax: 4,
      widthMult: 0.88,
      depthMult: 0.85,
      minWidth: 4,
      minDepth: 3.5,
      frontShiftFrac: 0,
    },
    roof: { kind: 'none', pitch: 0, overhang: 0, parapetHeight: 0 },
    windows: NO_WINDOWS,
    entrance: {
      doorOffset: 0,
      stoopSteps: 0,
      chimneyCount: 0,
      porchRoof: false,
      awning: false,
      fireEscape: false,
      waterTank: false,
    },
    colors: {
      wall: '#5a6a8a',
      wallTones: ['#5a6a8a'],
      trim: HOUSE_BEFORE.trim,
      roof: HOUSE_BEFORE.roof,
      doorTones: [],
      awningTones: [],
    },
    variation: {
      rule: 'none',
      note: 'single civic box — subtypes TODO',
    },
  },
}

/** Deep-ish clone for Lab draft / Reset — does not touch the live city table. */
export function cloneBuildingType(t: BuildingTypeParams): BuildingTypeParams {
  return {
    ...t,
    todos: [...t.todos],
    size: { ...t.size },
    roof: { ...t.roof },
    windows: { ...t.windows, layouts: [...t.windows.layouts] },
    entrance: { ...t.entrance },
    colors: {
      ...t.colors,
      wallTones: [...t.colors.wallTones],
      doorTones: [...t.colors.doorTones],
      awningTones: [...t.colors.awningTones],
    },
    variation: { ...t.variation },
  }
}

function cloneType(t: BuildingTypeParams): BuildingTypeParams {
  return cloneBuildingType(t)
}

function cloneTable(): Record<BuildingFormId, BuildingTypeParams> {
  const out = {} as Record<BuildingFormId, BuildingTypeParams>
  for (const id of Object.keys(BUILDING_TYPE_DEFAULTS) as BuildingFormId[]) {
    out[id] = cloneType(BUILDING_TYPE_DEFAULTS[id])
  }
  return out
}

/** Live table the city reads — Lab Apply will write here later. */
export const buildingTypeTable: Record<BuildingFormId, BuildingTypeParams> =
  cloneTable()

export const BUILDING_FORM_IDS = Object.keys(
  BUILDING_TYPE_DEFAULTS,
) as BuildingFormId[]

export function getBuildingType(id: BuildingFormId): BuildingTypeParams {
  return buildingTypeTable[id]
}

/** Story range for storiesFromField — always from the live table. */
export function typeStoryRange(id: BuildingFormId): {
  min: number
  max: number
} {
  const s = buildingTypeTable[id].size
  return { min: s.storyMin, max: s.storyMax }
}

/** Map industry kind union → table id. */
export function industryKindToFormId(
  kind: 'factory' | 'warehouse' | 'heavy' | 'rail',
): BuildingFormId {
  if (kind === 'heavy') return 'heavyPlant'
  if (kind === 'rail') return 'railYard'
  return kind
}

export function formIdToIndustryKind(
  id: BuildingFormId,
): 'factory' | 'warehouse' | 'heavy' | 'rail' | null {
  if (id === 'factory' || id === 'warehouse') return id
  if (id === 'heavyPlant') return 'heavy'
  if (id === 'railYard') return 'rail'
  return null
}

/** Restore one type (or all) to defaults — Lab Reset. */
export function resetBuildingType(id: BuildingFormId) {
  buildingTypeTable[id] = cloneType(BUILDING_TYPE_DEFAULTS[id])
}

export function resetAllBuildingTypes() {
  for (const id of BUILDING_FORM_IDS) resetBuildingType(id)
}
