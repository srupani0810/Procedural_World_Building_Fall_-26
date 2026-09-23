export type VoxelRenderMode = 'cubes' | 'marching' | 'points' | 'raymarch'

export type VoxelParams = {
  renderMode: VoxelRenderMode
  /** XZ grid resolution (columns). */
  resolution: number
  /**
   * How much each column height blends with neighbors (0 = hard Minecraft steps,
   * 1 = strong bleed / soft hills).
   */
  bleed: number
  /**
   * How much cubes expand into neighbors (0.85 = gaps, 1 = flush, 1.08 = overlap).
   */
  overlap: number
}

export const defaultVoxelParams: VoxelParams = {
  renderMode: 'cubes',
  resolution: 32,
  bleed: 0.25,
  overlap: 1,
}

export const VOXEL_RENDER_OPTIONS: { id: VoxelRenderMode; label: string }[] = [
  { id: 'cubes', label: 'Cubes' },
  { id: 'marching', label: 'Marching Cubes' },
  { id: 'points', label: 'Points' },
  { id: 'raymarch', label: 'Ray March' },
]

/** Same ground extent as the 3D terrain plane. */
export const VOXEL_WORLD_SIZE = 4
