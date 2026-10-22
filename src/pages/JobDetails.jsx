/**
 * JobDetails — the live monitoring + management view for a single job
 * (PRD Sections 3 & 5). It adapts to the job's status:
 *  • Active  → live metrics, progress, charts, streaming logs, pause/resume/cancel
 *  • Completed → summary, final metrics, model download, logs
 *  • Failed/Canceled → failure reason, retry, logs
 *
 * All live values update automatically via the DataContext ticker.
 */

import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useData } from '../contexts/DataContext'
import { useToast } from '../contexts/ToastContext'
import { PageContainer, PageHeader } from '../components/ui/PageContainer'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { StatusBadge } from '../components/ui/Badge'
import { StatTile } from '../components/ui/StatTile'
import { ProgressBar } from '../components/ui/ProgressBar'
import { EmptyState } from '../components/ui/EmptyState'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { LogConsole } from '../components/LogConsole'
import { LineChart } from '../components/charts/LineChart'
import { PaymentModal } from '../components/PaymentModal'
import { ValueTransition } from '../components/motion/ValueTransition'
import { StatusTransition } from '../components/motion/StatusTransition'
import { getModelById } from '../data/models'
import { buildMetricHistory, isActiveStatus, JOB_STATUS } from '../services/trainingSimulator'
import { formatBytes, formatDateTime, formatDuration } from '../utils/format'
import { downloadTextFile } from '../utils/download'
import { formatInr } from '../services/pricing'
import { isFinalPaid, markFinalPaid } from '../services/payments'

function MetricChartCard({ title, data, dataKey, tone, formatValue, yMin, yMax }) {
  const series = data.map((point) => point[dataKey])
  const latest = series.length ? series[series.length - 1] : null
  return (
    <Card padded={false} className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-medium text-content-secondary">{title}</h4>
        <span className="text-sm font-semibold tabular-nums text-content-primary">
          {latest === null ? '—' : formatValue(latest)}
        </span>
      </div>
      <LineChart data={series} tone={tone} formatValue={formatValue} label={title} yMin={yMin} yMax={yMax} />
    </Card>
  )
}

export default function JobDetails() {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const { jobs, getJobState, pauseJob, resumeJob, cancelJob, deleteJob, startJob, models } = useData()
  const { toast } = useToast()

  const [confirm, setConfirm] = useState(null) // 'cancel' | 'delete' | null
  const [showFinalPayment, setShowFinalPayment] = useState(false)
  const [paidVersion, setPaidVersion] = useState(0)

  const job = jobs.find((item) => item.id === jobId)
  const state = useMemo(() => (job ? getJobState(job) : null), [job, getJobState])
  const history = useMemo(() => (job ? buildMetricHistory(job) : []), [job])
  const finalPaid = useMemo(() => !!job && isFinalPaid(job.id), [job, paidVersion])

  if (!job) {
    return (
      <PageContainer>
        <EmptyState
          icon="alert"
          title="Job not found"
          description="This training job no longer exists or was deleted."
          action={
            <Link to="/jobs/active">
              <Button variant="secondary">Back to jobs</Button>
            </Link>
          }
        />
      </PageContainer>
    )
  }

  const model = getModelById(job.config?.modelId)
  const relatedModel = models.find((m) => m.jobId === job.id)
  const active = isActiveStatus(job.status)
  const completed = job.status === JOB_STATUS.COMPLETED
  const failed = job.status === JOB_STATUS.FAILED || job.status === JOB_STATUS.CANCELED
  const paused = job.status === JOB_STATUS.PAUSED
  const metrics = state.metrics

  const handleRetry = () => {
    const newJob = startJob(job.config)
    toast.success(`Retrying · new job ${newJob.id}`)
    navigate(`/jobs/${newJob.id}`)
  }

  const handleDownloadModel = () => {
    const manifest = {
      model: relatedModel?.name || `${job.name}-ft`,
      baseModel: model?.name,
      method: job.config?.advanced?.method?.toUpperCase(),
      job: job.id,
      createdAt: relatedModel ? new Date(relatedModel.createdAt).toISOString() : null,
      trainingParameters: job.config?.params,
      advanced: job.config?.advanced,
      note: 'This manifest represents the fine-tuned adapter produced by NeuroSync.',
    }
    downloadTextFile(`${job.name}-model.json`, JSON.stringify(manifest, null, 2))
    toast.success('Model manifest downloaded')
  }

  const handleConfirmFinalPayment = () => {
    markFinalPaid(job.id)
    setPaidVersion((v) => v + 1)
    setShowFinalPayment(false)
    toast.success('Final payment received — download unlocked')
  }

  const pricing = job.config?.pricing

  const actions = (
    <div className="flex flex-wrap gap-2">
      {active && !paused && (
        <Button variant="secondary" icon="pause" onClick={() => pauseJob(job.id)}>
          Pause
        </Button>
      )}
      {paused && (
        <Button variant="secondary" icon="play" onClick={() => resumeJob(job.id)}>
          Resume
        </Button>
      )}
      {active && (
        <Button variant="danger" icon="stop" onClick={() => setConfirm('cancel')}>
          Cancel
        </Button>
      )}
      {completed && pricing && !finalPaid && (
        <Button icon="lock" onClick={() => setShowFinalPayment(true)}>
          Pay {formatInr(pricing.finalPaymentInr)} & Unlock
        </Button>
      )}
      {completed && (!pricing || finalPaid) && (
        <Button icon="download" onClick={handleDownloadModel}>
          Download Model
        </Button>
      )}
      {failed && (
        <Button icon="refresh" onClick={handleRetry}>
          Retry
        </Button>
      )}
      {!active && (
        <Button variant="danger" icon="trash" onClick={() => setConfirm('delete')}>
          Delete
        </Button>
      )}
    </div>
  )

  return (
    <PageContainer>
      <PageHeader
        title={job.name}
        description={job.config?.description || 'Training job details and live monitoring.'}
        actions={actions}
        back={
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-2 inline-flex items-center gap-1 text-sm text-content-secondary hover:text-content-primary"
          >
            <Icon name="arrowLeft" size={16} /> Back
          </button>
        }
      />

      {/* Identity + status bar */}
      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-border bg-card px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-content-muted">{job.id}</span>
          <StatusTransition key={state.status}>
            <StatusBadge status={state.status} />
          </StatusTransition>
        </div>
        <div className="text-sm text-content-secondary">
          Model <span className="text-content-primary">{model?.name || '—'}</span>
        </div>
        <div className="text-sm text-content-secondary">
          Receiver <span className="text-content-primary">{job.config?.receiver?.id || '—'}</span>
        </div>
        <div className="text-sm text-content-secondary">
          Method <span className="text-content-primary">{job.config?.advanced?.method?.toUpperCase() || 'LoRA'}</span>
        </div>
        {pricing && (
          <div className="text-sm text-content-secondary">
            Base paid <span className="text-content-primary">{formatInr(pricing.basePriceInr)}</span>
            {completed && (
              <>
                {' '}
                · Final{' '}
                <span className={finalPaid ? 'text-status-success' : 'text-status-warning'}>
                  {finalPaid ? 'paid' : `${formatInr(pricing.finalPaymentInr)} due`}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Failure banner */}
      {failed && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-status-danger/30 bg-status-danger/10 p-4">
          <Icon name="alert" size={20} className="mt-0.5 shrink-0 text-status-danger" />
          <div>
            <p className="text-sm font-semibold text-content-primary">
              {job.status === JOB_STATUS.CANCELED ? 'Training cancelled' : 'Training failed'}
            </p>
            <p className="mt-0.5 text-sm text-content-secondary">
              {job.failureReason || 'The job stopped before completion.'} Last completed step: {state.currentStep}/
              {state.totalSteps}.
            </p>
          </div>
        </div>
      )}

      {/* Progress + live stats (active) */}
      {(active || paused) && (
        <section className="mb-6">
          <Card>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-medium text-content-primary">
                {state.status === JOB_STATUS.RUNNING || paused
                  ? `Epoch ${state.currentEpoch}/${state.totalEpochs} · Step ${state.currentStep}/${state.totalSteps}`
                  : state.status}
              </span>
              <span className="tabular-nums text-content-secondary">
                <ValueTransition value={state.progress.toFixed(1) + '%'} />
              </span>
            </div>
            <ProgressBar value={state.progress} tone={paused ? 'amber' : 'blue'} height="h-2.5" />

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <StatTile label="Elapsed" value={<ValueTransition value={formatDuration(state.elapsedSec)} />} icon="clock" />
              <StatTile label="Remaining" value={<ValueTransition value={formatDuration(state.remainingSec)} />} icon="clock" />
              <StatTile label="GPU Util" value={<ValueTransition value={`${metrics.gpuUtil}%`} />} icon="chip" tone="blue" />
              <StatTile
                label="VRAM"
                value={<ValueTransition value={`${metrics.vramUsedGb} / ${metrics.vramTotalGb} GB`} />}
                icon="chip"
              />
              <StatTile label="Loss" value={<ValueTransition value={metrics.loss.toFixed(4)} />} tone="accent" />
              <StatTile label="Learning Rate" value={metrics.learningRate} />
              <StatTile label="Speed" value={<ValueTransition value={`${metrics.speed} it/s`} />} />
              <StatTile label="Progress" value={<ValueTransition value={`${state.progress.toFixed(0)}%`} />} tone="blue" />
            </div>
          </Card>
        </section>
      )}

      {/* Completed summary */}
      {completed && (
        <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Status" value="Completed" tone="accent" icon="checkCircle" />
          <StatTile label="Duration" value={formatDuration(state.elapsedSec)} icon="clock" />
          <StatTile label="Final Loss" value={metrics.loss.toFixed(4)} tone="accent" />
          <StatTile label="Completed" value={formatDateTime(job.completedAt)} icon="clock" />
        </section>
      )}

      {/* Metrics charts */}
      {(active || paused || completed || failed) && history.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-lg font-semibold text-content-primary">Training Metrics</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <MetricChartCard
              title="Training Loss"
              data={history}
              dataKey="loss"
              tone="accent"
              formatValue={(v) => v.toFixed(4)}
            />
            <MetricChartCard
              title="Learning Rate"
              data={history}
              dataKey="learningRate"
              tone="purple"
              formatValue={(v) => Number(v).toExponential(2)}
            />
            <MetricChartCard
              title="GPU Utilisation"
              data={history}
              dataKey="gpuUtil"
              tone="blue"
              formatValue={(v) => `${Math.round(v)}%`}
              yMin={0}
              yMax={100}
            />
            <MetricChartCard
              title="VRAM Usage"
              data={history}
              dataKey="vramPercent"
              tone="amber"
              formatValue={(v) => `${Math.round(v)}%`}
              yMin={0}
              yMax={100}
            />
          </div>
        </section>
      )}

      {/* Logs */}
      <section className="mb-6">
        <LogConsole logs={job.logs || []} jobId={job.id} />
      </section>

      {/* Pricing */}
      {pricing && (
        <section className="mb-6">
          <Card title="Pricing">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-content-muted">Base fee (paid)</p>
                <p className="mt-0.5 text-sm font-medium text-content-primary">{formatInr(pricing.basePriceInr)}</p>
              </div>
              <div>
                <p className="text-xs text-content-muted">Final payment</p>
                <p className={`mt-0.5 text-sm font-medium ${finalPaid ? 'text-status-success' : 'text-content-primary'}`}>
                  {finalPaid ? `${formatInr(pricing.finalPaymentInr)} paid` : `${formatInr(pricing.finalPaymentInr)} due on completion`}
                </p>
              </div>
              <div>
                <p className="text-xs text-content-muted">Projected total</p>
                <p className="mt-0.5 text-sm font-medium text-content-primary">{formatInr(pricing.estimatedTotalInr)}</p>
              </div>
            </div>
          </Card>
        </section>
      )}

      {/* Configuration recap */}
      <section>
        <Card title="Job Configuration">
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Dataset', job.config?.dataset ? `${job.config.dataset.name} (${formatBytes(job.config.dataset.sizeBytes)})` : '—'],
              ['Records', job.config?.dataset?.records?.toLocaleString() || '—'],
              ['Epochs', job.config?.params?.epochs],
              ['Learning Rate', job.config?.params?.learningRate],
              ['Batch Size', job.config?.params?.batchSize],
              ['Grad Accumulation', job.config?.params?.gradientAccumulation],
              ['Max Seq Length', job.config?.params?.maxSeqLength],
              ['Mixed Precision', job.config?.advanced?.mixedPrecision],
              ['Weight Decay', job.config?.advanced?.weightDecay],
              ['Warmup Ratio', job.config?.advanced?.warmupRatio],
              ['Random Seed', job.config?.advanced?.randomSeed],
              ['Gradient Checkpointing', job.config?.advanced?.gradientCheckpointing ? 'Enabled' : 'Disabled'],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-content-muted">{label}</dt>
                <dd className="mt-0.5 text-sm text-content-primary">{value ?? '—'}</dd>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* Confirm dialogs */}
      <ConfirmDialog
        open={confirm === 'cancel'}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          cancelJob(job.id)
          setConfirm(null)
          toast.warning('Training cancelled')
        }}
        title="Cancel this training job?"
        description="The job will stop and be moved to Failed. This cannot be undone."
        confirmLabel="Cancel training"
        cancelLabel="Keep training"
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          deleteJob(job.id)
          setConfirm(null)
          toast.success('Job deleted')
          navigate('/jobs/active')
        }}
        title="Delete this job?"
        description="This permanently removes the job and its logs from your workspace."
        confirmLabel="Delete job"
      />

      {pricing && (
        <PaymentModal
          open={showFinalPayment}
          onClose={() => setShowFinalPayment(false)}
          title="Final payment — unlocks your download"
          description={`Training completed. This covers the usage-based remainder for ${job.name}.`}
          amountInr={pricing.finalPaymentInr}
          onConfirm={handleConfirmFinalPayment}
        />
      )}
    </PageContainer>
  )
}
