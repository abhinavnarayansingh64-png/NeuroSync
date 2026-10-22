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

const MIN_ESTIMATED_HOURS = 0.1 // ~6 minutes — smallest sane estimate
const SETUP_HOURS = 0.15 // model download / env setup overhead, every job pays this
const DEFAULT_EPOCHS_BASELINE = 3 // mbPerHour figures are calibrated at this epoch count
const PLATFORM_FEE_RATE = 0.4 // NeuroSync's cut of the total job value

/**
 * @param {object} model - a FOUNDATION_MODELS entry (needs basePriceInr, hourlyRateInr, mbPerHour)
 * @param {object} dataset - { sizeBytes } from the dataset validator
 * @param {number} epochs - planned training epochs (defaults to 3 if not chosen yet)
 */
export function estimateJobCost(model, dataset, epochs = 3) {
  if (!model || !dataset) return null

  const sizeMb = Math.max(0, dataset.sizeBytes || 0) / (1024 * 1024)
  const safeEpochs = Math.max(1, Number(epochs) || DEFAULT_EPOCHS_BASELINE)
  const throughput = model.mbPerHour || 4

  const trainingHours = (sizeMb / throughput) * (safeEpochs / DEFAULT_EPOCHS_BASELINE)
  const estimatedHours = Math.max(MIN_ESTIMATED_HOURS, Math.round((SETUP_HOURS + trainingHours) * 10) / 10)

  const estimatedTotalInr = Math.round(model.basePriceInr + estimatedHours * model.hourlyRateInr)
  const finalPaymentInr = Math.max(0, estimatedTotalInr - model.basePriceInr)
  const platformFeeInr = Math.round(estimatedTotalInr * PLATFORM_FEE_RATE)
  const providerPayoutInr = estimatedTotalInr - platformFeeInr

  return {
    basePriceInr: model.basePriceInr,
    hourlyRateInr: model.hourlyRateInr,
    estimatedHours,
    estimatedTotalInr,
    finalPaymentInr,
    platformFeeInr,
    providerPayoutInr,
  }
}

/** Format an integer amount of rupees, e.g. 1234 -> "₹1,234". */
export function formatInr(amount) {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—'
  return `₹${Math.round(amount).toLocaleString('en-IN')}`
}
