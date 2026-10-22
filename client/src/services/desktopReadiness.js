function numericGb(value) {
  const parsed = Number.parseFloat(String(value || '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

export function evaluateDesktopReadiness(profile, models) {
  const gpu = profile?.verifiedGpuTelemetry
  const verifiedVramGb = gpu?.verified === true && Number.isFinite(Number(gpu.vramGb))
    ? Number(gpu.vramGb)
    : null
  return (Array.isArray(models) ? models : []).map((model) => {
    const metadata = model?.metadata && typeof model.metadata === 'object' ? model.metadata : {}
    const recommendedVramGb = numericGb(metadata.recommendedVram)
    let status = 'Unknown'
    let explanation = 'The shared catalog does not provide a numeric VRAM recommendation for this model.'
    if (recommendedVramGb !== null && verifiedVramGb === null) {
      explanation = 'A verified native NVIDIA VRAM value is unavailable on this desktop.'
    } else if (recommendedVramGb !== null && verifiedVramGb < recommendedVramGb) {
      status = 'Not Suitable'
      explanation = `Verified VRAM is below the catalog recommendation of ${recommendedVramGb} GB.`
    } else if (recommendedVramGb !== null) {
      status = 'Ready'
      explanation = `Verified VRAM meets the catalog recommendation of ${recommendedVramGb} GB.`
    }
    return {
      id: model.id,
      name: model.name,
      recommendedVramGb,
      storageSize: metadata.storageSize || null,
      referenceHardware: metadata.referenceHardware || null,
      referenceFineTuneTime: metadata.referenceFineTuneTime || null,
      status,
      explanation,
    }
  })
}

export function readinessTone(status) {
  if (status === 'Ready') return 'success'
  if (status === 'Not Suitable') return 'danger'
  if (status === 'Partially Ready') return 'warning'
  return 'neutral'
}
