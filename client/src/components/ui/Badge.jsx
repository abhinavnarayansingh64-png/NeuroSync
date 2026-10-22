/**
 * Badge & StatusBadge — small status pills.
 *
 * StatusBadge maps every job/receiver status to a consistent colour and a
 * pulsing dot for in-flight states, so status reads the same everywhere.
 */

import { JOB_STATUS } from '../../constants/jobStatus'

// Tones map to the restrained palette: cyan for active/brand, warm-muted
// semantics only where meaning requires differentiation.
const TONES = {
  neutral: 'bg-surface text-content-secondary border border-border',
  cyan: 'bg-accent-soft text-accent border border-accent-border',
  success: 'bg-status-success-soft text-status-success border border-status-success-border',
  running: 'bg-status-running-soft text-status-running border border-status-running-border',
  warning: 'bg-status-warning-soft text-status-warning border border-status-warning-border',
  danger: 'bg-status-danger-soft text-status-danger border border-status-danger-border',
}

export function Badge({ children, tone = 'neutral', className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone] || TONES.neutral} ${className}`}
    >
      {children}
    </span>
  )
}

// Map each status to a tone + whether it should pulse (active work).
const STATUS_TONE = {
  Available: { tone: 'success', pulse: false },
  Idle: { tone: 'neutral', pulse: false },
  Busy: { tone: 'warning', pulse: true },
  Offline: { tone: 'danger', pulse: false },
  [JOB_STATUS.INITIALIZING]: { tone: 'running', pulse: true },
  [JOB_STATUS.PREPARING]: { tone: 'running', pulse: true },
  [JOB_STATUS.DOWNLOADING]: { tone: 'running', pulse: true },
  [JOB_STATUS.LOADING_DATASET]: { tone: 'running', pulse: true },
  [JOB_STATUS.STARTING]: { tone: 'running', pulse: true },
  [JOB_STATUS.RUNNING]: { tone: 'running', pulse: true },
  [JOB_STATUS.PAUSED]: { tone: 'warning', pulse: false },
  [JOB_STATUS.COMPLETED]: { tone: 'success', pulse: false },
  [JOB_STATUS.FAILED]: { tone: 'danger', pulse: false },
  [JOB_STATUS.CANCELED]: { tone: 'neutral', pulse: false },
}

export function StatusBadge({ status, className = '' }) {
  const config = STATUS_TONE[status] || { tone: 'neutral', pulse: false }
  return (
    <Badge tone={config.tone} className={className}>
      <span
        className={`h-1.5 w-1.5 rounded-full bg-current ${config.pulse ? 'animate-pulse-dot' : ''}`}
        aria-hidden="true"
      />
      {status}
    </Badge>
  )
}
