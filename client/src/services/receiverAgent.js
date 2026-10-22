const LOCAL_AGENT_BASE_URL = import.meta.env.VITE_RECEIVER_AGENT_URL || 'http://127.0.0.1:47831'
const LOCAL_AGENT_URL = `${LOCAL_AGENT_BASE_URL.replace(/\/$/, '')}/gpu`

/**
 * Browser APIs can expose limited GPU identity, but not universally reliable
 * NVIDIA runtime telemetry. This optional loopback request accepts only data
 * explicitly sourced by the user-run receiver agent's nvidia-smi query.
 */
export async function readLocalReceiverAgent() {
  try {
    const response = await fetch(LOCAL_AGENT_URL, { method: 'GET', cache: 'no-store', signal: AbortSignal.timeout(2_500) })
    if (!response.ok) return { connected: false, endpoint: LOCAL_AGENT_URL, reason: 'agent_http_error', diagnostic: `The local agent returned HTTP ${response.status}.` }
    const payload = await response.json()
    const primary = Array.isArray(payload?.gpus) ? payload.gpus[0] : null
    if (!payload?.verified || payload?.source !== 'nvidia-smi' || payload?.availability !== 'telemetry_available' || !primary?.model || !Number.isFinite(Number(primary.vramGb))) {
      return {
        connected: true,
        verified: false,
        endpoint: LOCAL_AGENT_URL,
        source: payload?.source || 'nvidia-smi',
        observedAt: payload?.observedAt || new Date().toISOString(),
        reason: payload?.reason || 'gpu_telemetry_unavailable',
        diagnostic: payload?.diagnostic || 'The local agent is reachable but NVIDIA telemetry is unavailable.',
      }
    }
    return {
      connected: true,
      verified: true,
      endpoint: LOCAL_AGENT_URL,
      source: 'nvidia-smi',
      model: String(primary.model),
      vramGb: Number(primary.vramGb),
      vramUsedGb: Number.isFinite(Number(primary.vramUsedGb)) ? Number(primary.vramUsedGb) : null,
      vramFreeGb: Number.isFinite(Number(primary.vramFreeGb)) ? Number(primary.vramFreeGb) : null,
      utilizationPct: Number.isFinite(Number(primary.utilizationPct)) ? Number(primary.utilizationPct) : null,
      gpuUuid: typeof primary.uuid === 'string' ? primary.uuid : undefined,
      observedAt: typeof payload.observedAt === 'string' ? payload.observedAt : new Date().toISOString(),
    }
  } catch (error) {
    return {
      connected: false,
      verified: false,
      endpoint: LOCAL_AGENT_URL,
      reason: 'agent_unreachable',
      diagnostic: 'The browser could not reach the local receiver agent. Start it on this machine, then the dashboard will retry automatically.',
      error: error?.name || 'NetworkError',
    }
  }
}
