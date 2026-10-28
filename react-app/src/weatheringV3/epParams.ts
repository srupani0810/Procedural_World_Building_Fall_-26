/**
 * Weathering v3 params — independent copy of Weathering's epParams.
 * Do not import from weathering/ or weatheringV2/. No water system.
 */
import type { GradientStop } from '../heightGradient.ts'
import { defaultTerrainParams, type TerrainParams } from '../terrainParams.ts'
import { defaultVoxelParams, type VoxelParams } from '../voxelParams.ts'

/** Stage assigned to scenery. Random spreads the four stages across the ring. */
export type BackgroundStageBias = 'random' | 'new' | 'settled' | 'abandoned' | 'reclaimed'

export type EpParams = {
  /** Soft mist fog density (Voxel Cloud depth). */
  fogDensity: number
  /** Filigree / porous grain on the EP material (0–2). */
  glitchIntensity: number
  /** Settlement quad spacing. Independent of voxel resolution. */
  cellSize: number
  /** Visual size of each house. Lot spacing stays on cell size. */
  buildingScale: number
  /** Corner noise strength. 0 keeps the lattice rigid. */
  gridWarp: number
  /** Debug lines for the settlement grid. */
  gridVisible: boolean
  /** Idle claims spread from the existing settlement. */
  autoGrow: boolean
  /** Seconds between autonomous claims. */
  autoGrowSeconds: number
  /** Tallest column a click can stack on one lot. */
  maxStories: number
  /** How many background columns are scattered around the camera. */
  backgroundDensity: number
  /**
   * Story-height multiplier for scenery. Matches Grid building scale at ×3.
   * Footprint stays on the lot, the same way player houses do.
   */
  backgroundBuildingScale: number
  /** Nearest distance from the camera that scenery may stand. */
  backgroundMinDistance: number
  /** Farthest distance from the camera that scenery may stand. */
  backgroundMaxDistance: number
  /** Shortest background column, in stories. Independent of Max height. */
  backgroundMinStories: number
  /** Tallest background column, in stories. Independent of Max height. */
  backgroundMaxStories: number
  /** Which decay stage background columns are built in. */
  backgroundStageBias: BackgroundStageBias
  /** Bumped by Regenerate. Rerolls scenery only. */
  backgroundSeed: number
}

export type DecayParams = {
  /** Multiplier on age per real second. 1 keeps the original clock. */
  decaySpeed: number
  /** Age when a cell leaves New. */
  settledAt: number
  /** Age when a cell leaves Settled. */
  abandonedAt: number
  /** Age when a cell leaves Abandoned. */
  reclaimedAt: number
  /** Scales rust, staining, and cracks without moving the stage ages. */
  wearIntensity: number
  /** How often a Settled bulb flickers instead of holding a dim steady glow. */
  flickerProbability: number
  /** Share of cells that keep a barrel fire once Abandoned. */
  fireBarrelChance: number
}

export const defaultDecayParams: DecayParams = {
  decaySpeed: 1,
  settledAt: 8,
  abandonedAt: 20,
  reclaimedAt: 40,
  wearIntensity: 1,
  flickerProbability: 0.55,
  fireBarrelChance: 0.38,
}

/** Added to the Fog density slider when the town is fully reclaimed. */
export const DECAY_FOG_LIFT = 0.12

/**
 * Orbit haze at this density matches the shipped clear field.
 * The slider and town decay only thicken fog once density rises past it.
 */
export const ORBIT_FOG_ANCHOR = 0.045

/** Slider baseline plus the town's decay share. The slider is not replaced. */
export function fogDensityWithTownDecay(baseline: number, townDecay: number) {
  const share = Math.min(1, Math.max(0, townDecay))
  return baseline + share * DECAY_FOG_LIFT
}

/**
 * 0 at the clear-orbit baseline. 1 when the slider is at its max and the town is fully reclaimed.
 */
export function orbitFogThicken(density: number) {
  const span = 0.15 - ORBIT_FOG_ANCHOR + DECAY_FOG_LIFT
  return Math.min(1, Math.max(0, (density - ORBIT_FOG_ANCHOR) / span))
}

export const defaultEpParams: EpParams = {
  /**
   * Slider thickness for linear Fog: higher → opaque sooner past EP_FOG_NEAR.
   * Near field stays clear; density only tightens the horizon fade.
   */
  fogDensity: 0.045,
  glitchIntensity: 0.65,
  cellSize: 1.85,
  buildingScale: 3,
  gridWarp: 0.55,
  gridVisible: false,
  autoGrow: true,
  autoGrowSeconds: 6,
  maxStories: 8,
  backgroundDensity: 22,
  backgroundBuildingScale: 3,
  backgroundMinDistance: 36,
  backgroundMaxDistance: 110,
  backgroundMinStories: 2,
  backgroundMaxStories: 7,
  backgroundStageBias: 'random',
  backgroundSeed: 1,
}

/** Fastest and slowest autonomous claim spacing, in seconds. */
export const AUTO_GROW_FAST_SECONDS = 3
export const AUTO_GROW_SLOW_SECONDS = 180

export function formatAutoGrow(seconds: number) {
  if (seconds < 60) return `every ${Math.round(seconds)}s`
  const minutes = seconds / 60
  return `every ${minutes >= 10 ? minutes.toFixed(0) : minutes.toFixed(1)} min`
}

/**
 * EP-owned terrain defaults — independent copy of the shared terrain defaults so
 * Noise / Voxels / Shaders edits never mutate the Playground field.
 */
export function createDefaultEpTerrain(): TerrainParams {
  return {
    ...defaultTerrainParams,
    extras: { ...defaultTerrainParams.extras },
  }
}

/**
 * EP-owned voxel/world defaults — Interactive streaming only; not linked to
 * Voxels `voxelParams` or Shaders study mesh settings.
 */
export function createDefaultEpVoxel(): VoxelParams {
  return {
    ...defaultVoxelParams,
    renderMode: 'interactive',
    resolution: 16,
    /** Keep modest — 3D Chebyshev cost is (2r+1)³; endless feel comes from ground + fog. */
    loadRadius: 2,
    isolevel: 0,
    bleed: 0.12,
    volume: 0.15,
    overlap: 1,
  }
}

/**
 * Dead-gray horizon. Fog uses the same value so the field fades into the sky
 * with no color seam. Overhead is a slightly lighter gray.
 */
export const EP_SKY_COLOR = '#3a4046'

/** Fog matches the horizon so distant terrain dissolves into the sky. */
export const EP_FOG_COLOR = EP_SKY_COLOR

/**
 * First-person (Jump In): fog starts at this distance — nearby ground stays clear,
 * horizon softens into an endless haze as you walk.
 */
export const EP_FOG_NEAR_FP = 12

/**
 * Orbit / overview: clear through near–mid range; haze only near the field rim.
 * Tuned to sit just inside a ~80-unit ground half-extent so the edge soft-fades.
 */
export const EP_FOG_NEAR_ORBIT = 54

/** @deprecated use EP_FOG_NEAR_FP — kept for any stray imports */
export const EP_FOG_NEAR = EP_FOG_NEAR_FP

export function epFogNear(firstPerson: boolean) {
  return firstPerson ? EP_FOG_NEAR_FP : EP_FOG_NEAR_ORBIT
}

/**
 * Linear Fog far (full opacity).
 * FP: higher `fogDensity` pulls the opaque horizon in (endless-walk haze).
 * Orbit: light rim fade at the loaded field edge (near–mid stay readable).
 */
export function epFogFar(fogDensity: number, firstPerson = true) {
  const minD = 0.02
  const maxD = 0.15
  const t = Math.min(1, Math.max(0, (fogDensity - minD) / (maxD - minD)))
  // Town decay can push density past the slider max. That extra only shortens `far`.
  const extra = Math.min(1, Math.max(0, (fogDensity - maxD) / DECAY_FOG_LIFT))
  if (!firstPerson) {
    // Soft boundary haze only — density gently pulls the rim in (82 → 70).
    // Bird’s-eye zoom shifts this band outward in FogController so the field stays clear.
    return 82 - t * 12 - extra * 18
  }
  // density 0.02 → far ~78; 0.15 → far ~28 (horizon fades into sky while walking)
  const farMin = EP_FOG_NEAR_FP + 16
  const farMax = 78
  const base = farMax + (farMin - farMax) * t
  return Math.max(EP_FOG_NEAR_FP + 8, base - extra * 14)
}

/** Ground half-extent budget — past FP fog so Jump In never reveals a rim. */
export function epFogReach(fogDensity: number) {
  return Math.max(epFogFar(fogDensity, true), epFogFar(fogDensity, false) + 8)
}

/** Height colors for Interactive mesh only. */
export const EP_TOWN_GRADIENT: GradientStop[] = [
  { id: 'ep-deep', position: 0, color: '#1a1c20' },
  { id: 'ep-low', position: 0.28, color: '#2c3038' },
  { id: 'ep-mid', position: 0.55, color: '#4a505a' },
  { id: 'ep-high', position: 0.78, color: '#6e7682' },
  { id: 'ep-crest', position: 1, color: '#9aa1ab' },
]

/** Fixed scaffold-link density for pale filigree spans. */
export const EP_SCAFFOLD_DENSITY = 0.38
