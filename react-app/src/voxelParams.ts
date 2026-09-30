export type VoxelRenderMode = 'marching' | 'interactive'

export type VoxelParams = {
  renderMode: VoxelRenderMode
  /** Cells per axis for each chunk’s N³ density grid. */
  resolution: number
  /** Solid when density >= isolevel. */
  isolevel: number
  /**
   * 3D blur on the density grid (0 = hard voxels, 1 = soft bleed into neighbors).
   * Applied with a world-sampled halo so chunk borders stay seamless.
   */
  bleed: number
  /**
   * How much interactive cubes expand into neighbors (unused by greedy mesh; kept for UI).
   */
  overlap: number
  /**
   * How much 3D noise digs into / bulges the height-based density (caves / overhangs).
   */
  volume: number
  /** Chebyshev radius (in chunks) to keep loaded around the camera. */
  loadRadius: number
}

export const defaultVoxelParams: VoxelParams = {
  renderMode: 'interactive',
  resolution: 16,
  isolevel: 0,
  bleed: 0.1,
  overlap: 1,
  volume: 0,
  loadRadius: 1,
}

export const VOXEL_RENDER_OPTIONS: { id: VoxelRenderMode; label: string }[] = [
  { id: 'marching', label: 'Marching Cubes' },
  { id: 'interactive', label: 'Interactive' },
]

/** World-space edge length of one cubic chunk (matches old single-grid extent). */
export const VOXEL_CHUNK_SIZE = 4

/** @deprecated use VOXEL_CHUNK_SIZE — kept for any stray imports */
export const VOXEL_WORLD_SIZE = VOXEL_CHUNK_SIZE
