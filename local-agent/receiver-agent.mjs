#!/usr/bin/env node
/**
 * NeuroSync optional receiver agent. Run this on the receiver's own machine;
 * it never runs in the web app or sandbox. It exposes local nvidia-smi output
 * to one configured NeuroSync origin over loopback only.
 */
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const port = Number(process.env.NS_AGENT_PORT || 47831)
const allowedOrigins = new Set(
  (process.env.NS_ALLOWED_ORIGINS || process.env.NS_ALLOWED_ORIGIN || 'https://neurosync-beikmn85.manus.space')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
)
const agentVersion = '1.1.0'

function nvidiaSmiCandidates() {
  const systemRoot = process.env.SystemRoot || process.env.WINDIR || 'C:\\Windows'
  return [
    'nvidia-smi',
    `${systemRoot}\\System32\\nvidia-smi.exe`,
    'C:\\Program Files\\NVIDIA Corporation\\NVSMI\\nvidia-smi.exe',
    'C:\\Program Files (x86)\\NVIDIA Corporation\\NVSMI\\nvidia-smi.exe',
  ]
}

async function locateNvidiaSmi() {
  for (const candidate of nvidiaSmiCandidates()) {
    if (candidate !== 'nvidia-smi' && !existsSync(candidate)) continue
    try {
      await exec(candidate, ['--help'], { timeout: 4_000, windowsHide: true })
      return candidate
    } catch (error) {
      if (candidate === 'nvidia-smi' && error?.code === 'ENOENT') continue
      // A found executable can return a non-zero help code on unusual drivers;
      // it is still the correct executable to query on the next request.
      if (candidate !== 'nvidia-smi' || error?.code !== 'ENOENT') return candidate
    }
  }
  return null
}

async function readNvidiaTelemetry() {
  const executable = await locateNvidiaSmi()
  if (!executable) {
    return {
      available: false,
      verified: false,
      source: 'nvidia-smi',
      observedAt: new Date().toISOString(),
      availability: 'telemetry_unavailable',
      reason: 'nvidia_smi_not_found',
      diagnostic: 'NVIDIA telemetry is unavailable because nvidia-smi was not found in PATH or standard Windows driver locations. Install or repair the NVIDIA driver.',
      gpus: [],
    }
  }
  try {
    const { stdout } = await exec(executable, ['--query-gpu=name,memory.total,memory.used,utilization.gpu,uuid', '--format=csv,noheader,nounits'], { timeout: 4_000, windowsHide: true })
    const gpus = stdout.trim().split(/\r?\n/).map((line) => {
      const [model = '', totalMemoryMb = '', usedMemoryMb = '', utilization = '', uuid = ''] = line.split(',').map((part) => part.trim())
      const totalMb = Number(totalMemoryMb)
      const usedMb = Number(usedMemoryMb)
      const utilizationPct = Number(utilization)
      return {
        model,
        // nvidia-smi reports memory in MiB with nounits; expose correctly
        // labeled GiB values to the browser rather than claiming MiB as GB.
        vramGb: Number.isFinite(totalMb) ? Number((totalMb / 1024).toFixed(2)) : null,
        vramUsedGb: Number.isFinite(usedMb) ? Number((usedMb / 1024).toFixed(2)) : null,
        vramFreeGb: Number.isFinite(totalMb) && Number.isFinite(usedMb) ? Number(((totalMb - usedMb) / 1024).toFixed(2)) : null,
        utilizationPct: Number.isFinite(utilizationPct) ? utilizationPct : null,
        uuid,
      }
    }).filter((gpu) => gpu.model && Number.isFinite(gpu.vramGb))
    const primary = gpus[0] || null
    return {
      available: gpus.length > 0,
      verified: gpus.length > 0,
      source: 'nvidia-smi',
      vendor: gpus.length > 0 ? 'NVIDIA' : null,
      observedAt: new Date().toISOString(),
      availability: gpus.length > 0 ? 'telemetry_available' : 'telemetry_unavailable',
      name: primary?.model || null,
      vram_total_mb: primary?.vramGb != null ? Math.round(primary.vramGb * 1024) : null,
      vram_used_mb: primary?.vramUsedGb != null ? Math.round(primary.vramUsedGb * 1024) : null,
      utilization_percent: primary?.utilizationPct ?? null,
      gpus,
    }
  } catch (error) {
    const reason = error?.code === 'ENOENT' ? 'nvidia_smi_not_found' : 'nvidia_smi_failed'
    return {
      available: false,
      verified: false,
      source: 'nvidia-smi',
      observedAt: new Date().toISOString(),
      availability: 'telemetry_unavailable',
      reason,
      diagnostic: reason === 'nvidia_smi_not_found'
        ? 'NVIDIA telemetry is unavailable because nvidia-smi was not found. Install or repair the NVIDIA driver.'
        : `NVIDIA telemetry could not be read from ${executable}. Check that the NVIDIA driver is running and nvidia-smi can execute.`,
      details: typeof error?.message === 'string' ? error.message : undefined,
      gpus: [],
    }
  }
}

function permitOrigin(request, response) {
  const origin = request.headers.origin
  // CLI diagnostics have no Origin. Browser requests must match an explicitly
  // configured NeuroSync origin; wildcard CORS is never used.
  if (!origin) return true
  if (!allowedOrigins.has(origin)) return false
  response.setHeader('Access-Control-Allow-Origin', origin)
  response.setHeader('Vary', 'Origin')
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  return true
}

const server = createServer(async (request, response) => {
  if (!permitOrigin(request, response)) {
    response.writeHead(403, { 'Content-Type': 'application/json' })
    return response.end(JSON.stringify({ error: 'This local agent only accepts the configured NeuroSync origin.' }))
  }
  if (request.method === 'OPTIONS') return response.writeHead(204).end()
  if (request.method !== 'GET') {
    response.writeHead(404, { 'Content-Type': 'application/json' })
    return response.end(JSON.stringify({ error: 'Not found.' }))
  }
  const pathname = new URL(request.url || '/', 'http://127.0.0.1').pathname
  if (pathname === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    return response.end(JSON.stringify({ status: 'ok', agent: 'neurosync-receiver', version: agentVersion, bind: '127.0.0.1', observedAt: new Date().toISOString() }))
  }
  if (pathname === '/status') {
    response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    return response.end(JSON.stringify({ status: 'ok', agent: 'neurosync-receiver', version: agentVersion, bind: '127.0.0.1', endpoints: ['/health', '/gpu', '/status'] }))
  }
  if (pathname !== '/gpu' && pathname !== '/v1/telemetry') {
    response.writeHead(404, { 'Content-Type': 'application/json' })
    return response.end(JSON.stringify({ error: 'Not found.' }))
  }
  const telemetry = await readNvidiaTelemetry()
  response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  response.end(JSON.stringify(telemetry))
})

server.on('error', (error) => {
  const message = error?.code === 'EADDRINUSE'
    ? `Port ${port} is already in use. Close the existing process or free 127.0.0.1:${port}, then run start_receiver_agent.bat again.`
    : `The local agent could not start: ${error?.message || 'Unknown error'}`
  console.error(`ERROR: ${message}`)
  process.exitCode = 1
})

server.listen(port, '127.0.0.1', async () => {
  console.log('========================================')
  console.log(' NeuroSync Receiver Agent')
  console.log('========================================')
  console.log('Status: RUNNING')
  console.log('Host: 127.0.0.1')
  console.log(`Port: ${port}`)
  console.log(`Health: http://127.0.0.1:${port}/health`)
  console.log(`GPU:    http://127.0.0.1:${port}/gpu`)
  console.log(`Allowed browser origin(s): ${[...allowedOrigins].join(', ')}`)
  console.log('Detecting NVIDIA GPU...')
  const telemetry = await readNvidiaTelemetry()
  if (telemetry.verified) {
    const gpu = telemetry.gpus[0]
    console.log(`GPU detected: ${gpu.model}`)
    console.log(`VRAM: ${gpu.vramGb} GiB`)
    console.log('Agent ready.')
  } else {
    console.warn('GPU detection failed.')
    console.warn(`Reason: ${telemetry.diagnostic || telemetry.reason || 'Unknown NVIDIA telemetry error'}`)
    console.warn('The agent is still running. Fix the driver issue and refresh the Receiver Overview.')
  }
})
