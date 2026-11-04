/**
 * DECAY tab params — terrain + road graph + city morphology + building fields.
 */

import { defaultTerrainParams, type TerrainParams } from '../terrainParams.ts'

/** Independent terrain defaults — edits here do not touch Weathering / Noise tabs. */
export function createDefaultDecayTerrain(): TerrainParams {
  return {
    ...defaultTerrainParams,
    extras: { ...defaultTerrainParams.extras },
  }
}

export const DECAY_SKY = '#000000'
export const DECAY_FOG = '#0a0a0a'
/** Jump In look — lighter Before sky / soft haze (orbit keeps the black field). */
export const JUMP_SKY = '#d8e2ec'
export const JUMP_SKY_ZENITH = '#aebccc'
export const JUMP_FOG = '#c4ced8'

/** Axis-aligned noise plane in DECAY: size × size, centered at origin. Not endless. */
export const DECAY_FIELD_SIZE = 520
export const DECAY_FIELD_HALF = DECAY_FIELD_SIZE / 2

/** Stage colors used across DECAY chrome. */
export const DECAY_STAGE = {
  new: '#e8e2d6',
  settled: '#d4a017',
  abandoned: '#a84828',
  reclaimed: '#6b7260',
} as const

/** Morphology display colors (layout only — not settlement stages). */
export const DECAY_MORPH = {
  sidewalk: '#7a7368',
  buildingLine: '#c8bba8',
  cornerPlot: '#9a7a3a',
  openPlot: '#5a6b52',
  plot: '#5c564c',
  main: '#5a4e44',
  collector: '#4a4038',
  local: '#3e3630',
} as const

export type DecayScreen = 'entry' | 'phase1' | 'phase2' | 'roads'
export type DecayViewTab = '3d' | '2d' | 'jump'
export type RoadEditTool = 'edit' | 'connect' | 'delete'
export type DecayLogFilter = 'all' | 'stage' | 'rule' | 'glass' | 'lamp'
export type RoadTier = 'main' | 'collector' | 'local'
export type BlockShape = 'square' | 'long'

export type DecayViewParams = {
  fogDensity: number
  editTool: RoadEditTool
  /** When false, the field ignores clicks so the camera is never blocked. */
  editingEnabled: boolean
  showRoads: boolean
  showPlots: boolean
  showNodes: boolean
  showSidewalks: boolean
  showBuildingLine: boolean
  showCornerPlots: boolean
  showOpenPlots: boolean
  showBuildings: boolean
}

export const defaultDecayView: DecayViewParams = {
  fogDensity: 0.045,
  editTool: 'edit',
  editingEnabled: true,
  showRoads: true,
  showPlots: true,
  showNodes: true,
  showSidewalks: true,
  showBuildingLine: true,
  showCornerPlots: true,
  showOpenPlots: true,
  showBuildings: true,
}

/** Floor level from footprint corner samples. */
export type FloorMode = 'lowest' | 'average' | 'highest'

export type FieldPaintMode = 'raise' | 'lower'

export type BuildingParams = {
  /** World height of one story. */
  storyHeight: number
  /** Stories at Height field = 0. */
  minStories: number
  /** Stories at Height field = 1. */
  maxStories: number
  /** Footprint fill of building line at Size field = 0. */
  minSizeFill: number
  /** Footprint fill of building line at Size field = 1. */
  maxSizeFill: number
  floorMode: FloorMode
  /** Step foundation into flat levels. */
  terrace: boolean
  /** World height of each terrace step when terrace is on. */
  terraceStep: number
  /** How hard steepness shrinks footprint and stories (0 = none). */
  steepShrink: number
  /** Active field for paint / heatmap. */
  activeField: 'height' | 'size' | 'slope'
  /** Paint brush world radius. */
  brushRadius: number
  /** Paint strength 0–1. */
  brushStrength: number
  paintMode: FieldPaintMode
  /** When true, left-drag paints the active field (camera still orbits unless Editing). */
  painting: boolean
  /** Color the ground by the active field. */
  heatmap: boolean
}

export const defaultBuildingParams: BuildingParams = {
  storyHeight: 3.1,
  minStories: 1,
  maxStories: 8,
  minSizeFill: 0.35,
  maxSizeFill: 0.92,
  floorMode: 'average',
  terrace: false,
  terraceStep: 1.2,
  steepShrink: 0.55,
  activeField: 'height',
  brushRadius: 18,
  brushStrength: 0.55,
  paintMode: 'raise',
  painting: false,
  heatmap: false,
}

/** Starting lattice + morphology for the editable road graph. */
export type RoadNetworkParams = {
  /** World spacing of the orthogonal grid. */
  spacing: number
  /** Rotation of the whole grid, degrees (0 = +X). */
  angleDeg: number
  /** Extra 45° lattice of roads. */
  diagonals: boolean
  /** World spacing of the diagonal lattice (when on). */
  diagonalSpacing: number
  /** Max |rise|/run along a road; steeper segments are skipped. */
  slopeLimit: number
  /** Half-width of local roads (collector/main use their own). Kept for pick radius. */
  roadWidth: number
  /** Half-width by tier. */
  mainWidth: number
  collectorWidth: number
  localWidth: number
  /** Clip square half-extent (matches the terrain field). */
  halfExtent: number
  /** Sidewalk strip outside each road curb. */
  sidewalkWidth: number
  /** Distance from sidewalk to building line. */
  frontSetback: number
  /** Gap between neighbouring plot sides. */
  sideSetback: number
  /** Gap at the rear of a plot. */
  backSetback: number
  /** Fillet radius at junctions. */
  cornerRadius: number
  /** Max block span before an extra split road / cut. */
  blockSize: number
  /** Square = split longest axis mid; long = prefer elongated parcels. */
  blockShape: BlockShape
  /** Target plot width along the facing road. */
  plotFrontage: number
  /** Target plot depth into the block. */
  plotDepth: number
  /** Leave a narrow service lane through long blocks. */
  backLanes: boolean
  /** Share of plots left open (parks / plazas), 0–1. */
  openPlotShare: number
  /** Lattice stride for main roads (every Nth line). */
  mainEvery: number
  /** Lattice stride for collectors (every Nth line; mains win). */
  collectorEvery: number
}

export const defaultRoadNetwork: RoadNetworkParams = {
  spacing: 16,
  angleDeg: 12,
  diagonals: false,
  diagonalSpacing: 22,
  slopeLimit: 0.42,
  roadWidth: 0.45,
  mainWidth: 1.05,
  collectorWidth: 0.7,
  localWidth: 0.45,
  halfExtent: DECAY_FIELD_HALF,
  sidewalkWidth: 0.55,
  frontSetback: 0.75,
  sideSetback: 0.3,
  backSetback: 0.4,
  cornerRadius: 0.85,
  blockSize: 30,
  blockShape: 'square',
  plotFrontage: 8,
  plotDepth: 10,
  backLanes: false,
  /** Parks track this share (land-use target band ~6–8%). */
  openPlotShare: 0.07,
  mainEvery: 4,
  collectorEvery: 2,
}

export type RoadCensus = {
  nodes: number
  roads: number
  plots: number
  junctions: number
  deadEnds: number
  blocks: number
  cornerPlots: number
  openPlots: number
  avgPlotArea: number
  roadShare: number
  sidewalkShare: number
  plotShare: number
  landIndustry: number
  landCommerce: number
  landHousing: number
  landCivic: number
  landPark: number
  landFarm: number
  landYard: number
  /** Housing form shells (plot-level, not row units). */
  housingRow: number
  housingWalkup: number
  housingTenement: number
  /** Industry / yard forms. */
  industryFactory: number
  industryWarehouse: number
  industryHeavy: number
  industryRail: number
}

export const emptyRoadCensus: RoadCensus = {
  nodes: 0,
  roads: 0,
  plots: 0,
  junctions: 0,
  deadEnds: 0,
  blocks: 0,
  cornerPlots: 0,
  openPlots: 0,
  avgPlotArea: 0,
  roadShare: 0,
  sidewalkShare: 0,
  plotShare: 0,
  landIndustry: 0,
  landCommerce: 0,
  landHousing: 0,
  landCivic: 0,
  landPark: 0,
  landFarm: 0,
  landYard: 0,
  housingRow: 0,
  housingWalkup: 0,
  housingTenement: 0,
  industryFactory: 0,
  industryWarehouse: 0,
  industryHeavy: 0,
  industryRail: 0,
}

export type DecaySelection = {
  draggingId: number | null
  selectedId: number | null
}

export function tierHalfWidth(roads: RoadNetworkParams, tier: RoadTier): number {
  if (tier === 'main') return roads.mainWidth
  if (tier === 'collector') return roads.collectorWidth
  return roads.localWidth
}
