/**
 * ID generation helpers.
 * Job IDs follow the PRD format: JOB-000001, JOB-000002, ...
 */

/** Zero-pad a number to a fixed width. */
function pad(num, width = 6) {
  return String(num).padStart(width, '0')
}

/**
 * Build a sequential Job ID from a numeric sequence value.
 * @param {number} sequence - monotonically increasing counter.
 * @returns {string} e.g. "JOB-000001"
 */
export function formatJobId(sequence) {
  return `JOB-${pad(sequence)}`
}

/**
 * Generate a reasonably unique id for client-side entities
 * (models, notifications, logs). Avoids external dependencies.
 */
export function uid(prefix = 'id') {
  const random = Math.random().toString(36).slice(2, 10)
  const time = Date.now().toString(36)
  return `${prefix}_${time}${random}`
}
