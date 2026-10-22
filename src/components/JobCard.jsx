/**
 * JobCard — a reusable summary card for a training job, used on the dashboard
 * and the active/completed/failed job lists. The `variant` tailors which
 * metadata and actions are shown without duplicating layout code.
 */

import { Link } from 'react-router-dom'
import { Card } from './ui/Card'
import { StatusBadge } from './ui/Badge'
import { ProgressBar } from './ui/ProgressBar'
import { Button } from './ui/Button'
import { Icon } from './ui/Icon'
import { getModelById } from '../data/models'
import { formatDateTime, formatDuration } from '../utils/format'
import { JOB_STATUS } from '../services/trainingSimulator'

function Meta({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-content-muted">{label}</dt>
      <dd className="truncate text-sm text-content-primary">{value}</dd>
    </div>
  )
}

export function JobCard({ job, state, variant = 'active', actions }) {
  const model = getModelById(job.config?.modelId)
  const isActive = variant === 'active'
  const isFailed = variant === 'failed'

  return (
    <Card className="transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:border-border-strong">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-content-primary">{job.name}</h3>
            <StatusBadge status={state.status} />
          </div>
          <p className="mt-0.5 font-mono text-xs text-content-muted">{job.id}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      </div>

      {isActive && (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs text-content-secondary">
            <span>
              {state.status === JOB_STATUS.RUNNING
                ? `Epoch ${state.currentEpoch}/${state.totalEpochs} · Step ${state.currentStep}/${state.totalSteps}`
                : state.status}
            </span>
            <span className="tabular-nums">{state.progress.toFixed(1)}%</span>
          </div>
          <ProgressBar value={state.progress} tone="blue" />
        </div>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <Meta label="Model" value={model?.name || '—'} />
        <Meta label="Receiver" value={job.config?.receiver?.id || '—'} />
        {isActive ? (
          <>
            <Meta label="Elapsed" value={formatDuration(state.elapsedSec)} />
            <Meta label="Remaining" value={formatDuration(state.remainingSec)} />
          </>
        ) : isFailed ? (
          <>
            <Meta label="Reason" value={job.failureReason || 'Unknown error'} />
            <Meta label="Ended" value={formatDateTime(job.completedAt)} />
          </>
        ) : (
          <>
            <Meta label="Duration" value={formatDuration(state.elapsedSec)} />
            <Meta label="Completed" value={formatDateTime(job.completedAt)} />
          </>
        )}
      </dl>

      <div className="mt-4 flex justify-end">
        <Link to={`/jobs/${job.id}`}>
          <Button variant="ghost" size="sm" iconRight="chevronRight">
            View details
          </Button>
        </Link>
      </div>
    </Card>
  )
}
