/**
 * Foundation model catalog.
 * This static catalog powers the model selection step and provides the
 * extended metadata shown when a model is selected. In a production build
 * this would be served by the backend; the shape is intentionally
 * API-friendly so it can be swapped for a fetch() with no UI changes.
 */

// Pricing scales with model size: smaller/faster models are cheaper and
// process more MB of dataset per hour; larger 7B-class models cost more up
// front and bill more per hour of compute. `basePriceInr` is paid before a
// job is dispatched; `hourlyRateInr` is the per-hour rate used to project
// the final, usage-based payment (see services/pricing.js). `mbPerHour` is
// throughput at the default 3-epoch baseline — e.g. a 10 MB dataset on a
// 7B model lands around 2.5-3 hours, which is what an equivalent real
// LoRA fine-tune typically takes on a single consumer GPU.
export const FOUNDATION_MODELS = [
  {
    id: 'llama-3.2',
    name: 'Llama 3.2',
    developer: 'Meta',
    parameters: '3B',
    size: '6.4 GB',
    description: 'Efficient multilingual model well suited for instruction tuning and assistants.',
    architecture: 'Decoder-only Transformer',
    contextLength: '128K tokens',
    license: 'Llama 3.2 Community License',
    recommendedVram: '12 GB',
    useCases: ['Chat assistants', 'Summarization', 'Multilingual tasks'],
    basePriceInr: 129,
    hourlyRateInr: 39,
    mbPerHour: 5.5,
  },
  {
    id: 'mistral-7b',
    name: 'Mistral 7B',
    developer: 'Mistral AI',
    parameters: '7B',
    size: '14.5 GB',
    description: 'High-performance dense model with strong reasoning for its size.',
    architecture: 'Decoder-only Transformer (GQA + SWA)',
    contextLength: '32K tokens',
    license: 'Apache 2.0',
    recommendedVram: '16 GB',
    useCases: ['Reasoning', 'Code assistance', 'General instruction following'],
    basePriceInr: 229,
    hourlyRateInr: 65,
    mbPerHour: 3.8,
  },
  {
    id: 'gemma-2b',
    name: 'Gemma 2B',
    developer: 'Google',
    parameters: '2B',
    size: '4.9 GB',
    description: 'Lightweight open model designed for fast, low-resource fine-tuning.',
    architecture: 'Decoder-only Transformer',
    contextLength: '8K tokens',
    license: 'Gemma Terms of Use',
    recommendedVram: '8 GB',
    useCases: ['Edge deployment', 'Classification', 'Lightweight assistants'],
    basePriceInr: 99,
    hourlyRateInr: 35,
    mbPerHour: 6.5,
  },
  {
    id: 'gemma-7b',
    name: 'Gemma 7B',
    developer: 'Google',
    parameters: '7B',
    size: '15.6 GB',
    description: 'Capable mid-size open model balancing quality and hardware requirements.',
    architecture: 'Decoder-only Transformer',
    contextLength: '8K tokens',
    license: 'Gemma Terms of Use',
    recommendedVram: '18 GB',
    useCases: ['Instruction tuning', 'Content generation', 'Q&A'],
    basePriceInr: 229,
    hourlyRateInr: 65,
    mbPerHour: 3.8,
  },
  {
    id: 'phi-3-mini',
    name: 'Phi-3 Mini',
    developer: 'Microsoft',
    parameters: '3.8B',
    size: '7.6 GB',
    description: 'Compact model with strong reasoning trained on high-quality curated data.',
    architecture: 'Decoder-only Transformer',
    contextLength: '128K tokens',
    license: 'MIT',
    recommendedVram: '10 GB',
    useCases: ['Reasoning', 'Math', 'Compact deployments'],
    basePriceInr: 139,
    hourlyRateInr: 42,
    mbPerHour: 5.0,
  },
  {
    id: 'qwen-2.5',
    name: 'Qwen 2.5',
    developer: 'Alibaba',
    parameters: '7B',
    size: '15.1 GB',
    description: 'Versatile multilingual model with excellent coding and math capabilities.',
    architecture: 'Decoder-only Transformer',
    contextLength: '128K tokens',
    license: 'Apache 2.0',
    recommendedVram: '16 GB',
    useCases: ['Coding', 'Math', 'Multilingual generation'],
    basePriceInr: 229,
    hourlyRateInr: 65,
    mbPerHour: 3.8,
  },
]

/** Look up a model by id. Returns null when not found. */
export function getModelById(id) {
  return FOUNDATION_MODELS.find((model) => model.id === id) || null
}

/** Training methods supported by the engine (PRD Section 4). */
export const TRAINING_METHODS = [
  {
    id: 'lora',
    name: 'LoRA',
    description: 'Low-Rank Adaptation — fast, memory-efficient fine-tuning of adapter weights.',
  },
  {
    id: 'qlora',
    name: 'QLoRA',
    description: '4-bit quantized LoRA — lowest VRAM footprint for large models.',
  },
]
