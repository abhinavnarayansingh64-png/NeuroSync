/**
 * payments.js — tracks the two-stage payment for a training job:
 *   1. Base fee — paid before the job is dispatched (gated in NewJob.jsx).
 *   2. Final payment — the usage-based remainder, paid after training
 *      completes, before the trained model can be downloaded (gated in
 *      JobDetails.jsx).
 *
 * There's no real payment gateway wired up (this is a client-side demo),
 * so this is a simulated checkout record, kept alongside the rest of the
 * app's localStorage-backed state.
 */

import { STORAGE_KEYS, readStorage, writeStorage } from './storage'

function readAll() {
  return readStorage(STORAGE_KEYS.payments, {})
}

export function isFinalPaid(jobId) {
  const all = readAll()
  return !!all[jobId]?.finalPaidAt
}

export function markFinalPaid(jobId) {
  const all = readAll()
  all[jobId] = { ...all[jobId], finalPaidAt: Date.now() }
  writeStorage(STORAGE_KEYS.payments, all)
}
