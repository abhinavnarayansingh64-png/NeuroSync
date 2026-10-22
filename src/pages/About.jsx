/** Signal & Structure style reminder: explain the marketplace as a causal compute lifecycle, not a generic brochure. */

import { MarketingPage } from '../components/MarketingPage'

export default function About() {
  return (
    <MarketingPage
      eyebrow="About"
      title="Route idle compute to training demand"
      subtitle="NeuroSync verifies a dataset, matches it to available GPU capacity, reports progress, and settles completed work."
    >
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.12]" style={{ backgroundImage: 'url(/manus-storage/neurosync-receiver-topology_27f2b63d.jpg)' }} aria-hidden="true" />
        <div className="relative">
          <p className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-accent">Compute lifecycle</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-5">
            {[
              ['01', 'Dataset', 'validated'],
              ['02', 'Model', 'selected'],
              ['03', 'Receiver', 'matched'],
              ['04', 'Training', 'reported'],
              ['05', 'Settlement', 'recorded'],
            ].map(([id, label, state], index) => (
              <div key={id} className="relative border-l border-border pl-3 sm:border-l-0 sm:border-t sm:pt-3 sm:pl-0">
                {index < 4 && <span className="absolute -right-2 top-3 hidden h-px w-4 bg-accent/50 sm:block" aria-hidden="true" />}
                <p className="font-mono-tech text-[10px] text-content-muted">{id}</p>
                <p className="mt-1 text-sm font-medium text-content-primary">{label}</p>
                <p className="mt-0.5 font-mono-tech text-[10px] uppercase tracking-[0.1em] text-status-success">{state}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section>
        <p className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-content-muted">01 / network capacity</p>
        <h2 className="mt-2 text-lg font-semibold tracking-heading text-content-primary">Why it exists</h2>
        <p className="mt-3 text-sm leading-relaxed text-content-secondary">
          Fine-tuning a foundation model usually means either renting cloud GPU time by the hour or owning hardware
          that mostly sits idle. NeuroSync connects the two sides directly: senders get a model trained without
          owning a GPU, and receivers turn spare GPU hours into income.
        </p>
      </section>

      <section>
        <p className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-content-muted">02 / system routing</p>
        <h2 className="mt-2 text-lg font-semibold tracking-heading text-content-primary">How it works</h2>
        <p className="mt-3 text-sm leading-relaxed text-content-secondary">
          A sender uploads a dataset and picks an open foundation model — Llama, Mistral, Gemma, Phi-3, or Qwen.
          NeuroSync routes the job to an available receiver machine, streams progress live, and settles payment in
          two parts: a small base fee up front, and a usage-based amount once training finishes.
        </p>
      </section>

      <section>
        <p className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-content-muted">03 / verifiable foundation</p>
        <h2 className="mt-2 text-lg font-semibold tracking-heading text-content-primary">Open models, open source</h2>
        <p className="mt-3 text-sm leading-relaxed text-content-secondary">
          Every model on the platform is open-weight, so what gets trained and how it's licensed is always
          transparent. LoRA and QLoRA fine-tuning keep jobs lightweight enough to run on consumer-grade GPUs.
        </p>
      </section>
    </MarketingPage>
  )
}
