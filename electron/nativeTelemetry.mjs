import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const NATIVE_NVIDIA_SOURCE = 'desktop_native_nvidia_smi'

async function command(file, args) {
  try {
    const { stdout } = await execFileAsync(file, args, {
      timeout: 5_000,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    })
    return { ok: true, output: stdout.trim() }
  } catch (error) {
    const diagnostic = error?.code === 'ENOENT'
      ? `${file} was not found.`
      : String(error?.message || error)
    return { ok: false, output: '', diagnostic }
  }
}

function numeric(value) {
  const parsed = Number.parseFloat(String(value || '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function parseNvidiaRows(output) {
  return output.split(/\r?\n/).filter(Boolean).map((line, index) => {
    const [model, totalMb, usedMb, utilizationPct, temperatureC, powerWatts, driverVersion] = line.split(',').map((value) => value.trim())
    const total = numeric(totalMb)
    const used = numeric(usedMb)
    return {
      index,
      model: model || null,
      vramTotalMb: total,
      vramUsedMb: used,
      vramAvailableMb: total !== null && used !== null ? Math.max(total - used, 0) : null,
      utilizationPct: numeric(utilizationPct),
      temperatureC: numeric(temperatureC),
      powerWatts: numeric(powerWatts),
      driverVersion: driverVersion || null,
      computeCapability: null,
    }
  })
}

async function nvidiaTelemetry() {
  const candidates = process.platform === 'win32'
    ? ['nvidia-smi.exe', 'C:\\Windows\\System32\\nvidia-smi.exe', 'C:\\Program Files\\NVIDIA Corporation\\NVSMI\\nvidia-smi.exe']
    : ['nvidia-smi']
  const args = [
    '--query-gpu=name,memory.total,memory.used,utilization.gpu,temperature.gpu,power.draw,driver_version',
    '--format=csv,noheader,nounits',
  ]

  for (const candidate of candidates) {
    const base = await command(candidate, args)
    if (!base.ok) continue
    const gpus = parseNvidiaRows(base.output)
    if (!gpus.length) continue
    const compute = await command(candidate, ['--query-gpu=compute_cap', '--format=csv,noheader,nounits'])
    const values = compute.ok ? compute.output.split(/\r?\n/).map((value) => value.trim()) : []
    const enriched = gpus.map((gpu, index) => ({
      ...gpu,
      computeCapability: values[index] || null,
    }))
    return {
      available: true,
      source: NATIVE_NVIDIA_SOURCE,
      gpus: enriched,
      diagnostic: compute.ok ? null : 'NVIDIA telemetry is available, but GPU compute capability is not exposed by this driver.',
    }
  }

  return {
    available: false,
    source: NATIVE_NVIDIA_SOURCE,
    gpus: [],
    diagnostic: 'nvidia-smi is unavailable. Install a current NVIDIA driver or use a supported NVIDIA GPU.',
  }
}

function parseCudaVersion(output) {
  const match = output.match(/(?:release|V)(\d+(?:\.\d+){1,2})/i)
  return match?.[1] || null
}

async function firstAvailableCommand(candidates, args) {
  let lastDiagnostic = null
  for (const candidate of candidates) {
    const result = await command(candidate, args)
    if (result.ok) return { ...result, command: candidate }
    lastDiagnostic = result.diagnostic || lastDiagnostic
  }
  return { ok: false, output: '', diagnostic: lastDiagnostic || 'Command was unavailable.' }
}

async function cudaAndTorch() {
  const nvccCandidates = process.platform === 'win32'
    ? [
        process.env.CUDA_PATH ? path.join(process.env.CUDA_PATH, 'bin', 'nvcc.exe') : null,
        'nvcc.exe',
      ].filter(Boolean)
    : ['nvcc']
  const nvcc = await firstAvailableCommand(nvccCandidates, ['--version'])
  const pythonCandidates = process.platform === 'win32'
    ? [['py.exe', ['-3']], ['python.exe', []], ['python', []]]
    : [['python3', []], ['python', []]]
  const torchProgram = [
    'import json',
    'import torch',
    'available = torch.cuda.is_available()',
    'print(json.dumps({"available": available, "version": torch.version.cuda, "count": torch.cuda.device_count(), "devices": [torch.cuda.get_device_name(i) for i in range(torch.cuda.device_count())] if available else []}))',
  ].join('; ')
  let torch = { ok: false, output: '', diagnostic: 'Python with PyTorch could not be queried.' }
  for (const [python, prefix] of pythonCandidates) {
    const result = await command(python, [...prefix, '-c', torchProgram])
    if (result.ok) {
      torch = result
      break
    }
    torch = result
  }
  let pytorch = { available: false, version: null, count: 0, devices: [], diagnostic: torch.diagnostic || 'Python with PyTorch could not be queried.' }
  if (torch.ok) {
    try {
      const parsed = JSON.parse(torch.output)
      pytorch = {
        available: parsed.available === true,
        version: typeof parsed.version === 'string' ? parsed.version : null,
        count: Number.isInteger(parsed.count) ? parsed.count : 0,
        devices: Array.isArray(parsed.devices) ? parsed.devices.filter((device) => typeof device === 'string') : [],
        diagnostic: null,
      }
    } catch {
      pytorch.diagnostic = 'PyTorch returned an unreadable CUDA response.'
    }
  }
  if (!torch.ok && /No module named ['"]torch['"]/.test(torch.diagnostic || '')) {
    pytorch.diagnostic = 'PyTorch is not installed for the detected Python runtime.'
  }
  return {
    cudaToolkit: {
      available: nvcc.ok,
      version: nvcc.ok ? parseCudaVersion(nvcc.output) : null,
      diagnostic: nvcc.ok ? null : nvcc.diagnostic || 'CUDA toolkit was not found.',
    },
    pytorch,
  }
}

async function cpuSummary() {
  const logicalCores = os.cpus().length
  const cpu = {
    model: os.cpus()[0]?.model || null,
    logicalCores,
    physicalCores: null,
    diagnostic: 'Physical CPU core count is not exposed by this operating system collector.',
  }
  if (process.platform !== 'win32') return cpu

  const result = await command('powershell.exe', [
    '-NoProfile',
    '-Command',
    '(Get-CimInstance Win32_Processor | Measure-Object -Property NumberOfCores -Sum).Sum',
  ])
  const physicalCores = result.ok ? numeric(result.output) : null
  return {
    ...cpu,
    physicalCores,
    diagnostic: physicalCores === null ? 'Windows did not return physical CPU core count.' : null,
  }
}

function parseDf(output) {
  const rows = output.split(/\r?\n/).slice(1).filter(Boolean)
  return rows.map((line) => {
    const parts = line.trim().split(/\s+/)
    const [name, totalKb, usedKb, freeKb] = parts
    return {
      name: parts.slice(5).join(' ') || name,
      totalBytes: Number(totalKb) * 1024,
      usedBytes: Number(usedKb) * 1024,
      freeBytes: Number(freeKb) * 1024,
    }
  }).filter((drive) => Number.isFinite(drive.totalBytes) && drive.totalBytes > 0)
}

async function storageSummary() {
  if (process.platform === 'win32') {
    const result = await command('powershell.exe', [
      '-NoProfile',
      '-Command',
      '[System.IO.DriveInfo]::GetDrives() | Where-Object { $_.IsReady -and $_.DriveType -eq "Fixed" } | Select-Object Name,TotalSize,AvailableFreeSpace | ConvertTo-Json -Compress',
    ])
    if (result.ok) {
      try {
        const drives = ([]).concat(JSON.parse(result.output)).map((drive) => ({
          name: drive.Name,
          totalBytes: Number(drive.TotalSize),
          freeBytes: Number(drive.AvailableFreeSpace),
          usedBytes: Math.max(0, Number(drive.TotalSize) - Number(drive.AvailableFreeSpace)),
        })).filter((drive) => Number.isFinite(drive.totalBytes) && drive.totalBytes > 0)
        return { drives, diagnostic: drives.length ? null : 'Windows did not return a ready fixed drive.' }
      } catch {
        return { drives: [], diagnostic: 'Windows returned unreadable storage information.' }
      }
    }
    return { drives: [], diagnostic: result.diagnostic || 'Windows storage inventory was unavailable.' }
  }

  const result = await command('df', ['-Pk', '/'])
  if (result.ok) {
    const drives = parseDf(result.output)
    return { drives, diagnostic: drives.length ? null : 'System storage information was unavailable.' }
  }
  return { drives: [], diagnostic: result.diagnostic || 'System storage information was unavailable.' }
}

export async function collectHardwareProfile() {
  const [cpu, nvidia, cuda, storage] = await Promise.all([
    cpuSummary(),
    nvidiaTelemetry(),
    cudaAndTorch(),
    storageSummary(),
  ])
  const primary = nvidia.gpus[0] || null
  const now = new Date().toISOString()
  return {
    observedAt: now,
    platform: process.platform,
    architecture: process.arch,
    hostname: os.hostname(),
    cpu,
    memory: { totalBytes: os.totalmem(), freeBytes: os.freemem() },
    storage,
    nvidia,
    cuda,
    primaryGpu: primary,
    verifiedGpuTelemetry: primary ? {
      connected: true,
      verified: true,
      source: NATIVE_NVIDIA_SOURCE,
      model: primary.model,
      vramGb: primary.vramTotalMb === null ? null : primary.vramTotalMb / 1024,
      vramUsedGb: primary.vramUsedMb === null ? null : primary.vramUsedMb / 1024,
      utilizationPct: primary.utilizationPct,
      observedAt: now,
      diagnostic: 'Verified by the Electron main process through nvidia-smi.',
    } : {
      connected: true,
      verified: false,
      source: NATIVE_NVIDIA_SOURCE,
      observedAt: now,
      diagnostic: nvidia.diagnostic,
    },
  }
}
