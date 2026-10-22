/**
 * ReceiverDashboard — the view for the person on the *receiving* end of a job:
 * whoever owns/operates a GPU machine that accepts NeuroSync training jobs.
 *
 * A receiver has no separate login (per product decision) — any authenticated
 * user can identify which machine they operate via Settings > Receiver
 * Machine (`settings.myReceiverId`), then switch to this view from the
 * sidebar toggle. It reuses the same `jobs` array as the sender-side pages;
 * it simply filters to jobs whose `config.receiver.id` matches this machine
 * and groups them into Queued / Running / History so an operator can see
 * everything that has ever been sent to their hardware.
 */

import { Link } from 'react-router-dom'
import { useSettings } from '../contexts/SettingsContext'
import { useData } from '../contexts/DataContext'
import { useReceivers } from '../contexts/ReceiversContext'
import { useToast } from '../contexts/ToastContext'
import { PageContainer, PageHeader } from '../components/ui/PageContainer'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { EmptyState } from '../components/ui/EmptyState'
import { StatTile } from '../components/ui/StatTile'
import { StatusBadge } from '../components/ui/Badge'
import { JobCard } from '../components/JobCard'
import { EarningsPanel } from '../components/EarningsPanel'
import { downloadTextFile } from '../utils/download'
import { JOB_STATUS } from '../services/trainingSimulator'

const QUEUED_STATUSES = [
  JOB_STATUS.INITIALIZING,
  JOB_STATUS.PREPARING,
  JOB_STATUS.DOWNLOADING,
  JOB_STATUS.LOADING_DATASET,
  JOB_STATUS.STARTING,
]
const RUNNING_STATUSES = [JOB_STATUS.RUNNING, JOB_STATUS.PAUSED]

function historyVariant(status) {
  return status === JOB_STATUS.COMPLETED ? 'completed' : 'failed'
}

export default function ReceiverDashboard() {
  const { settings } = useSettings()
  const { jobs, getJobState } = useData()
  const { getReceiverById, isLive } = useReceivers()
  const { toast } = useToast()

  const receiverId = settings.myReceiverId
  const receiver = receiverId ? getReceiverById(receiverId) : null

  // No receiver machine selected yet — point the user at Settings.
  if (!receiver) {
    return (
      <PageContainer>
        <PageHeader
          title="Receiver Dashboard"
          description="See training jobs sent to the GPU machine you operate."
        />
        <EmptyState
          icon="chip"
          title="No receiver machine selected"
          description="Identify which GPU machine you operate in Settings to start monitoring the jobs it receives."
          action={
            <Link to="/settings">
              <Button icon="settings">Choose my receiver</Button>
            </Link>
          }
        />
      </PageContainer>
    )
  }

  const myJobs = jobs.filter((job) => job.config?.receiver?.id === receiverId)
  const queued = myJobs.filter((job) => QUEUED_STATUSES.includes(job.status))
  const running = myJobs.filter((job) => RUNNING_STATUSES.includes(job.status))
  const history = myJobs
    .filter((job) => !QUEUED_STATUSES.includes(job.status) && !RUNNING_STATUSES.includes(job.status))
    .sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt))

  const downloadLogs = (job) => {
    const text = (job.logs || [])
      .map((log) => `${(log.level || 'info').toUpperCase()}  ${log.message}`)
      .join('\n')
    downloadTextFile(`${job.id}-logs.txt`, text || 'No logs available.')
    toast.success('Logs downloaded')
  }

  return (
    <PageContainer>
      <PageHeader
        title="Receiver Dashboard"
        description="Jobs sent to the GPU machine you operate, from request through completion."
        actions={
          <Link to="/settings">
            <Button variant="secondary" size="sm" icon="settings">
              Switch machine
            </Button>
          </Link>
        }
      />

      {/* This machine */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Icon name="chip" size={22} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-content-primary">{receiver.id}</h3>
                <StatusBadge status={receiver.status} />
                <span className="flex items-center gap-1.5 text-xs text-content-muted">
                  <span className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-status-success' : 'bg-content-muted'}`} />
                  {isLive ? 'Live' : 'Demo data'}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-content-secondary">
                {receiver.gpu} · {receiver.vram} VRAM · {receiver.cpu} · {receiver.ram} RAM
              </p>
              {isLive && receiver.gpuUtilPct != null && (
                <p className="mt-1 text-xs text-content-muted">
                  GPU {receiver.gpuUtilPct.toFixed(0)}% · VRAM {receiver.vramUsedGb?.toFixed(1)} /{' '}
                  {receiver.vramGb?.toFixed(0)} GB · CPU {receiver.cpuUtilPct?.toFixed(0)}% · RAM{' '}
                  {receiver.ramUsedGb?.toFixed(1)} GB used
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Earnings */}
      <section className="mb-8">
        <EarningsPanel jobs={myJobs} />
      </section>

      {/* Stats */}
      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Queued" value={queued.length} icon="clock" tone="amber" />
        <StatTile label="Running" value={running.length} icon="activity" tone="blue" />
        <StatTile
          label="Completed"
          value={history.filter((job) => job.status === JOB_STATUS.COMPLETED).length}
          icon="checkCircle"
          tone="accent"
        />
        <StatTile label="Total received" value={myJobs.length} icon="layers" />
      </section>

      {/* Queued */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-content-primary">Queued</h2>
        {queued.length === 0 ? (
          <EmptyState
            icon="clock"
            title="Nothing waiting"
            description="Jobs sent to this machine that haven't reached the running phase yet will appear here."
          />
        ) : (
          <RevealGroup as="div" className="grid gap-4" stagger={56}>
            {queued.map((job) => (
              <JobCard key={job.id} job={job} state={getJobState(job)} variant="active" />
            ))}
          </RevealGroup>
        )}
      </section>

      {/* Running */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-content-primary">Running</h2>
        {running.length === 0 ? (
          <EmptyState
            icon="activity"
            title="No job running right now"
            description="Once a queued job reaches the training phase, it will move here with live progress."
          />
        ) : (
          <RevealGroup as="div" className="grid gap-4" stagger={56}>
            {running.map((job) => (
              <JobCard key={job.id} job={job} state={getJobState(job)} variant="active" />
            ))}
          </RevealGroup>
        )}
      </section>

      {/* History */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-content-primary">History</h2>
        {history.length === 0 ? (
          <EmptyState
            icon="layers"
            title="No finished jobs yet"
            description="Completed, failed and canceled jobs handled by this machine will appear here."
          />
        ) : (
          <RevealGroup as="div" className="grid gap-4" stagger={56}>
            {history.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                state={getJobState(job)}
                variant={historyVariant(job.status)}
                actions={
                  <Button variant="ghost" size="sm" icon="download" onClick={() => downloadLogs(job)}>
                    Logs
                  </Button>
                }
              />
            ))}
          </RevealGroup>
        )}
      </section>
    </PageContainer>
  )
}
