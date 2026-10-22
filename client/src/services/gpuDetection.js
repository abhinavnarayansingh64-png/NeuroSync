const SOFTWARE_RENDERER_PATTERNS = [
  /microsoft basic render driver/i,
  /swiftshader/i,
  /llvmpipe/i,
  /mesa software/i,
  /software renderer/i,
  /warp/i,
  /angle \(.*(swiftshader|software|warp)/i,
]

const WEBGPU_LIMIT_NAMES = [
  'maxBufferSize',
  'maxStorageBufferBindingSize',
  'maxComputeWorkgroupSizeX',
  'maxComputeInvocationsPerWorkgroup',
  'maxTextureDimension2D',
]

function stringOrNull(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function isSoftwareRenderer(value) {
  const text = String(value || '').trim()
  return Boolean(text) && SOFTWARE_RENDERER_PATTERNS.some((pattern) => pattern.test(text))
}

function isSpecificPhysicalModel(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized || isSoftwareRenderer(value)) return false
  return ![
    'unknown', 'gpu', 'webgpu', 'angle', 'apple gpu', 'adapter', 'default adapter',
  ].some((generic) => normalized === generic || normalized.startsWith(`${generic} `))
}

function inferVendor(...values) {
  const text = values.filter(Boolean).join(' ').toLowerCase()
  if (text.includes('nvidia') || text.includes('0x10de')) return 'NVIDIA'
  if (text.includes('amd') || text.includes('radeon') || text.includes('ati ') || text.includes('0x1002')) return 'AMD'
  if (text.includes('intel') || text.includes('0x8086')) return 'Intel'
  if (text.includes('apple')) return 'Apple'
  if (text.includes('qualcomm') || text.includes('adreno')) return 'Qualcomm'
  if (text.includes('arm') || text.includes('mali')) return 'ARM'
  return null
}

function browserCapabilities({ webgpuAvailable, webglAvailable, source = 'none', detected = false, ...details } = {}) {
  return {
    detected,
    verified: false,
    source,
    vendor: null,
    model: null,
    architecture: null,
    device: null,
    description: null,
    vramGb: null,
    softwareRenderer: false,
    webgpuAvailable: Boolean(webgpuAvailable),
    webglAvailable: Boolean(webglAvailable),
    gpuAcceleration: Boolean(webgpuAvailable || webglAvailable),
    exactModelAvailable: false,
    features: [],
    limits: {},
    webgpuDiagnostic: {
      preference: 'high-performance',
      adapterAvailable: false,
      adapterInfoAvailable: false,
      isFallbackAdapter: null,
      identityExposed: false,
      softwareRenderer: false,
      rawInfo: null,
    },
    ...details,
  }
}

function safeAdapterInfo(adapter) {
  const info = adapter?.info
  if (!info || typeof info !== 'object') return null
  return {
    vendor: stringOrNull(info.vendor),
    architecture: stringOrNull(info.architecture),
    device: stringOrNull(info.device),
    description: stringOrNull(info.description),
  }
}

function pickLimits(adapter) {
  return Object.fromEntries(WEBGPU_LIMIT_NAMES
    .filter((name) => Number.isFinite(Number(adapter?.limits?.[name])))
    .map((name) => [name, Number(adapter.limits[name])]))
}

async function inspectWebGpu() {
  const webgpuAvailable = typeof navigator !== 'undefined' && Boolean(navigator.gpu)
  if (!webgpuAvailable) return browserCapabilities({ webgpuAvailable: false })

  const preference = 'high-performance'
  try {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: preference })
    if (!adapter) {
      return browserCapabilities({
        source: 'webgpu', webgpuAvailable: true, detected: false,
        diagnostic: 'WebGPU is available, but Chrome did not provide a high-performance adapter.',
        webgpuDiagnostic: { preference, adapterAvailable: false, adapterInfoAvailable: false, isFallbackAdapter: null, identityExposed: false, softwareRenderer: false, rawInfo: null },
      })
    }

    const rawInfo = safeAdapterInfo(adapter)
    const isFallbackAdapter = typeof adapter.isFallbackAdapter === 'boolean' ? adapter.isFallbackAdapter : null
    const rawIdentity = rawInfo?.description || rawInfo?.device || null
    const softwareRenderer = Boolean(isFallbackAdapter) || isSoftwareRenderer(rawIdentity)
    const exactModelAvailable = !softwareRenderer && isSpecificPhysicalModel(rawInfo?.description)
    const fallbackDiagnostic = isFallbackAdapter === true
      ? 'WebGPU returned a fallback adapter, not a physical GPU identity.'
      : softwareRenderer
        ? 'WebGPU exposed a software/fallback adapter, not the physical GPU.'
        : null

    return browserCapabilities({
      detected: true,
      source: 'webgpu',
      webgpuAvailable: true,
      vendor: rawInfo?.vendor || inferVendor(rawInfo?.description, rawInfo?.device, rawInfo?.architecture),
      model: exactModelAvailable ? rawInfo.description : null,
      architecture: rawInfo?.architecture || null,
      device: rawInfo?.device || null,
      description: softwareRenderer ? null : rawInfo?.description || null,
      softwareRenderer,
      exactModelAvailable,
      features: Array.from(adapter.features || []),
      limits: pickLimits(adapter),
      diagnostic: fallbackDiagnostic || (exactModelAvailable ? null : 'WebGPU is available, but Chrome did not expose an exact physical GPU model.'),
      webgpuDiagnostic: {
        preference,
        adapterAvailable: true,
        adapterInfoAvailable: Boolean(rawInfo),
        isFallbackAdapter,
        identityExposed: Boolean(rawIdentity),
        softwareRenderer,
        rawInfo,
      },
    })
  } catch (error) {
    return browserCapabilities({
      source: 'webgpu', webgpuAvailable: true, detected: false,
      diagnostic: `WebGPU is present but high-performance adapter access failed (${error?.name || 'request failed'}).`,
      webgpuDiagnostic: { preference, adapterAvailable: false, adapterInfoAvailable: false, isFallbackAdapter: null, identityExposed: false, softwareRenderer: false, rawInfo: null },
    })
  }
}

function inspectWebGl() {
  if (typeof document === 'undefined') return browserCapabilities({ source: 'none' })
  try {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (!context) return browserCapabilities({ source: 'none', webglAvailable: false })
    const debug = context.getExtension('WEBGL_debug_renderer_info')
    const vendor = debug ? stringOrNull(context.getParameter(debug.UNMASKED_VENDOR_WEBGL)) : null
    const renderer = debug ? stringOrNull(context.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : null
    const softwareRenderer = isSoftwareRenderer(renderer)
    return browserCapabilities({
      detected: true,
      source: 'webgl',
      webglAvailable: true,
      vendor: vendor || inferVendor(renderer),
      model: !softwareRenderer && isSpecificPhysicalModel(renderer) ? renderer : null,
      description: softwareRenderer ? null : renderer,
      softwareRenderer,
      exactModelAvailable: !softwareRenderer && isSpecificPhysicalModel(renderer),
      diagnostic: softwareRenderer
        ? 'WebGL exposed a software/fallback renderer, not the physical GPU.'
        : renderer ? null : 'WebGL is available, but renderer identity is restricted by this browser.',
      webglDiagnostic: { rendererAvailable: Boolean(renderer), softwareRenderer },
    })
  } catch (error) {
    return browserCapabilities({
      source: 'none', webglAvailable: false,
      diagnostic: `WebGL inspection was unavailable (${error?.name || 'request failed'}).`,
    })
  }
}

/**
 * Detect only browser-exposed GPU information. WebGPU is authoritative when
 * present; WebGL is used only when WebGPU is unavailable. This never infers
 * host VRAM, utilisation, CUDA capabilities, or a physical model that the
 * browser withholds.
 */
export async function detectBrowserGpu() {
  const webgpu = await inspectWebGpu()
  if (webgpu.webgpuAvailable) return webgpu
  const webgl = inspectWebGl()
  if (!webgl.detected && !webgl.webglAvailable) {
    return browserCapabilities({
      source: 'none', detected: false,
      diagnostic: 'This browser did not expose WebGPU or WebGL hardware information.',
    })
  }
  return webgl
}

export function browserGpuDisplayName(gpu) {
  if (gpu?.exactModelAvailable && gpu?.model) return gpu.model
  if (gpu?.softwareRenderer) return 'Physical GPU not exposed'
  if (gpu?.detected) return 'Browser GPU capabilities detected'
  return 'GPU capabilities unavailable'
}
