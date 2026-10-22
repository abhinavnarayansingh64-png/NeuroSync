import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { evaluateDesktopReadiness } from '../client/src/services/desktopReadiness'

const source = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8')
const main = source('electron/main.mjs')
const preload = source('electron/preload.mjs')
const telemetry = source('electron/nativeTelemetry.mjs')
const db = source('server/neurosyncDb.ts')
const launch = source('client/src/pages/DesktopLaunch.jsx')
const hardwarePage = source('client/src/pages/ReceiverHardware.jsx')
const receiverDashboard = source('client/src/pages/ReceiverDashboard.jsx')
const appLayout = source('client/src/layouts/AppLayout.jsx')
const receiverIdentity = source('client/src/hooks/useReceiverIdentity.js')

describe('Electron desktop shell contract', () => {
  it('keeps Node access in the main process and exposes only the narrow hardware bridge', () => {
    expect(main).toContain('contextIsolation: true')
    expect(main).toContain('nodeIntegration: false')
    expect(main).toContain("ipcMain.handle('neurosync:hardware-profile'")
    expect(preload).toContain("contextBridge.exposeInMainWorld('neurosyncDesktop'")
    expect(preload).toContain("ipcRenderer.invoke('neurosync:hardware-profile')")
    expect(preload).not.toContain('send:')
    expect(preload).not.toContain('require(')
  })

  it('uses a desktop-session role selection instead of mutating the shared website role', () => {
    expect(launch).toContain("sessionStorage.setItem('neurosync.desktop.workspace', workspaceRole)")
    expect(launch).not.toContain('updateSettings')
  })
})

describe('native telemetry and authoritative capability contract', () => {
  it('uses native NVIDIA tools and reports unavailable state rather than fabricating hardware', () => {
    expect(telemetry).toContain("desktop_native_nvidia_smi")
    expect(telemetry).toContain("'nvidia-smi.exe'")
    expect(telemetry).toContain('memory.total,memory.used,utilization.gpu,temperature.gpu,power.draw,driver_version')
    expect(telemetry).toContain("'nvidia-smi is unavailable. Install a current NVIDIA driver")
    expect(telemetry).toContain("'nvcc'")
    expect(telemetry).toContain("'PyTorch is not installed for the detected Python runtime.'")
    expect(db).toContain('telemetry?.source === "desktop_native_nvidia_smi"')
  })

  it('keeps native profile, storage, CUDA, and catalog-readiness sections separate in the receiver interface', () => {
    expect(hardwarePage).toContain('Native GPU')
    expect(hardwarePage).toContain('Runtime readiness')
    expect(hardwarePage).toContain('System drives')
    expect(hardwarePage).toContain('Catalog VRAM readiness')
    expect(hardwarePage).toContain('real local CUDA training runner')
  })
})

describe('catalog-only readiness evaluator', () => {
  const models = [
    { id: 'small', name: 'Small', metadata: { recommendedVram: '8 GB' } },
    { id: 'large', name: 'Large', metadata: { recommendedVram: '16 GB' } },
  ]

  it('compares only verified native VRAM with an existing catalog recommendation', () => {
    const result = evaluateDesktopReadiness({ verifiedGpuTelemetry: { verified: true, vramGb: 12 } }, models)
    expect(result.map((item) => item.status)).toEqual(['Ready', 'Not Suitable'])
    expect(result[0].explanation).toContain('catalog recommendation')
  })

  it('does not infer VRAM or runtime support when native telemetry is unavailable', () => {
    const result = evaluateDesktopReadiness({ verifiedGpuTelemetry: { verified: false } }, models)
    expect(result.map((item) => item.status)).toEqual(['Unknown', 'Unknown'])
    expect(result[0].explanation).toContain('verified native NVIDIA VRAM value is unavailable')
  })
})

describe('browser receiver desktop-handoff contract', () => {
  it('keeps browser receiver navigation focused on history and earnings rather than hardware operations', () => {
    expect(appLayout).toContain('const BROWSER_RECEIVER_NAV_ITEMS')
    expect(appLayout).toContain("{ to: '/receiver/history', label: 'Job History'")
    expect(appLayout).toContain("{ to: '/receiver/earnings', label: 'Earnings & Analytics'")
    expect(appLayout).not.toContain("{ to: '/receiver/hardware', label: 'Hardware', icon: 'cpu' }\n]\n\nfunction SidebarContent")
  })

  it('does not read browser WebGPU or the browser local agent and sends pending offers to the desktop download', () => {
    expect(receiverDashboard).not.toContain("../services/gpuDetection")
    expect(receiverDashboard).not.toContain("../services/receiverAgent")
    expect(receiverDashboard).not.toContain('Browser diagnostic:')
    expect(receiverDashboard).toContain('Desktop receiver required')
    expect(receiverDashboard).toContain('DESKTOP_PORTABLE_DOWNLOAD_URL')
    expect(receiverDashboard).toContain('Open NeuroSync Desktop to accept or manage this assignment.')
  })

  it('pins active work above the desktop overview and displays only Electron native runtime measurements', () => {
    expect(receiverDashboard).toContain('sticky top-20 z-20')
    expect(receiverDashboard).toContain('Current receiver assignment')
    expect(receiverDashboard).toContain('<RuntimeTelemetry profile={desktopHardware} telemetry={agentTelemetry} />')
    expect(receiverDashboard).toContain('Live device telemetry from the Electron native collector')
    expect(receiverDashboard).toContain('Per-job RAM or VRAM allocation is unavailable because NeuroSync does not yet run local CUDA training.')
  })

  it('resolves browser history and earnings through the authenticated desktop receiver instead of legacy browser registrations', () => {
    expect(receiverIdentity).toContain('() => isDesktop ? receivers.find')
    expect(receiverIdentity).toContain('enabled: !isDesktop')
    expect(db).toContain('getDesktopReceiverForUser')
  })
})
