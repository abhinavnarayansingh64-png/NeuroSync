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
import { isActiveStatus, JOB_STATUS } from '../constants/jobStatus'
import { formatBytes, formatDateTime, formatDuration } from '../utils/format'
import { downloadTextFile } from '../utils/download'
import { formatInr } from '../services/pricing'
import { trpc } from '../lib/trpc'

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
  const { jobs, getJobState, pauseJob, resumeJob, cancelJob, deleteJob, startJob, models, gpuMode } = useData()
  const { toast } = useToast()
  const utils = trpc.useUtils()
  const baseModelCatalog = trpc.catalog.baseModels.useQuery(undefined, { staleTime: 30_000 })
  const jobDetailQuery = trpc.jobs.get.useQuery({ jobId: jobId || 'pending-job' }, { enabled: Boolean(jobId), retry: false, refetchInterval: 4_000 })

  const [confirm, setConfirm] = useState(null) // 'cancel' | 'delete' | null
  const [showFinalPayment, setShowFinalPayment] = useState(false)

  const job = jobs.find((item) => item.id === jobId)
  const settlementQuery = trpc.jobs.settlement.useQuery({ jobId: jobId || 'pending-job' }, { enabled: Boolean(jobId), retry: false })
  const settleFinal = trpc.jobs.settleFinal.useMutation()
  const state = useMemo(() => (job ? getJobState(job) : null), [job, getJobState])
  const history = state?.metricHistory || []
  const finalPaid = settlementQuery.data?.status === 'settled'

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

  const model = (baseModelCatalog.data || []).find((item) => item.id === job.config?.modelId)
  const relatedModel = models.find((m) => m.jobId === job.id)
  const active = isActiveStatus(job.status)
  const awaitingReceiver = job.backendStatus === 'awaiting_receiver'
  const deliveringDataset = job.backendStatus === 'loading_dataset'
  const executionStarted = ['queued', 'provisioning', 'running', 'paused', 'cancelling'].includes(job.backendStatus)
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

  const handleConfirmFinalPayment = async () => {
    try {
      await settleFinal.mutateAsync({ jobId: job.id })
      await utils.jobs.settlement.invalidate({ jobId: job.id })
      setShowFinalPayment(false)
      toast.success('Final payment received — download unlocked')
    } catch (error) {
      toast.error(error?.message || 'Unable to record final settlement')
    }
  }

  const pricing = job.config?.pricing
  const assignments = jobDetailQuery.data?.assignments || []
  const distributedTopology = job.config?.distributedTopology

  const actions = (
    <div className="flex flex-wrap gap-2">
      {executionStarted && !paused && (
        <Button variant="secondary" icon="pause" onClick={() => pauseJob(job.id)}>
          Pause
        </Button>
      )}
      {executionStarted && paused && (
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
        <div className={`rounded-full border px-2.5 py-1 text-xs font-medium ${gpuMode === 'simulation' ? 'border-accent-border bg-accent-soft/30 text-accent' : 'border-status-success/30 bg-status-success/10 text-status-success'}`}>
          {gpuMode === 'simulation' ? 'Server simulation' : 'External RunPod execution'}
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

      {assignments.length > 0 && (
        <section className="mb-6">
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">Receiver coordination</p>
            <h2 className="mt-1 text-lg font-semibold text-content-primary">Receiver assignment status</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {assignments.map((assignment) => <div key={assignment.id} className="rounded-xl border border-border bg-surface p-3"><div className="flex items-center justify-between gap-3"><span className="font-mono text-xs font-medium text-content-primary">{assignment.receiverId}</span><span className="rounded-full bg-surface-raised px-2 py-0.5 text-[11px] text-content-secondary">{assignment.status.replaceAll('_', ' ')}</span></div><p className="mt-2 text-xs text-content-secondary">{assignment.status === 'awaiting_acceptance' ? 'Offer delivered. Training cannot start until this receiver explicitly accepts.' : assignment.status === 'accepted' && !assignment.datasetDownloadStartedAt ? 'Receiver accepted. Protected dataset delivery has not started.' : assignment.status === 'accepted' && assignment.datasetDownloadStartedAt && !assignment.datasetDownloadCompletedAt ? 'Receiver is downloading the protected dataset; execution remains blocked.' : assignment.datasetDownloadCompletedAt && ['queued', 'provisioning'].includes(job.backendStatus) ? 'Dataset delivery completed. The coordinator has queued execution.' : assignment.status === 'running' ? 'Receiver is actively training this assignment.' : assignment.status === 'queued' ? 'Receiver execution is queued and will begin shortly.' : 'Assignment is synchronized by the shared coordinator.'}</p></div>)}
            </div>
          </Card>
        </section>
      )}

      {job.trainingMode === 'distributed' && (
        <section className="mb-6">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-accent">Distributed topology</p>
                <h2 className="mt-1 text-lg font-semibold text-content-primary">{assignments.length || distributedTopology?.partitionPlan?.shardCount || 0} receiver shards · {job.synchronizationStrategy === 'per_step' ? 'Per-step synchronization' : 'Adaptive synchronization'}</h2>
                <p className="mt-1 text-sm text-content-secondary">{distributedTopology?.partitionPlan?.description || 'The coordinator persists receiver assignments and synchronizes worker checkpoints.'}</p>
              </div>
              <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-xs font-medium text-amber-100">Premium distributed job</span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {assignments.map((assignment) => (
                <div key={assignment.id} className="rounded-xl border border-border bg-surface p-3">
                  <div className="flex items-center justify-between gap-3"><span className="font-mono text-xs font-medium text-content-primary">{assignment.receiverId}</span><span className="rounded-full bg-surface-raised px-2 py-0.5 text-[11px] text-content-secondary">Shard {assignment.shardIndex + 1}/{assignment.shardCount}</span></div>
                  <p className="mt-2 text-xs text-content-secondary">{assignment.checkpointKey ? 'Coordinator checkpoint slot prepared' : 'Checkpoint slot pending'} · {assignment.status}</p>
                  {assignment.failureReason && <p className="mt-1 text-xs text-status-warning">Recovery pending: {assignment.failureReason}</p>}
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-content-muted">Recovery policy: {distributedTopology?.recoveryPolicy?.onWorkerFailure?.replaceAll('_', ' ') || 'restore the latest coordinator checkpoint when a worker fails.'}</p>
          </Card>
        </section>
      )}

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
      {(executionStarted || paused) && (
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
