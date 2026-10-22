/**
 * Thin, safe wrapper around localStorage.
 *
 * Every access is wrapped in try/catch so the app degrades gracefully in
 * private-browsing modes or when storage is full/unavailable. All keys are
 * namespaced under `neurosync.` to avoid collisions with other apps hosted
 * on the same origin.
 */

const NAMESPACE = 'neurosync'

export const STORAGE_KEYS = {
  auth: `${NAMESPACE}.auth`,
  users: `${NAMESPACE}.users`,
  jobs: `${NAMESPACE}.jobs`,
  jobSequence: `${NAMESPACE}.jobSequence`,
  models: `${NAMESPACE}.models`,
  notifications: `${NAMESPACE}.notifications`,
  settings: `${NAMESPACE}.settings`,
  payments: `${NAMESPACE}.payments`,
}

/**
 * Read and JSON-parse a value from localStorage.
 * @returns the parsed value, or `fallback` on any error / missing key.
 */
export function readStorage(key, fallback = null) {
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw)
  } catch (error) {
    // Corrupted value or storage unavailable — fall back safely.
    console.warn(`[storage] Failed to read "${key}":`, error)
    return fallback
  }
}

/**
 * JSON-stringify and persist a value.
 * @returns true on success, false on failure (e.g. quota exceeded).
 */
export function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (error) {
    console.warn(`[storage] Failed to write "${key}":`, error)
    return false
  }
}

/** Remove a single key. */
export function removeStorage(key) {
  try {
    window.localStorage.removeItem(key)
  } catch (error) {
    console.warn(`[storage] Failed to remove "${key}":`, error)
  }
}
