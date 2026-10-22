import { useEffect, useMemo, useState } from 'react'
import { trpc } from '../lib/trpc'
import { desktopRuntime, readDesktopHardwareProfile } from '../services/desktopRuntime'
import { evaluateDesktopReadiness, readinessTone } from '../services/desktopReadiness'
import { PageContainer, PageHeader } from '../components/ui/PageContainer'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { DESKTOP_PORTABLE_DOWNLOAD_URL, DESKTOP_PORTABLE_LABEL } from '../services/desktopDownload'

const bytes = (value) => {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return 'Unavailable'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(units.length - 1, Math.floor(Math.log(Math.max(amount, 1)) / Math.log(1024)))
  return `${(amount / (1024 ** index)).toFixed(index > 2 ? 2 : 0)} ${units[index]}`
}

const number = (value, suffix = '') => Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}${suffix}` : 'Unavailable'
const dateTime = (value) => value ? new Date(value).toLocaleString() : 'Unavailable'

function DetailGrid({ rows }) {
  return <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{rows.map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-surface p-3"><p className="text-[11px] font-medium uppercase tracking-wide text-content-muted">{label}</p><p className="mt-1 break-words text-sm font-medium text-content-primary">{value || 'Unavailable'}</p></div>)}</div>
}

export default function ReceiverHardware() {
  const isDesktop = Boolean(desktopRuntime())
  const [profile, setProfile] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const models = trpc.catalog.baseModels.useQuery(undefined, { staleTime: 60_000 })

  const refresh = async () => {
    if (!isDesktop) return
    setRefreshing(true)
    const next = await readDesktopHardwareProfile()
    setProfile(next)
    setRefreshing(false)
  }

  useEffect(() => {
    if (!isDesktop) return undefined
    let active = true
    const poll = async () => {
      const next = await readDesktopHardwareProfile()
      if (active) setProfile(next)
    }
    poll()
    const timer = window.setInterval(poll, 3_000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [isDesktop])

  const readiness = useMemo(() => evaluateDesktopReadiness(profile, models.data), [models.data, profile])
  const gpu = profile?.primaryGpu
  const telemetry = profile?.verifiedGpuTelemetry
  const nativeVerified = telemetry?.verified === true && telemetry?.source === 'desktop_native_nvidia_smi'

  return <PageContainer>
    <PageHeader eyebrow="Receiver desktop" title="Hardware & Readiness" description="Native data is read by the Electron main process from the local operating system and NVIDIA tools. It is never inferred from WebGPU or manual entry." />
    {!isDesktop && <Card className="border-amber-300/30 bg-amber-300/5"><p className="text-sm font-medium text-amber-100">Hardware and job acceptance are available in NeuroSync Desktop.</p><p className="mt-1 text-sm text-content-secondary">The browser does not inspect, register, or present device hardware. Download the desktop receiver to accept offers and report truthful local runtime telemetry.</p><a className="ns-solid-button mt-4 inline-flex items-center justify-center rounded-full border border-accent-edge bg-accent px-5 py-2.5 text-sm font-medium transition-colors hover:bg-accent-hover" style={{ color: '#151310' }} href={DESKTOP_PORTABLE_DOWNLOAD_URL} download>{DESKTOP_PORTABLE_LABEL}</a></Card>}
    {isDesktop && <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3"><div><p className="text-sm font-medium text-content-primary">Native collector</p><p className="text-xs text-content-secondary">Last observed: {dateTime(profile?.observedAt)}</p></div><div className="flex items-center gap-2"><Badge tone={nativeVerified ? 'success' : 'warning'}>{nativeVerified ? 'Verified NVIDIA telemetry' : 'Native diagnostics incomplete'}</Badge><Button size="sm" variant="secondary" disabled={refreshing} onClick={refresh}>{refreshing ? 'Refreshing…' : 'Refresh now'}</Button></div></div>}
    <div className="grid gap-6 xl:grid-cols-2">
      <Card><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-accent">Native GPU</p><h2 className="mt-1 text-lg font-semibold text-content-primary">{nativeVerified ? gpu?.model || telemetry?.model : 'NVIDIA telemetry unavailable'}</h2></div><Badge tone={nativeVerified ? 'success' : 'neutral'}>{nativeVerified ? 'nvidia-smi verified' : 'Unavailable'}</Badge></div><DetailGrid rows={[["Driver", gpu?.driverVersion], ["Compute capability", gpu?.computeCapability], ["VRAM total", number(gpu?.vramTotalMb / 1024, ' GB')], ["VRAM used", number(gpu?.vramUsedMb / 1024, ' GB')], ["VRAM free", number(gpu?.vramAvailableMb / 1024, ' GB')], ["Utilization", number(gpu?.utilizationPct, '%')], ["Temperature", number(gpu?.temperatureC, ' °C')], ["Power draw", number(gpu?.powerWatts, ' W')]]} /><p className="mt-4 text-xs text-content-secondary">{profile?.nvidia?.diagnostic || telemetry?.diagnostic || 'No native GPU diagnostic is available.'}</p></Card>
      <Card><p className="text-xs font-semibold uppercase tracking-wide text-accent">System</p><h2 className="mt-1 text-lg font-semibold text-content-primary">Local desktop profile</h2><DetailGrid rows={[["Operating system", profile?.platform], ["Architecture", profile?.architecture], ["CPU", profile?.cpu?.model], ["Logical CPU cores", profile?.cpu?.logicalCores], ["Physical CPU cores", profile?.cpu?.physicalCores], ["Memory total", bytes(profile?.memory?.totalBytes)], ["Memory free", bytes(profile?.memory?.freeBytes)], ["CPU diagnostic", profile?.cpu?.diagnostic]]} /></Card>
      <Card><p className="text-xs font-semibold uppercase tracking-wide text-accent">Runtime readiness</p><h2 className="mt-1 text-lg font-semibold text-content-primary">CUDA & PyTorch</h2><DetailGrid rows={[["CUDA toolkit", profile?.cuda?.cudaToolkit?.available ? `Detected${profile.cuda.cudaToolkit.version ? ` · ${profile.cuda.cudaToolkit.version}` : ''}` : 'Unavailable'], ["CUDA diagnostic", profile?.cuda?.cudaToolkit?.diagnostic], ["PyTorch CUDA", profile?.cuda?.pytorch?.available ? `Available · ${profile.cuda.pytorch.count} device(s)` : 'Unavailable'], ["PyTorch CUDA version", profile?.cuda?.pytorch?.version], ["PyTorch devices", profile?.cuda?.pytorch?.devices?.join(', ') || null], ["PyTorch diagnostic", profile?.cuda?.pytorch?.diagnostic]]} /><p className="mt-4 text-xs text-content-secondary">The shared catalog does not define a CUDA toolkit or PyTorch prerequisite for any model, so these facts are reported but never invented as requirements.</p></Card>
      <Card><p className="text-xs font-semibold uppercase tracking-wide text-accent">Storage</p><h2 className="mt-1 text-lg font-semibold text-content-primary">System drives</h2>{profile?.storage?.drives?.length ? <div className="mt-4 space-y-3">{profile.storage.drives.map((drive) => <div key={drive.name} className="rounded-xl border border-border bg-surface p-3"><p className="text-sm font-medium text-content-primary">{drive.name}</p><p className="mt-1 text-xs text-content-secondary">{bytes(drive.freeBytes)} free of {bytes(drive.totalBytes)} · {bytes(drive.usedBytes)} used</p></div>)}</div> : <p className="mt-4 text-sm text-content-secondary">{profile?.storage?.diagnostic || 'Storage has not been collected yet.'}</p>}</Card>
    </div>
    <Card className="mt-6"><div><p className="text-xs font-semibold uppercase tracking-wide text-accent">Catalog VRAM readiness</p><h2 className="mt-1 text-lg font-semibold text-content-primary">Hardware comparison, not an execution claim</h2><p className="mt-1 text-sm text-content-secondary">Each status compares the verified total GPU VRAM with the shared catalog’s published recommendation. NeuroSync does not yet include a real local CUDA training runner, so a Ready result does not claim that fine-tuning will execute on this machine.</p></div><div className="mt-5 grid gap-3 lg:grid-cols-2">{models.isLoading ? <p className="text-sm text-content-secondary">Loading shared model metadata…</p> : readiness.map((item) => <div key={item.id} className="rounded-xl border border-border bg-surface p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-content-primary">{item.name}</p><p className="mt-1 text-xs text-content-secondary">Catalog VRAM recommendation: {item.recommendedVramGb === null ? 'Unavailable' : `${item.recommendedVramGb} GB`}</p></div><Badge tone={readinessTone(item.status)}>{item.status}</Badge></div><p className="mt-3 text-sm text-content-secondary">{item.explanation}</p><p className="mt-3 text-xs text-content-muted">{item.storageSize ? `Catalog storage size: ${item.storageSize}` : 'Catalog storage size unavailable'}{item.referenceHardware ? ` · Reference: ${item.referenceHardware}` : ''}{item.referenceFineTuneTime ? ` · Reference time: ${item.referenceFineTuneTime}` : ''}</p></div>)}</div></Card>
    <Card className="mt-6 border-border"><p className="text-xs font-semibold uppercase tracking-wide text-accent">Future boundary</p><p className="mt-1 text-sm text-content-secondary">This desktop milestone does not implement encryption, confidential-computing/TEE controls, blockchain, or real CUDA training. The existing shared job lifecycle, protected dataset delivery, polling reconciliation, and server-side payout records remain authoritative.</p></Card>
  </PageContainer>
}
