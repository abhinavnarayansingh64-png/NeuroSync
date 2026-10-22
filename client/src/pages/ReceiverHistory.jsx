import { Link } from 'react-router-dom'
import { trpc } from '../lib/trpc'
import { useReceiverIdentity } from '../hooks/useReceiverIdentity'
import { PageContainer, PageHeader } from '../components/ui/PageContainer'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'

const toneFor = (status) => status === 'completed' ? 'success' : status === 'failed' ? 'danger' : 'warning'
const label = (status) => String(status || 'unavailable').replaceAll('_', ' ')
const money = (value) => `₹${Number(value || 0).toFixed(2)}`
const date = (value) => value ? new Date(value).toLocaleString() : 'Unavailable'
function duration(job) {
  const seconds = Number(job.metrics?.elapsedSec || 0)
  if (!seconds) return 'Unavailable'
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

export default function ReceiverHistory() {
  const { receiverId } = useReceiverIdentity()
  const history = trpc.receivers.history.useQuery(
    { receiverId: receiverId || 'unregistered' },
    { enabled: Boolean(receiverId), retry: 4, retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 12_000), refetchInterval: 6_000, placeholderData: (previous) => previous },
  )
  if (!receiverId) return <PageContainer><PageHeader title="Job History" description="Terminal assignments are preserved by the receiver coordinator." /><Card><p className="text-sm text-content-secondary">Register this browser as a receiver from the Overview page before viewing its persisted assignment history.</p><Link className="mt-4 inline-block" to="/receiver"><Button>Open Overview</Button></Link></Card></PageContainer>
  return <PageContainer>
    <PageHeader title="Job History" description="Completed, failed, and cancelled assignments only. Live offers and active work stay on Overview." />
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-accent">Terminal assignments</p><p className="mt-1 text-sm text-content-secondary">Payout values are derived by the server from the persisted job pricing and progress records.</p></div><Badge tone="neutral">{history.data?.length || 0} historical</Badge></div>
      {history.isLoading ? <p className="mt-6 text-sm text-content-muted">Loading persisted history…</p> : history.data?.length ? <div className="mt-5 grid gap-3">{history.data.map((item) => <div key={item.assignment.id} className="grid gap-4 rounded-xl border border-border bg-surface p-4 lg:grid-cols-[1.3fr_0.8fr_0.8fr_auto]"><div><p className="font-medium text-content-primary">{item.job.displayId || item.job.id}</p><p className="mt-1 text-sm text-content-secondary">{item.job.datasetName || 'Dataset unavailable'}</p><p className="mt-1 text-xs text-content-muted">Submitted {date(item.job.createdAt)} · completed {date(item.job.completedAt)}</p>{item.assignment.failureReason && <p className="mt-2 text-xs text-status-warning">Failure reason: {item.assignment.failureReason}</p>}</div><div><p className="text-[11px] uppercase tracking-wide text-content-muted">Duration</p><p className="mt-1 text-sm text-content-primary">{duration(item.job)}</p><p className="mt-1 text-xs text-content-secondary">{Number(item.job.metrics?.progress || 0).toFixed(1)}% final progress</p></div><div><p className="text-[11px] uppercase tracking-wide text-content-muted">Server payout</p><p className="mt-1 text-sm font-medium text-content-primary">{money(item.payout?.projected)}</p><p className="mt-1 text-xs text-content-secondary">Accrued {money(item.payout?.accrued)}</p></div><div className="lg:text-right"><Badge tone={toneFor(item.job.status)}>{label(item.job.status)}</Badge></div></div>)}</div> : <div className="mt-6 rounded-xl border border-dashed border-border p-5 text-sm text-content-secondary">No completed, failed, or cancelled assignments have been recorded for this receiver.</div>}
    </Card>
  </PageContainer>
}
