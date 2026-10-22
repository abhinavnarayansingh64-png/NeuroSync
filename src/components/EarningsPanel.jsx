/**
 * EarningsPanel — shown on ReceiverDashboard. Summarizes what this receiver
 * machine has earned (60% of each completed job's total, after NeuroSync's
 * 40% platform cut) and what's expected from the job currently in flight.
 * Pulled entirely from `job.config.pricing`, the snapshot captured when the
 * job was created in NewJob.jsx.
 */

import { Card } from './ui/Card'
import { EmptyState } from './ui/EmptyState'
import { formatInr } from '../services/pricing'
import { formatDateTime } from '../utils/format'
import { JOB_STATUS } from '../services/trainingSimulator'

export function EarningsPanel({ jobs }) {
  const priced = jobs.filter((job) => job.config?.pricing)
  const completed = priced.filter((job) => job.status === JOB_STATUS.COMPLETED)
  const inFlight = priced.filter(
    (job) => job.status !== JOB_STATUS.COMPLETED && job.status !== JOB_STATUS.FAILED && job.status !== JOB_STATUS.CANCELED,
  )

  const totalEarned = completed.reduce((sum, job) => sum + (job.config.pricing.providerPayoutInr || 0), 0)
  const expected = inFlight.reduce((sum, job) => sum + (job.config.pricing.providerPayoutInr || 0), 0)

  return (
    <Card title="Earnings" description="You keep 60% of each job's total; NeuroSync keeps 40%.">
      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-accent-border bg-accent-soft/30 p-4">
          <p className="text-xs text-content-muted">Total earned</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-accent">{formatInr(totalEarned)}</p>
          <p className="mt-1 text-[11px] text-content-muted">
            across {completed.length} completed job{completed.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="rounded-xl border border-status-warning-border bg-status-warning-soft p-4">
          <p className="text-xs text-content-muted">Expected (in progress)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-status-warning">{formatInr(expected)}</p>
          <p className="mt-1 text-[11px] text-content-muted">paid out once training completes</p>
        </div>
      </div>

      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-content-muted">Payout records</p>
      {completed.length === 0 ? (
        <EmptyState
          icon="layers"
          title="No payouts yet"
          description="Completed jobs handled by this machine will show their payout here."
        />
      ) : (
        <div className="space-y-2">
          {completed.map((job) => (
            <div
              key={job.id}
              className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2.5"
            >
              <div>
                <p className="text-sm font-medium text-content-primary">{job.name}</p>
                <p className="font-mono text-[11px] text-content-muted">
                  {job.id} · {formatDateTime(job.completedAt || job.createdAt)}
                </p>
              </div>
              <p className="font-mono text-sm font-semibold text-accent">
                {formatInr(job.config.pricing.providerPayoutInr)}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
