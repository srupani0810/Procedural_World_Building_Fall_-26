/**
 * DECAY Debug mode preference — localStorage only.
 * When disabled, no debug collectors / overlays / panels should mount.
 * No Math.random.
 */

export const DECAY_DEBUG_STORAGE_KEY = 'decay.debug.enabled'

/** Read persisted Debug on/off. Missing / invalid → false (off by default). */
export function readDebugEnabled(): boolean {
  try {
    return window.localStorage.getItem(DECAY_DEBUG_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function writeDebugEnabled(on: boolean): void {
  try {
    window.localStorage.setItem(DECAY_DEBUG_STORAGE_KEY, on ? '1' : '0')
  } catch {
    // Quota / private mode — ignore; in-memory toggle still works this session.
  }
}
