import { useNavigate } from 'react-router-dom'
import { PageContainer, PageHeader } from '../components/ui/PageContainer'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { desktopRuntime } from '../services/desktopRuntime'

export default function DesktopLaunch() {
  const navigate = useNavigate()
  const isDesktop = Boolean(desktopRuntime())
  const choose = (workspaceRole) => {
    if (isDesktop) window.sessionStorage.setItem('neurosync.desktop.workspace', workspaceRole)
    navigate(workspaceRole === 'receiver' ? '/receiver' : '/dashboard')
  }
  return <PageContainer>
    <PageHeader eyebrow="NeuroSync desktop" title="Choose this machine’s workspace" description="Sender mode manages jobs using the shared NeuroSync backend. Receiver mode uses the desktop’s native hardware collector when available." />
    {!isDesktop && <div className="mb-5 rounded-lg border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">This route is designed for NeuroSync Desktop. In a standard browser, receiver hardware identity remains browser capability-only.</div>}
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="p-6"><Icon name="send" className="mb-4 text-cream" /><h2 className="text-xl font-semibold text-content-primary">Sender</h2><p className="mt-2 text-sm text-content-secondary">Create fine-tuning jobs, choose models and configuration, upload datasets, select marketplace receivers, and monitor shared job status.</p><Button className="mt-6" onClick={() => choose('sender')}>Open sender workspace</Button></Card>
      <Card className="p-6"><Icon name="cpu" className="mb-4 text-emerald-300" /><h2 className="text-xl font-semibold text-content-primary">Receiver</h2><p className="mt-2 text-sm text-content-secondary">Read this machine’s NVIDIA telemetry locally, register verified hardware, receive offers, transfer datasets, and track shared earnings.</p><Button className="mt-6" onClick={() => choose('receiver')}>Open receiver workspace</Button></Card>
    </div>
  </PageContainer>
}
