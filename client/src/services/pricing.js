/**
 * pricing.js — job cost & time estimation.
 *
 * Base price is paid before a job is dispatched to a receiver. The final,
 * usage-based payment (billed after training completes, before the trained
 * model can be downloaded) is projected from the model's MB/hour throughput
 * and the dataset's actual file size. A ~10 MB dataset on a typical 7B
 * model lands around 2.5-3 hours — comparable to a real single-GPU LoRA
 * fine-tune — while a few-KB test file stays well under an hour instead of
 * flooring out at the same value as a much larger dataset.
 */

const MIN_ESTIMATED_HOURS = 0.2 // 12 minutes — calibrated lower bound for an interactive fine-tune estimate
const SETUP_HOURS = 0.15 // model download / env setup overhead, every job pays this
const DEFAULT_EPOCHS_BASELINE = 3 // mbPerHour figures are calibrated at this epoch count
const PLATFORM_FEE_RATE = 0.4 // NeuroSync's cut of the total job value
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || min))

/**
 * @param {object} model - a FOUNDATION_MODELS entry (needs basePriceInr, hourlyRateInr, mbPerHour)
 * @param {object} dataset - { sizeBytes } from the dataset validator
 * @param {number} epochs - planned training epochs (defaults to 3 if not chosen yet)
 */
export function estimateJobCost(model, dataset, epochs = 3, options = {}) {
  if (!model || !dataset) return null

  const sizeMb = Math.max(0, dataset.sizeBytes || 0) / (1024 * 1024)
  const records = Math.max(1, Number(dataset.records) || 1)
  const safeEpochs = Math.max(1, Number(epochs) || DEFAULT_EPOCHS_BASELINE)
  const throughput = model.mbPerHour || 4
  const receiverGpu = String(options.receiver?.gpu || '')
  const receiverCount = Math.max(1, Number(options.receiverCount || 1))
  const isDistributed = options.trainingMode === 'distributed' && receiverCount > 1
  const gemma4090Reference = model.id === 'gemma-2b' && /RTX 4090/i.test(receiverGpu) && Number(options.receiver?.vramGb || 0) >= 24

  // File bytes drive transfer/IO cost while record count captures tokenization
  // and optimizer overhead. This makes a 10 MB and 50 MB dataset distinct even
  // when their average record shape is similar.
  const recordEquivalentMb = records * 0.00005
  const effectiveDatasetMb = Math.max(0.25, sizeMb + recordEquivalentMb)
  const trainingHours = (effectiveDatasetMb / throughput) * (safeEpochs / DEFAULT_EPOCHS_BASELINE)
  const coordinatedHours = isDistributed ? trainingHours / Math.max(1, receiverCount * 0.8) : trainingHours
  const referenceScale = Math.pow(Math.max(0.25, effectiveDatasetMb) / 10, 0.62)
  const estimatedHours = gemma4090Reference
    ? Math.max(0.2, Math.round((0.2 * referenceScale + Math.max(0, safeEpochs - 3) * 0.025) * 10) / 10)
    : Math.max(MIN_ESTIMATED_HOURS, Math.round((SETUP_HOURS + coordinatedHours) * 10) / 10)

  const basePriceInr = clamp(model.basePriceInr, 100, 300)
  const hourlyRateInr = clamp(model.hourlyRateInr, 30, 60)
  const workerCost = estimatedHours * hourlyRateInr * receiverCount
  const estimatedTotalInr = Math.round(basePriceInr + workerCost)
  const finalPaymentInr = Math.max(0, estimatedTotalInr - basePriceInr)
  const platformFeeInr = Math.round(estimatedTotalInr * PLATFORM_FEE_RATE)
  const providerPayoutInr = estimatedTotalInr - platformFeeInr

  return {
    basePriceInr,
    hourlyRateInr,
    estimatedHours,
    estimatedTotalInr,
    finalPaymentInr,
    platformFeeInr,
    providerPayoutInr,
    receiverCount,
    referenceTime: gemma4090Reference ? `${Math.round(estimatedHours * 60)} min estimate · 10–15 min on RTX 4090 · 24 GB reference dataset` : null,
  }
}

/** Format an integer amount of rupees, e.g. 1234 -> "₹1,234". */
export function formatInr(amount) {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—'
  return `₹${Math.round(amount).toLocaleString('en-IN')}`
}
