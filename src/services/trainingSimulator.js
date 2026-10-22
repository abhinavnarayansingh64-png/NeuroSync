/**
 * Training simulator — the deterministic engine that mimics the receiver's
 * training lifecycle described in PRD Sections 3 & 4.
 *
 * DESIGN
 * ------
 * Real fine-tuning requires a GPU on a remote receiver, which cannot run on a
 * static host. This module reproduces the *observable behaviour* of that
 * pipeline entirely in the browser so the full product is demonstrable and
 * deployable. Every derived value (status, progress, metrics, logs) is a
 * pure function of a job's control timestamps and its configuration, which
 * means the simulation is fully resilient to page refreshes, pausing, and
 * resuming — there is no hidden in-memory state.
 *
 * To connect a real backend later, replace `advanceJob` / `deriveState` with
 * data streamed over a WebSocket. The job shape and status vocabulary already
 * match the PRD, so the UI layer would not need to change.
 */

import { clamp } from '../utils/format'
import { getModelById } from '../data/models'

/** Ordered lifecycle statuses (PRD Section 3: Status Tracking). */
export const JOB_STATUS = {
  INITIALIZING: 'Initializing',
  PREPARING: 'Preparing',
  DOWNLOADING: 'Downloading Model',
  LOADING_DATASET: 'Loading Dataset',
  STARTING: 'Starting Training',
  RUNNING: 'Running',
  PAUSED: 'Paused',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  CANCELED: 'Canceled',
}

/** Statuses that represent an in-flight (not terminal) job. */
export const ACTIVE_STATUSES = [
  JOB_STATUS.INITIALIZING,
  JOB_STATUS.PREPARING,
  JOB_STATUS.DOWNLOADING,
  JOB_STATUS.LOADING_DATASET,
  JOB_STATUS.STARTING,
  JOB_STATUS.RUNNING,
  JOB_STATUS.PAUSED,
]

export const TERMINAL_STATUSES = [
  JOB_STATUS.COMPLETED,
  JOB_STATUS.FAILED,
  JOB_STATUS.CANCELED,
]

export function isActiveStatus(status) {
  return ACTIVE_STATUSES.includes(status)
}

export function isTerminalStatus(status) {
  return TERMINAL_STATUSES.includes(status)
}

// Phase boundaries expressed as a fraction of total training time.
const PHASES = [
  { status: JOB_STATUS.INITIALIZING, end: 0.05 },
  { status: JOB_STATUS.PREPARING, end: 0.11 },
  { status: JOB_STATUS.DOWNLOADING, end: 0.32 },
  { status: JOB_STATUS.LOADING_DATASET, end: 0.42 },
  { status: JOB_STATUS.STARTING, end: 0.48 },
  { status: JOB_STATUS.RUNNING, end: 1.0 },
]

const RUNNING_START = 0.48 // fraction where the RUNNING phase begins

/** Deterministic pseudo-noise in [-1, 1] from an integer seed. */
function noise(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return (value - Math.floor(value)) * 2 - 1
}

/** Total simulated duration (seconds) derived from the configuration. */
function computeDurationSec(config) {
  const epochs = Number(config?.params?.epochs) || 3
  const model = getModelById(config?.modelId)
  // Larger models "download" for longer; keep the whole run demo-friendly.
  const sizeFactor = model ? Math.min(parseFloat(model.size) || 8, 20) : 8
  const seconds = 28 + epochs * 8 + sizeFactor
  return Math.round(clamp(seconds, 30, 120))
}

/** Steps-per-epoch estimate from dataset size and batch configuration. */
function computeStepsPerEpoch(config) {
  const records = Number(config?.dataset?.records) || 500
  const batchSize = Math.max(1, Number(config?.params?.batchSize) || 4)
  const gradAccum = Math.max(1, Number(config?.params?.gradientAccumulation) || 1)
  const effectiveBatch = batchSize * gradAccum
  return clamp(Math.ceil(records / effectiveBatch), 5, 300)
}

/**
 * Effective elapsed seconds for a job, accounting for pause time.
 * Uses control timestamps only, so it is stable across refreshes.
 */
function effectiveElapsedSec(job, nowMs) {
  if (job.startedAt == null) return 0
  let elapsedMs = nowMs - job.startedAt - (job.pausedAccumMs || 0)
  if (job.status === JOB_STATUS.PAUSED && job.pausedAt) {
    elapsedMs -= nowMs - job.pausedAt
  }
  return Math.max(0, elapsedMs / 1000)
}

/**
 * Derive the full live state of a job (does not mutate the job).
 * Returns progress, phase, epoch/step counters, timing and metrics.
 */
export function deriveState(job, nowMs = Date.now()) {
  const durationSec = job.durationSec || computeDurationSec(job.config)
  const elapsedSec = effectiveElapsedSec(job, nowMs)
  const rawProgress = clamp(elapsedSec / durationSec, 0, 1)

  // Terminal jobs report their frozen final values.
  if (job.status === JOB_STATUS.COMPLETED) {
    return finalizedState(job, durationSec, 1)
  }
  if (job.status === JOB_STATUS.FAILED || job.status === JOB_STATUS.CANCELED) {
    // `job.progress` is cached as a percent (0–100); finalizedState expects a
    // 0–1 fraction. Normalise so canceled/failed jobs report correct values.
    const fraction = job.progress != null ? clamp(job.progress / 100, 0, 1) : rawProgress
    return finalizedState(job, durationSec, fraction)
  }

  const progress = rawProgress
  const phaseStatus = job.status === JOB_STATUS.PAUSED ? JOB_STATUS.PAUSED : phaseForProgress(progress)

  const stepsPerEpoch = job.stepsPerEpoch || computeStepsPerEpoch(job.config)
  const epochs = Number(job.config?.params?.epochs) || 3
  const totalSteps = stepsPerEpoch * epochs

  const runningProgress = clamp((progress - RUNNING_START) / (1 - RUNNING_START), 0, 1)
  const completedSteps = Math.floor(runningProgress * totalSteps)
  const currentStep = clamp(completedSteps, 0, totalSteps)
  const displayEpoch = runningProgress > 0 ? clamp(Math.ceil(runningProgress * epochs), 1, epochs) : 0

  const remainingSec = Math.max(0, durationSec - elapsedSec)

  return {
    status: phaseStatus,
    progress: Math.round(progress * 1000) / 10, // one decimal %
    elapsedSec,
    remainingSec,
    durationSec,
    currentEpoch: displayEpoch,
    totalEpochs: epochs,
    currentStep,
    totalSteps,
    metrics: computeMetrics(job, runningProgress, phaseStatus, elapsedSec),
  }
}

function phaseForProgress(progress) {
  for (const phase of PHASES) {
    if (progress < phase.end) return phase.status
  }
  return JOB_STATUS.RUNNING
}

/** Frozen state for terminal jobs, using stored final metrics where present. */
function finalizedState(job, durationSec, progress) {
  const epochs = Number(job.config?.params?.epochs) || 3
  const stepsPerEpoch = job.stepsPerEpoch || computeStepsPerEpoch(job.config)
  const totalSteps = stepsPerEpoch * epochs
  const done = job.status === JOB_STATUS.COMPLETED
  return {
    status: job.status,
    progress: done ? 100 : Math.round((progress || 0) * 1000) / 10,
    elapsedSec: job.finalElapsedSec ?? durationSec * (progress || 0),
    remainingSec: 0,
    durationSec,
    currentEpoch: done ? epochs : clamp(Math.ceil((progress || 0) * epochs), 0, epochs),
    totalEpochs: epochs,
    currentStep: done ? totalSteps : Math.floor((progress || 0) * totalSteps),
    totalSteps,
    metrics: job.finalMetrics || computeMetrics(job, done ? 1 : progress || 0, job.status, durationSec),
  }
}

/** Compute live training metrics for the current running progress. */
function computeMetrics(job, runningProgress, status, elapsedSec) {
  // Only report training telemetry once the running phase has actually begun,
  // so a job paused during download/prep doesn't show live loss/GPU numbers.
  const isTraining = (status === JOB_STATUS.RUNNING || status === JOB_STATUS.PAUSED) && runningProgress > 0
  const warmupRatio = Number(job.config?.advanced?.warmupRatio) || 0.03
  const baseLr = Number(job.config?.params?.learningRate) || 0.0002

  // Loss: exponential decay from ~2.6 to ~0.35 with light deterministic noise.
  const seed = Math.floor(runningProgress * 200)
  const loss = isTraining
    ? Math.max(0.2, 2.6 * Math.exp(-2.7 * runningProgress) + 0.35 + noise(seed) * 0.05)
    : 0

  // Learning-rate schedule: linear warmup then cosine decay.
  let lr = 0
  if (isTraining) {
    if (runningProgress < warmupRatio) {
      lr = baseLr * (runningProgress / Math.max(warmupRatio, 1e-6))
    } else {
      const decayProgress = (runningProgress - warmupRatio) / (1 - warmupRatio)
      lr = baseLr * 0.5 * (1 + Math.cos(Math.PI * decayProgress))
    }
  }

  const model = getModelById(job.config?.modelId)
  const recommendedVram = model ? parseFloat(model.recommendedVram) || 12 : 12
  const receiverVram = Number(job.config?.receiver?.vramGb) || 24
  const vramUsedGb = isTraining
    ? Math.min(receiverVram, recommendedVram * 0.85 + noise(seed + 7) * 0.4)
    : 0
  const vramPercent = receiverVram > 0 ? (vramUsedGb / receiverVram) * 100 : 0

  const gpuUtil = isTraining
    ? clamp(92 + noise(seed + 3) * 6, 70, 99)
    : status === JOB_STATUS.DOWNLOADING || status === JOB_STATUS.LOADING_DATASET
    ? clamp(20 + noise(seed + 1) * 10, 5, 40)
    : 0

  // Training speed in steps/second, roughly stable while running.
  const speed = isTraining ? clamp(2.4 + noise(seed + 5) * 0.4, 1.2, 4) : 0

  return {
    loss: Number(loss.toFixed(4)),
    learningRate: Number(lr.toExponential(2)),
    gpuUtil: Math.round(gpuUtil),
    vramUsedGb: Number(vramUsedGb.toFixed(1)),
    vramPercent: Math.round(vramPercent),
    vramTotalGb: receiverVram,
    speed: Number(speed.toFixed(2)),
  }
}

/**
 * Build a time series of training metrics from the running phase up to the
 * job's current elapsed time. Used to render live loss / learning-rate /
 * GPU / VRAM charts. Returns an array of samples ordered by time.
 */
export function buildMetricHistory(job, nowMs = Date.now(), maxPoints = 48) {
  const durationSec = job.durationSec || computeDurationSec(job.config)
  const isDone = job.status === JOB_STATUS.COMPLETED
  const elapsed = isDone
    ? durationSec
    : job.status === JOB_STATUS.FAILED || job.status === JOB_STATUS.CANCELED
    ? job.finalElapsedSec ?? effectiveElapsedSec(job, nowMs)
    : effectiveElapsedSec(job, nowMs)

  const runningStartSec = RUNNING_START * durationSec
  if (elapsed <= runningStartSec) return []

  const span = elapsed - runningStartSec
  const points = Math.max(2, Math.min(maxPoints, Math.floor(span) + 1))
  const samples = []
  for (let i = 0; i < points; i++) {
    // Sample within (runningStart, elapsed] so the first point has a non-zero
    // running progress (avoids a misleading zero dip at the chart's start).
    const t = runningStartSec + (span * (i + 1)) / points
    const runningProgress = clamp((t / durationSec - RUNNING_START) / (1 - RUNNING_START), 0, 1)
    const metrics = computeMetrics(job, runningProgress, JOB_STATUS.RUNNING, t)
    samples.push({
      t: Math.round(t),
      loss: metrics.loss,
      learningRate: metrics.learningRate,
      gpuUtil: metrics.gpuUtil,
      vramPercent: metrics.vramPercent,
    })
  }
  return samples
}

/**
 * Build the deterministic log timeline (event list) for a job.
 * Each event has { atSec, level, message }. Ordered by time.
 */
function buildLogTimeline(job) {
  const durationSec = job.durationSec || computeDurationSec(job.config)
  const model = getModelById(job.config?.modelId)
  const modelName = model?.name || 'model'
  const epochs = Number(job.config?.params?.epochs) || 3
  const stepsPerEpoch = job.stepsPerEpoch || computeStepsPerEpoch(job.config)
  const records = Number(job.config?.dataset?.records) || 500
  const method = (job.config?.advanced?.method || 'lora').toUpperCase()

  const at = (fraction) => Math.round(fraction * durationSec * 10) / 10
  const events = []

  events.push({ atSec: at(0.0), level: 'info', message: `Job ${job.id} accepted by ${job.config?.receiver?.id}.` })
  events.push({ atSec: at(0.02), level: 'info', message: 'Initializing training environment and workspace.' })
  events.push({ atSec: at(0.06), level: 'info', message: 'Detecting GPU and verifying resource requirements.' })
  events.push({
    atSec: at(0.08),
    level: 'success',
    message: `GPU ready: ${job.config?.receiver?.gpu || 'GPU'} (${job.config?.receiver?.vram || '—'} VRAM).`,
  })
  events.push({ atSec: at(0.12), level: 'info', message: `Resolving ${modelName} from Hugging Face.` })
  ;[25, 50, 75, 100].forEach((pct, i) => {
    events.push({
      atSec: at(0.13 + (0.18 * (i + 1)) / 4),
      level: pct === 100 ? 'success' : 'info',
      message: `Downloading ${modelName}: ${pct}%${pct === 100 ? ' — verified.' : ''}`,
    })
  })
  events.push({ atSec: at(0.33), level: 'info', message: 'Loading and validating dataset records.' })
  events.push({
    atSec: at(0.4),
    level: 'success',
    message: `Dataset ready: ${records} records tokenized (avg length ${clamp(
      Math.round(48 + noise(records) * 16),
      24,
      128,
    )} tokens).`,
  })
  events.push({ atSec: at(0.44), level: 'info', message: `Applying ${method} adapters and preparing optimizer.` })
  events.push({ atSec: at(0.48), level: 'success', message: 'Training started.' })

  // Per-epoch start + a few loss updates + checkpoints across the running phase.
  for (let epoch = 1; epoch <= epochs; epoch++) {
    const epochStartFrac = RUNNING_START + ((1 - RUNNING_START) * (epoch - 1)) / epochs
    events.push({
      atSec: at(epochStartFrac + 0.005),
      level: 'info',
      message: `Epoch ${epoch}/${epochs} started.`,
    })
    const updatesPerEpoch = 3
    for (let u = 1; u <= updatesPerEpoch; u++) {
      const frac = epochStartFrac + ((1 - RUNNING_START) / epochs) * (u / (updatesPerEpoch + 1))
      const runningProgress = clamp((frac - RUNNING_START) / (1 - RUNNING_START), 0, 1)
      const step = Math.floor(runningProgress * stepsPerEpoch * epochs)
      const loss = (2.6 * Math.exp(-2.7 * runningProgress) + 0.35).toFixed(4)
      events.push({
        atSec: at(frac),
        level: 'info',
        message: `step ${step} · epoch ${epoch} · loss ${loss}`,
      })
    }
    // Checkpoint at the end of each epoch.
    events.push({
      atSec: at(epochStartFrac + (1 - RUNNING_START) / epochs - 0.01),
      level: 'info',
      message: `Checkpoint saved for epoch ${epoch}.`,
    })
  }

  events.push({ atSec: at(0.995), level: 'success', message: 'Training complete. Exporting fine-tuned adapter.' })

  return events.sort((a, b) => a.atSec - b.atSec)
}

/**
 * Advance a job to reflect the current wall-clock time. Returns a NEW job
 * object (never mutates the input) with an updated status, cached progress,
 * newly emitted log lines, and — on completion — frozen final metrics.
 *
 * The caller (DataContext) persists the returned job and reacts to any
 * status transition (notifications, model creation).
 */
export function advanceJob(job, nowMs = Date.now()) {
  // Terminal or paused jobs do not advance on their own.
  if (isTerminalStatus(job.status) || job.status === JOB_STATUS.PAUSED) {
    return job
  }

  const state = deriveState(job, nowMs)
  const timeline = job.logTimeline || buildLogTimeline(job)
  const cursor = job.logCursor || 0

  // Emit any timeline events whose scheduled time has passed.
  const newLogs = []
  let nextCursor = cursor
  for (let i = cursor; i < timeline.length; i++) {
    if (timeline[i].atSec <= state.elapsedSec) {
      newLogs.push({ ...timeline[i], ts: nowMs })
      nextCursor = i + 1
    } else {
      break
    }
  }

  const updated = {
    ...job,
    logTimeline: timeline,
    logCursor: nextCursor,
    logs: newLogs.length ? [...(job.logs || []), ...newLogs] : job.logs || [],
    status: state.status,
    progress: state.progress,
    liveElapsedSec: state.elapsedSec,
  }

  // Completion: freeze final metrics and mark completed.
  if (state.elapsedSec >= state.durationSec) {
    updated.status = JOB_STATUS.COMPLETED
    updated.progress = 100
    updated.completedAt = job.completedAt || nowMs
    updated.finalElapsedSec = state.durationSec
    updated.finalMetrics = computeMetrics(job, 1, JOB_STATUS.RUNNING, state.durationSec)
    // Ensure the very last log line is present even if the tick overshot.
    if (nextCursor < timeline.length) {
      const remaining = timeline
        .slice(nextCursor)
        .map((event) => ({ ...event, ts: nowMs }))
      updated.logs = [...updated.logs, ...remaining]
      updated.logCursor = timeline.length
    }
  }

  return updated
}

/**
 * Create a fresh job object from a validated configuration.
 * `id` is supplied by the caller (sequential JOB-XXXXXX).
 */
export function createJob(config, id, nowMs = Date.now()) {
  const durationSec = computeDurationSec(config)
  const stepsPerEpoch = computeStepsPerEpoch(config)
  const base = {
    id,
    name: config.name,
    config,
    status: JOB_STATUS.INITIALIZING,
    progress: 0,
    createdAt: nowMs,
    startedAt: nowMs,
    completedAt: null,
    pausedAt: null,
    pausedAccumMs: 0,
    durationSec,
    stepsPerEpoch,
    logs: [],
    logCursor: 0,
  }
  base.logTimeline = buildLogTimeline(base)
  return base
}

/** Pause an active job (records the pause start time). */
export function pauseJob(job, nowMs = Date.now()) {
  if (!isActiveStatus(job.status) || job.status === JOB_STATUS.PAUSED) return job
  return {
    ...job,
    status: JOB_STATUS.PAUSED,
    pausedAt: nowMs,
    logs: [
      ...(job.logs || []),
      { atSec: job.liveElapsedSec || 0, level: 'warn', message: 'Training paused by user.', ts: nowMs },
    ],
  }
}

/** Resume a paused job (accumulates the paused duration). */
export function resumeJob(job, nowMs = Date.now()) {
  if (job.status !== JOB_STATUS.PAUSED) return job
  const pausedMs = job.pausedAt ? nowMs - job.pausedAt : 0
  return {
    ...job,
    status: JOB_STATUS.RUNNING,
    pausedAt: null,
    pausedAccumMs: (job.pausedAccumMs || 0) + pausedMs,
    logs: [
      ...(job.logs || []),
      { atSec: job.liveElapsedSec || 0, level: 'info', message: 'Training resumed from latest checkpoint.', ts: nowMs },
    ],
  }
}

/** Cancel a job (terminal). */
export function cancelJob(job, nowMs = Date.now()) {
  if (isTerminalStatus(job.status)) return job
  return {
    ...job,
    status: JOB_STATUS.CANCELED,
    completedAt: nowMs,
    finalElapsedSec: job.liveElapsedSec || 0,
    failureReason: 'Cancelled by user.',
    logs: [
      ...(job.logs || []),
      { atSec: job.liveElapsedSec || 0, level: 'warn', message: 'Training cancelled by user.', ts: nowMs },
    ],
  }
}

/**
 * Retry a failed/canceled job by producing a fresh job that reuses the
 * original configuration. Caller assigns a new Job ID.
 */
export function retryConfig(job) {
  return job.config
}
