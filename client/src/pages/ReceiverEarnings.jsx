import { useState } from 'react'
import { Link } from 'react-router-dom'
import { trpc } from '../lib/trpc'
import { useReceiverIdentity } from '../hooks/useReceiverIdentity'
import { PageContainer, PageHeader } from '../components/ui/PageContainer'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { LineChart } from '../components/charts/LineChart'

const money = (value) => `₹${Number(value || 0).toFixed(2)}`
const duration = (seconds) => {
  const total = Number(seconds || 0)
  if (!total) return '0m'
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`
}

export default function ReceiverEarnings() {
  const { receiverId } = useReceiverIdentity()
  const [range, setRange] = useState('7d')
  const analytics = trpc.receivers.analytics.useQuery(
    { receiverId: receiverId || 'unregistered', range },
    { enabled: Boolean(receiverId), retry: 4, retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 12_000), refetchInterval: 8_000, placeholderData: (previous) => previous },
  )
  if (!receiverId) return <PageContainer><PageHeader title="Earnings & Analytics" description="Server-derived completed-assignment payouts and performance statistics." /><Card><p className="text-sm text-content-secondary">Register this browser as a receiver from Overview before analytics are available.</p><Link className="mt-4 inline-block" to="/receiver"><Button>Open Overview</Button></Link></Card></PageContainer>
  const summary = analytics.data?.summary || {}
  const stats = analytics.data?.stats || {}
  const series = (analytics.data?.timeline || []).map((point) => ({ value: point.earnings }))
  return <PageContainer>
    <PageHeader title="Earnings & Analytics" description="Actual completed-assignment payout records aggregated by the server. Times are grouped in UTC." />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['Today', summary.today], ['This Week', summary.week], ['This Month', summary.month], ['Lifetime', summary.lifetime]].map(([title, value]) => <Card key={title}><p className="text-xs font-semibold uppercase tracking-wide text-accent">{title}</p><p className="mt-2 text-2xl font-semibold text-content-primary">{money(value)}</p><p className="mt-1 text-xs text-content-secondary">Completed assignment payouts</p></Card>)}</div>
    <Card className="mt-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-accent">Earnings timeline</p><h2 className="mt-1 font-semibold text-content-primary">Completed payout by day</h2><p className="mt-1 text-sm text-content-secondary">No client-side earnings are invented; zero values mean no completed payout in that bucket.</p></div><div className="flex gap-2">{[['7d', '7 Days'], ['30d', '30 Days'], ['all', 'All Time']].map(([value, text]) => <Button key={value} size="sm" variant={range === value ? 'primary' : 'secondary'} onClick={() => setRange(value)}>{text}</Button>)}</div></div><div className="mt-5"><LineChart data={series} label="Completed receiver earnings" formatValue={money} height={180} /></div><div className="mt-3 flex justify-between text-xs text-content-muted"><span>{analytics.data?.timeline?.[0]?.date || 'No recorded payout'}</span><span>{analytics.data?.timeline?.at(-1)?.date || ''}</span></div></Card>
    <Card className="mt-6"><p className="text-xs font-semibold uppercase tracking-wide text-accent">Job analytics</p><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['Total jobs', stats.totalJobs || 0], ['Completed jobs', stats.completedJobs || 0], ['Failed jobs', stats.failedJobs || 0], ['Success rate', `${Number(stats.successRate || 0).toFixed(1)}%`], ['Average duration', duration(stats.averageJobDurationSec)], ['Total compute time', duration(stats.totalComputeTimeSec)], ['Average earnings / job', money(stats.averageEarningsPerJob)], ['Timezone', analytics.data?.timezone || 'UTC']].map(([title, value]) => <div key={title} className="rounded-xl border border-border bg-surface p-4"><p className="text-[11px] uppercase tracking-wide text-content-muted">{title}</p><p className="mt-2 text-lg font-semibold text-content-primary">{value}</p></div>)}</div></Card>
  </PageContainer>
}
