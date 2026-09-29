export type VoxelRenderMode = 'marching' | 'interactive'

export type VoxelParams = {
  renderMode: VoxelRenderMode
  /** Cells per axis for the N³ density grid. */
  resolution: number
  /** Solid when density >= isolevel. */
  isolevel: number
  /**
   * 3D blur on the density grid (0 = hard voxels, 1 = soft bleed into neighbors).
   */
  bleed: number
  /**
   * How much interactive cubes expand into neighbors (0.85 = gaps, 1 = flush, 1.08 = overlap).
   */
  overlap: number
  /**
   * How much 3D noise digs into / bulges the height-based density (caves / overhangs).
   */
  volume: number
}

export const defaultVoxelParams: VoxelParams = {
  renderMode: 'interactive',
  resolution: 28,
  isolevel: 0,
  bleed: 0.15,
  overlap: 1,
  volume: 0.35,
}

export const VOXEL_RENDER_OPTIONS: { id: VoxelRenderMode; label: string }[] = [
  { id: 'marching', label: 'Marching Cubes' },
  { id: 'interactive', label: 'Interactive' },
]

/** Same ground extent as the 3D terrain plane. */
export const VOXEL_WORLD_SIZE = 4
