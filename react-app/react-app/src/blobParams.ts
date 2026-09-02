export type BlobParams = {
  size: number
  rotation: number
  blobiness: number
  frequency: number
  metalness: number
  roughness: number
}

export const defaultBlobParams: BlobParams = {
  size: 1,
  rotation: 0,
  blobiness: 0.22,
  frequency: 3.1,
  metalness: 0.15,
  roughness: 0.35,
}
