export function desktopRuntime() {
  if (typeof window === 'undefined' || !window.neurosyncDesktop?.isDesktop) return null
  return window.neurosyncDesktop
}

export async function readDesktopHardwareProfile() {
  const runtime = desktopRuntime()
  if (!runtime) return null
  try {
    return await runtime.getHardwareProfile()
  } catch (error) {
    return {
      observedAt: new Date().toISOString(),
      verifiedGpuTelemetry: { connected: false, verified: false, diagnostic: error.message || 'Desktop hardware telemetry could not be read.' },
    }
  }
}
