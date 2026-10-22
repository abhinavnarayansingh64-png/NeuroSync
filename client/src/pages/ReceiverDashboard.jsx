import { useEffect, useMemo, useState } from 'react'
import { useData } from '../contexts/DataContext'
import { useToast } from '../contexts/ToastContext'
import { trpc } from '../lib/trpc'
import { downloadReceiverDataset } from '../services/datasetTransfer'
import { desktopRuntime, readDesktopHardwareProfile } from '../services/desktopRuntime'
import { DESKTOP_PORTABLE_DOWNLOAD_LABEL, DESKTOP_PORTABLE_DOWNLOAD_URL } from '../services/desktopDownload'
import { PageContainer, PageHeader } from '../components/ui/PageContainer'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { Badge } from '../components/ui/Badge'

const STATUS_META = {
  available: { label: 'Available', dot: 'bg-emerald-400', copy: 'Visible to senders and ready to receive an offer.' },
  busy: { label: 'Busy', dot: 'bg-amber-300', copy: 'The coordinator has an active reservation or assignment on this receiver.' },
  offline: { label: 'Offline', dot: 'bg-red-400', copy: 'This browser heartbeat has expired. Keep this console open to reconnect.' },
  maintenance: { label: 'Offline', dot: 'bg-red-400', copy: 'Hidden from new reservations until the coordinator marks it available.' },
}

const ACTIVE_STATUSES = new Set(['awaiting_receiver', 'loading_dataset', 'queued', 'provisioning', 'running', 'paused', 'cancelling'])
const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled'])

function getFingerprint() {
  const key = 'neurosync.receiver.fingerprint'
  const existing = window.localStorage.getItem(key)
  if (existing) return existing
  const next = `${desktopRuntime() ? 'desktop' : 'browser'}-${crypto.randomUUID()}`
  window.localStorage.setItem(key, next)
  return next
}

function formatStatus(value) {
  return String(value || 'unavailable').replaceAll('_', ' ')
}

function formatDate(value) {
  if (!value) return 'Unavailable'
  return new Date(value).toLocaleString()
}

function duration(job) {
  const elapsed = Number(job.metrics?.elapsedSec || 0)
  if (!elapsed) return 'Unavailable until execution starts'
  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60
  return `${minutes}m ${seconds}s`
}

function jobProgressText(job, assignment, transfer) {
  if (job.status === 'awaiting_receiver') return 'Offer pending your explicit acceptance.'
  if (job.status === 'loading_dataset') {
    if (transfer?.jobId === job.id) return `Receiving authenticated dataset bytes · ${transfer.progress}%`
    if (assignment.datasetDownloadCompletedAt) return 'Dataset delivery is complete; waiting for the shared dispatch queue.'
    if (assignment.datasetDownloadStartedAt) return 'Dataset delivery began but has not completed. Resume delivery to retry.'
    return 'Offer accepted. Dataset delivery has not started.'
  }
  const progress = Number(job.metrics?.progress || 0)
  if (job.status === 'queued') return 'Dataset delivery complete. Waiting for execution queue.'
  if (job.status === 'provisioning') return 'Execution provider is reserving capacity.'
  if (job.status === 'running' || job.status === 'paused') return `${progress.toFixed(1)}% complete · ${duration(job)}`
  if (job.status === 'cancelling') return 'Cancellation is awaiting provider confirmation.'
  return 'Coordinator state unavailable.'
}

function transferActionLabel(job, assignment, transfer) {
  if (transfer?.jobId === job.id) return `Delivering ${transfer.progress}%`
  if (job.status === 'awaiting_receiver') return 'Accept job & start delivery'
  if (job.status === 'loading_dataset' && assignment.datasetDownloadCompletedAt) return null
  if (job.status === 'loading_dataset' && assignment.datasetDownloadStartedAt) return 'Resume dataset delivery'
  if (job.status === 'loading_dataset') return 'Start dataset delivery'
  return null
}

function truthfullyReportedGpu(_browserGpu, agentTelemetry) {
  const agentIsVerified = agentTelemetry?.verified && agentTelemetry?.model && Number.isFinite(Number(agentTelemetry.vramGb))
  const desktopNative = agentTelemetry?.source === 'desktop_native_nvidia_smi'
  const runtime = agentIsVerified
    ? `${Number(agentTelemetry.vramUsedGb || 0).toFixed(2)} / ${Number(agentTelemetry.vramGb).toFixed(2)} GB VRAM · ${Number.isFinite(Number(agentTelemetry.utilizationPct)) ? `${Number(agentTelemetry.utilizationPct).toFixed(0)}% GPU utilization` : 'GPU utilization unavailable'}`
    : 'Unavailable in browser'
  return {
    text: agentIsVerified ? agentTelemetry.model : 'Native NVIDIA telemetry unavailable',
    sourceLabel: agentIsVerified ? desktopNative ? 'Desktop native verified · nvidia-smi' : 'Locally verified · nvidia-smi' : 'Electron native collector unavailable',
    verification: agentIsVerified ? `${desktopNative ? 'Desktop native' : 'Locally'} verified · nvidia-smi · ${formatDate(agentTelemetry.observedAt)}` : 'Not verified',
    runtime,
    agentIsVerified,
    agentConnected: Boolean(agentTelemetry?.connected),
    agentDiagnostic: agentTelemetry?.diagnostic || (agentIsVerified ? desktopNative ? 'Electron native runtime is supplying verified NVIDIA telemetry.' : 'Local NVIDIA telemetry is available.' : 'Electron could not collect NVIDIA telemetry.'),
  }
}

function RuntimeTelemetry({ profile, telemetry }) {
  const totalRam = Number(profile?.memory?.totalBytes)
  const freeRam = Number(profile?.memory?.freeBytes)
  const ramAvailable = Number.isFinite(totalRam) && Number.isFinite(freeRam)
  const rows = [
    ['VRAM', telemetry?.verified && Number.isFinite(Number(telemetry.vramGb)) ? `${Number(telemetry.vramUsedGb || 0).toFixed(2)} / ${Number(telemetry.vramGb).toFixed(2)} GB` : 'Unavailable'],
    ['GPU utilization', telemetry?.verified && Number.isFinite(Number(telemetry.utilizationPct)) ? `${Number(telemetry.utilizationPct).toFixed(0)}%` : 'Unavailable'],
    ['System RAM', ramAvailable ? `${((totalRam - freeRam) / 1024 ** 3).toFixed(2)} / ${(totalRam / 1024 ** 3).toFixed(2)} GB` : 'Unavailable'],
    ['GPU temperature', telemetry?.verified && Number.isFinite(Number(profile?.primaryGpu?.temperatureC)) ? `${Number(profile.primaryGpu.temperatureC).toFixed(0)} °C` : 'Unavailable'],
    ['Power draw', telemetry?.verified && Number.isFinite(Number(profile?.primaryGpu?.powerWatts)) ? `${Number(profile.primaryGpu.powerWatts).toFixed(0)} W` : 'Unavailable'],
  ]
  return <><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{rows.map(([label, value]) => <div key={label} className="rounded-lg border border-border bg-surface px-3 py-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-content-muted">{label}</p><p className="mt-1 text-sm font-medium text-content-primary">{value}</p></div>)}</div><p className="mt-2 text-[11px] text-content-muted">Live device telemetry from the Electron native collector. Per-job RAM or VRAM allocation is unavailable because NeuroSync does not yet run local CUDA training.</p></>
}

export default function ReceiverDashboard() {
  const isDesktop = Boolean(desktopRuntime())
  const { receivers, gpuMode } = useData()
  const { toast } = useToast()
  const utils = trpc.useUtils()
  const [fingerprint] = useState(getFingerprint)
  const [enrolled, setEnrolled] = useState(null)
  const [form, setForm] = useState({ name: 'My browser receiver', pricePerHour: 40 })
  const [transfer, setTransfer] = useState(null)
  const [agentTelemetry, setAgentTelemetry] = useState(null)
  const [desktopHardware, setDesktopHardware] = useState(null)
  const enroll = trpc.receivers.enroll.useMutation()
  const heartbeat = trpc.receivers.heartbeat.useMutation()
  const retire = trpc.receivers.retire.useMutation()
  const acceptJob = trpc.receivers.acceptJob.useMutation()

  const linkedDesktopReceiver = trpc.receivers.desktopReceiver.useQuery(undefined, {
    enabled: !isDesktop,
    refetchInterval: 5_000,
    placeholderData: (previous) => previous,
  })
  const directoryReceiver = useMemo(
    () => isDesktop ? receivers.find((receiver) => receiver.deviceFingerprint === fingerprint) || null : linkedDesktopReceiver.data || null,
    [fingerprint, isDesktop, linkedDesktopReceiver.data, receivers],
  )
  const receiverId = directoryReceiver?.id || (isDesktop ? enrolled?.id : null) || null
  const coordinatorState = trpc.receivers.coordinatorState.useQuery(
    { receiverId: receiverId || 'unregistered' },
    {
      enabled: Boolean(receiverId),
      retry: 4,
      retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 12_000),
      refetchInterval: 3_000,
      refetchOnWindowFocus: true,
      placeholderData: (previous) => previous,
    },
  )
  // Retain the last valid coordinator response for presentation only. Stable
  // receiverId still powers jobs and earnings if coordinator polling blips.
  const liveReceiver = coordinatorState.data || directoryReceiver || (isDesktop ? enrolled : null) || null
  const assignedJobs = trpc.receivers.assignedJobs.useQuery(
    { receiverId: receiverId || 'unregistered' },
    { enabled: Boolean(receiverId), retry: 4, retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 12_000), refetchInterval: 4_000, placeholderData: (previous) => previous },
  )
  const earnings = trpc.receivers.earnings.useQuery(
    { receiverId: receiverId || 'unregistered' },
    { enabled: Boolean(receiverId), retry: 4, retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 12_000), refetchInterval: 4_000, placeholderData: (previous) => previous },
  )
  const periodEarnings = trpc.receivers.analytics.useQuery(
    { receiverId: receiverId || 'unregistered', range: '7d' },
    { enabled: Boolean(receiverId), retry: 4, retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 12_000), refetchInterval: 8_000, placeholderData: (previous) => previous },
  )
  const activeJobs = useMemo(() => (assignedJobs.data || []).filter((item) => ACTIVE_STATUSES.has(item.job.status)), [assignedJobs.data])
  const duplicateReceivers = useMemo(
    () => isDesktop && liveReceiver ? receivers.filter((receiver) => receiver.ownerId === liveReceiver.ownerId && receiver.id !== liveReceiver.id) : [],
    [isDesktop, liveReceiver, receivers],
  )
  const refreshReceiverViews = () => Promise.all([
    utils.receivers.coordinatorState.invalidate({ receiverId }),
    utils.receivers.assignedJobs.invalidate({ receiverId }),
    utils.receivers.earnings.invalidate({ receiverId }),
    utils.receivers.analytics.invalidate({ receiverId, range: '7d' }),
    utils.catalog.receivers.invalidate(),
  ])
  const syncReceiver = (receiver) => {
    setEnrolled(receiver)
    utils.receivers.coordinatorState.setData({ receiverId: receiver.id }, receiver)
    utils.catalog.receivers.setData(undefined, (current) => current?.map((item) => item.id === receiver.id ? receiver : item) || current)
  }

  useEffect(() => {
    if (!isDesktop) {
      setAgentTelemetry(null)
      setDesktopHardware(null)
      return undefined
    }
    let mounted = true
    const refreshAgentTelemetry = async () => {
      const profile = await readDesktopHardwareProfile()
      if (mounted) {
        setDesktopHardware(profile)
        setAgentTelemetry(profile?.verifiedGpuTelemetry || null)
      }
    }
    refreshAgentTelemetry()
    const timer = window.setInterval(refreshAgentTelemetry, 3_000)
    return () => {
      mounted = false
      window.clearInterval(timer)
    }
  }, [isDesktop])

  useEffect(() => {
    if (!isDesktop || !receiverId) return undefined
    const sendHeartbeat = () => heartbeat.mutate({
      receiverId,
      availability: 'available',
      capabilities: {
        reportSource: 'desktop_receiver_native_runtime',
        gpuVerification: agentTelemetry?.verified ? 'verified_desktop_native_nvidia_smi' : 'native_gpu_unavailable',
        verifiedGpuTelemetry: agentTelemetry,
        desktopHardwareProfile: desktopHardware,
      },
      clientTimestamp: new Date(),
    }, { onSuccess: syncReceiver })
    sendHeartbeat()
    const timer = window.setInterval(sendHeartbeat, 5_000)
    return () => window.clearInterval(timer)
  }, [agentTelemetry, desktopHardware, isDesktop, receiverId])

  const submitEnrollment = async (event) => {
    event.preventDefault()
    if (!isDesktop) return
    try {
      const receiver = await enroll.mutateAsync({
        deviceFingerprint: fingerprint,
        name: form.name.trim() || 'My desktop receiver',
        gpu: agentTelemetry?.verified ? agentTelemetry.model : 'Native NVIDIA telemetry unavailable',
        vramGb: agentTelemetry?.verified ? Number(agentTelemetry.vramGb) : 0,
        pricePerHour: Number(form.pricePerHour),
        capabilities: {
          reportSource: 'desktop_receiver_native_runtime',
          gpuVerification: agentTelemetry?.verified ? 'verified_desktop_native_nvidia_smi' : 'native_gpu_unavailable',
          verifiedGpuTelemetry: agentTelemetry?.verified ? agentTelemetry : null,
          desktopHardwareProfile: desktopHardware,
        },
        isDirectoryVisible: true,
      })
      syncReceiver(receiver)
      toast.success(agentTelemetry?.verified ? 'Receiver registered with verified native NVIDIA telemetry.' : 'Receiver registered with native diagnostics marked unavailable.')
    } catch (error) {
      toast.error(error.message || 'Receiver enrollment failed.')
    }
  }

  const handleDelivery = async (item) => {
    if (!receiverId || !isDesktop) return
    try {
      setTransfer({ jobId: item.job.id, progress: 0 })
      await acceptJob.mutateAsync({ receiverId, jobId: item.job.id })
      await refreshReceiverViews()
      await downloadReceiverDataset({
        jobId: item.job.id,
        receiverId,
        onProgress: (progress) => setTransfer({ jobId: item.job.id, progress }),
      })
      toast.success('Protected dataset delivery completed in NeuroSync Desktop. The coordinator will queue execution after its persisted transfer confirmation.')
      window.setTimeout(() => refreshReceiverViews(), 1_000)
    } catch (error) {
      toast.error(error.message || 'Dataset delivery could not be completed. You can retry while the job remains in delivery.')
    } finally {
      setTransfer(null)
      refreshReceiverViews()
    }
  }

  const retireDuplicate = async (receiver) => {
    try {
      await retire.mutateAsync({ receiverId: receiver.id })
      toast.success(`${receiver.name || receiver.id} was removed from the live directory.`)
      await utils.catalog.receivers.invalidate()
    } catch (error) {
      toast.error(error.message || 'That receiver could not be retired.')
    }
  }

  const activeJob = activeJobs[0]

  if (!isDesktop) return (
    <PageContainer>
      <PageHeader eyebrow="Receiver web" title="Receiver activity" description="Your browser keeps receiver history and earnings. Job acceptance, protected dataset delivery, and native hardware telemetry run only in NeuroSync Desktop." />
      <Card className="border-accent/30">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Desktop receiver required</p>
        <h2 className="mt-1 text-lg font-semibold text-content-primary">Accept jobs in the desktop application</h2>
        <p className="mt-2 max-w-2xl text-sm text-content-secondary">The browser does not register hardware, inspect WebGPU, transfer datasets, or accept receiver offers. Download and open NeuroSync Desktop to receive offers and report actual device telemetry.</p>
        <a href={DESKTOP_PORTABLE_DOWNLOAD_URL} download className="ns-solid-button mt-4 inline-flex rounded-full border border-accent-edge bg-accent px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-accent-hover" style={{ color: '#151310' }}>{DESKTOP_PORTABLE_DOWNLOAD_LABEL}</a>
      </Card>
      {activeJob && <Card className="sticky top-20 z-20 mt-6 border-accent/50 bg-base/95 shadow-[0_14px_40px_rgba(0,0,0,0.35)] backdrop-blur"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-accent">Current receiver assignment</p><h2 className="mt-1 text-lg font-semibold text-content-primary">{activeJob.job.name}</h2><p className="mt-1 text-sm text-content-secondary">{activeJob.job.displayId} · {jobProgressText(activeJob.job, activeJob.assignment, null)}</p></div><Badge tone={activeJob.job.status === 'running' ? 'success' : 'warning'}>{formatStatus(activeJob.job.status)}</Badge></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-raised"><div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${Math.max(0, Math.min(100, Number(activeJob.job.metrics?.progress || 0)))}%` }} /></div><div className="mt-4 grid gap-3 text-xs text-content-secondary sm:grid-cols-2 lg:grid-cols-4"><p><span className="text-content-muted">Dataset</span><br />{activeJob.job.datasetName || 'Unavailable'}</p><p><span className="text-content-muted">Model / configuration</span><br />{activeJob.job.baseModelId || 'Unavailable'} · {activeJob.job.trainingMode || 'Unavailable'}</p><p><span className="text-content-muted">Offer accepted</span><br />{formatDate(activeJob.assignment.acceptedAt)}</p><p><span className="text-content-muted">Server payout</span><br />₹{Number(earnings.data?.projectedActiveEarnings || 0).toFixed(2)} projected</p></div><p className="mt-3 text-xs text-content-muted">Open NeuroSync Desktop to accept or manage this assignment. Browser resource telemetry is intentionally unavailable.</p></Card>}
    </PageContainer>
  )

  if (!receiverId || !liveReceiver) return (
    <PageContainer>
      <PageHeader title="Register this desktop receiver" description="Register this Electron receiver once. A secure heartbeat keeps this device visible to senders while the coordinator owns availability." />
      <Card className="max-w-3xl">
        <form className="grid gap-5" onSubmit={submitEnrollment}>
          <div className="rounded-xl border border-border-subtle bg-surface-raised p-4 text-sm text-content-secondary">
            <div className="mb-1 flex items-center gap-2 font-medium text-content-primary"><span className="h-2 w-2 rounded-full bg-emerald-400" />Live directory enrollment</div>
            The Electron main process gathers local operating-system and NVIDIA diagnostics. Browser WebGPU and WebGL are never used for desktop receiver hardware identity.
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-content-secondary">Receiver name<input className="rounded-lg border border-border-subtle bg-surface px-3 py-2 text-content-primary" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            <label className="grid gap-2 text-sm text-content-secondary">Rate / hour<input min="30" max="60" type="number" className="rounded-lg border border-border-subtle bg-surface px-3 py-2 text-content-primary" value={form.pricePerHour} onChange={(event) => setForm({ ...form, pricePerHour: event.target.value })} /></label>
          </div>
          <div><Button type="submit" loading={enroll.isPending} icon="chip">Register receiver</Button></div>
        </form>
      </Card>
    </PageContainer>
  )

  const state = STATUS_META[liveReceiver.availability] || STATUS_META.maintenance
  const gpuReport = truthfullyReportedGpu(null, agentTelemetry)
  const connectionLabel = coordinatorState.isError ? 'Connection lost — retrying' : coordinatorState.isFetching ? 'Connecting' : 'Connected'
  return (
    <PageContainer>
      <PageHeader title="Receiver Overview" description="Live receiver status, current-period earnings, and the active offer-to-execution lifecycle are synchronized from persisted coordinator records." />
      <Card className="sticky top-20 z-20 mb-6 border-accent/50 bg-base/95 shadow-[0_14px_40px_rgba(0,0,0,0.35)] backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-accent">Current receiver assignment</p><h3 className="mt-1 font-semibold text-content-primary">{activeJob ? activeJob.job.name : 'No active assignment'}</h3><p className="mt-1 text-sm text-content-secondary">{activeJob ? `${activeJob.job.displayId} · ${jobProgressText(activeJob.job, activeJob.assignment, transfer)}` : 'A new sender job will appear here automatically and remain pinned while active.'}</p></div>{activeJob && <Badge tone={activeJob.job.status === 'running' ? 'success' : activeJob.job.status === 'failed' ? 'danger' : 'warning'}>{formatStatus(activeJob.job.status)}</Badge>}</div>
        {activeJob && <div className="mt-5 grid gap-4"><div className="h-2 overflow-hidden rounded-full bg-surface-raised"><div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${Math.max(0, Math.min(100, activeJob.job.status === 'loading_dataset' ? transfer?.jobId === activeJob.job.id ? transfer.progress : activeJob.assignment.datasetDownloadCompletedAt ? 100 : 0 : Number(activeJob.job.metrics?.progress || 0)))}%` }} /></div><div className="grid gap-3 text-xs text-content-secondary sm:grid-cols-2 lg:grid-cols-4"><p><span className="text-content-muted">Dataset</span><br />{activeJob.job.datasetName || 'Unavailable'}</p><p><span className="text-content-muted">Configuration</span><br />{activeJob.job.baseModelId || 'Unavailable'} · {activeJob.job.trainingMode || 'Unavailable'}</p><p><span className="text-content-muted">Offer accepted</span><br />{formatDate(activeJob.assignment.acceptedAt)}</p><p><span className="text-content-muted">Server payout</span><br />₹{Number(earnings.data?.projectedActiveEarnings || 0).toFixed(2)} projected</p></div><RuntimeTelemetry profile={desktopHardware} telemetry={agentTelemetry} />{activeJob.assignment.failureReason && <p className="text-xs text-status-warning">Failure reason: {activeJob.assignment.failureReason}</p>}{transferActionLabel(activeJob.job, activeJob.assignment, transfer) && <div><Button loading={transfer?.jobId === activeJob.job.id || acceptJob.isPending} onClick={() => handleDelivery(activeJob)}>{transferActionLabel(activeJob.job, activeJob.assignment, transfer)}</Button><p className="mt-2 text-xs text-content-muted">Desktop delivery transfers the protected dataset before the shared coordinator may queue execution. Completed and running jobs never expose a download action.</p></div>}</div>}
      </Card>
      <div className={`mb-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${coordinatorState.isError ? 'border-status-warning/40 bg-status-warning/10 text-content-primary' : 'border-border bg-surface-raised text-content-secondary'}`}>
        <span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${coordinatorState.isError ? 'bg-amber-300' : coordinatorState.isFetching ? 'bg-accent' : 'bg-emerald-400'}`} />{connectionLabel}</span>
        {coordinatorState.isError && <Button size="sm" variant="secondary" onClick={() => coordinatorState.refetch()}>Retry now</Button>}
      </div>
      <Card className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent"><Icon name="chip" size={22} /></div><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-content-primary">{liveReceiver.name}</h2><Badge tone={gpuMode === 'external' ? 'cyan' : 'neutral'}>{gpuMode === 'external' ? 'External execution' : 'Simulation execution'}</Badge></div><p className="mt-1 text-sm font-medium text-content-primary">{gpuReport.text}</p><div className="mt-2 grid gap-x-5 gap-y-1 text-xs text-content-secondary sm:grid-cols-2"><p><span className="text-content-muted">Telemetry source</span><br />{gpuReport.sourceLabel}</p><p><span className="text-content-muted">Verification</span><br />{gpuReport.verification}</p><p><span className="text-content-muted">Runtime telemetry</span><br />{gpuReport.runtime}</p></div><p className={`mt-2 text-[11px] ${gpuReport.agentIsVerified ? 'text-emerald-400' : gpuReport.agentConnected ? 'text-amber-300' : 'text-content-muted'}`}>Native collector: {gpuReport.agentDiagnostic}</p></div></div>
          <div className="rounded-xl border border-border bg-surface px-3 py-2 text-right"><p className="text-[11px] uppercase tracking-wide text-content-muted">Coordinator state</p><p className="mt-1 flex items-center gap-2 text-sm font-medium text-content-primary"><span className={`h-2 w-2 rounded-full ${state.dot}`} />{state.label}</p></div>
        </div>
      </Card>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Card><p className="text-xs font-semibold uppercase tracking-wide text-accent">Today’s earnings</p><p className="mt-1 text-2xl font-semibold text-content-primary">₹{Number(periodEarnings.data?.summary?.today || 0).toFixed(2)}</p><p className="mt-1 text-xs text-content-secondary">Completed payouts recorded today (UTC).</p></Card><Card><p className="text-xs font-semibold uppercase tracking-wide text-accent">This week</p><p className="mt-1 text-2xl font-semibold text-content-primary">₹{Number(periodEarnings.data?.summary?.week || 0).toFixed(2)}</p><p className="mt-1 text-xs text-content-secondary">Completed payouts over the last seven days.</p></Card><Card><p className="text-xs font-semibold uppercase tracking-wide text-accent">Projected active payout</p><p className="mt-1 text-2xl font-semibold text-content-primary">₹{Number(earnings.data?.projectedActiveEarnings || 0).toFixed(2)}</p><p className="mt-1 text-xs text-content-secondary">Server-derived from the sender estimate and active assignment.</p></Card><Card><p className="text-xs font-semibold uppercase tracking-wide text-accent">Accrued active payout</p><p className="mt-1 text-2xl font-semibold text-content-primary">₹{Number(earnings.data?.accruedActiveEarnings || 0).toFixed(2)}</p><p className="mt-1 text-xs text-content-secondary">No payout is invented before an execution-ready assignment exists.</p></Card></div>

      {duplicateReceivers.length > 0 && <Card className="mb-6 border-status-warning/30"><p className="text-xs font-semibold uppercase tracking-wide text-status-warning">Other browser registrations</p><h3 className="mt-1 font-semibold text-content-primary">Retire stale duplicate receivers</h3><p className="mt-1 text-sm text-content-secondary">Retire only a device you no longer use. Active assignments cannot be removed.</p><div className="mt-4 grid gap-2">{duplicateReceivers.map((receiver) => <div key={receiver.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3"><div><p className="text-sm font-medium text-content-primary">{receiver.name || receiver.id}</p><p className="text-xs text-content-muted">{receiver.availability} · GPU details {receiver.capabilities?.verifiedGpuTelemetry ? 'verified by agent' : 'unavailable in browser'}</p></div><Button size="sm" variant="danger" loading={retire.isPending} onClick={() => retireDuplicate(receiver)}>Retire</Button></div>)}</div></Card>}

    </PageContainer>
  )
}
