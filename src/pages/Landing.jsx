/**
 * Landing page — "Signal & Structure" redesign.
 *
 * Signal & Structure style reminder: warm near-black operational foundation,
 * cyan signal accents, generous technical negative space, and semantic motion.
 * Hero beats (PDR §7.1): label + headline settle first, support copy + CTAs
 * become available immediately after (never gated behind motion — CTAs are
 * in the initial keyboard order), and the system diagram starts a
 * low-frequency signal flow. The chip story is preserved but gated by
 * visibility and reduced motion.
 *
 * Preserved behavior: / route semantics, authenticated redirect, CTA
 * destinations (Get Started → /login, Learn More → #features), feature
 * strip content, footer, testimonials, semantic headings.
 */

import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LandingNavbar } from '../components/LandingNavbar'
import { Footer } from '../components/Footer'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { ChipAnimation } from '../components/ChipAnimation'
import { NetworkVisual } from '../components/NetworkVisual'
import { Testimonials } from '../components/Testimonials'
import { CursorGlow } from '../components/CursorGlow'
import { Reveal, RevealGroup } from '../components/motion/Reveal'
import { WorkflowDiagram } from '../components/WorkflowDiagram'

const FEATURES = [
  {
    icon: 'chip',
    title: 'Bring your own GPU',
    description: 'Route training jobs to connected receiver machines and fine-tune without owning a dedicated GPU.',
  },
  {
    icon: 'layers',
    title: 'Open foundation models',
    description: 'Fine-tune Llama, Mistral, Gemma, Phi-3 and Qwen with LoRA and QLoRA out of the box.',
  },
  {
    icon: 'activity',
    title: 'Live monitoring',
    description: 'Watch loss curves, GPU utilisation and streaming logs update in real time as training runs.',
  },
]

/** Problem → solution pairs for the comparison narrative (§7.2). */
const TRANSFORMS = [
  {
    problem: 'Expensive GPU infrastructure sitting idle most of the time.',
    solution: 'Idle machines register as receivers and become connected, billable capacity.',
  },
  {
    problem: 'Centralized scheduling bottlenecks queue every job in one place.',
    solution: 'Jobs distribute across registered receivers, each with live hardware status.',
  },
  {
    problem: 'Interrupted training starts over from the beginning.',
    solution: 'Checkpoint migration resumes from the last saved state when a connection drops.',
  },
]

export default function Landing() {
  const { isAuthenticated } = useAuth()
  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  return (
    <div className="flex min-h-screen flex-col bg-base">
      <CursorGlow />
      <LandingNavbar />

      <main className="flex-1">
        {/* — Hero: label/headline settle first, CTAs immediately available — */}
        <section className="relative overflow-hidden texture-ruled">
          <div
            className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.26]"
            style={{
              backgroundImage:
                'linear-gradient(90deg, rgba(12,10,9,0.96) 0%, rgba(12,10,9,0.88) 44%, rgba(12,10,9,0.56) 100%), url(/manus-storage/neurosync-hero-signal_f17e9510.jpg)',
            }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-96 opacity-70"
            style={{
              background: 'radial-gradient(55% 55% at 50% 0%, rgba(59,166,241,0.12) 0%, rgba(12,10,9,0) 70%)',
            }}
            aria-hidden="true"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-20 pt-20 sm:px-6 sm:pt-28 lg:grid-cols-2 lg:text-left">
            <div className="text-center lg:text-left">
              <span
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-content-secondary"
                style={{ animation: 'ns-settle 0.3s cubic-bezier(0.23,1,0.32,1) both' }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                Open Source AI Fine-Tuning Platform
              </span>

              <h1
                className="mx-auto mt-8 max-w-xl text-4xl font-medium leading-[1.12] tracking-display text-content-primary sm:text-6xl lg:mx-0"
                style={{ animation: 'ns-settle 0.35s cubic-bezier(0.23,1,0.32,1) 0.06s both' }}
              >
                Fine-tune your way <span className="highlight-span">Through the Network</span>
              </h1>
              <p
                className="mx-auto mt-6 max-w-md text-base leading-relaxed text-content-secondary sm:text-lg lg:mx-0"
                style={{ animation: 'ns-settle 0.35s cubic-bezier(0.23,1,0.32,1) 0.12s both' }}
              >
                Send a training job, pick a model, get it fine-tuned on someone else's idle GPU — or bring in your
                own computer to make some extra out of it.
              </p>

              {/* CTAs present in the initial keyboard order — never gated. */}
              <div
                className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start"
                style={{ animation: 'ns-settle 0.35s cubic-bezier(0.23,1,0.32,1) 0.18s both' }}
              >
                <Link to="/login" className="w-full sm:w-auto">
                  <Button size="lg" iconRight="chevronRight" fullWidth>
                    Enter workspace
                  </Button>
                </Link>
                <a href="#features" className="w-full sm:w-auto">
                  <Button size="lg" variant="secondary" fullWidth>
                    Learn More
                  </Button>
                </a>
              </div>
            </div>

            <div style={{ animation: 'ns-rise 0.7s cubic-bezier(0.23,1,0.32,1) 0.24s both' }}>
              <ChipAnimation className="h-64 sm:h-80" />
            </div>
          </div>
        </section>

        {/* — Connected-compute band: the network dispatch diagram — */}
        <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
          <Reveal className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div
              className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.12]"
              style={{ backgroundImage: 'url(/manus-storage/neurosync-workflow-architecture_b298c71e.jpg)' }}
              aria-hidden="true"
            />
            <div className="relative grid items-center gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-3">
                <p className="font-mono-tech text-[11px] uppercase tracking-[0.14em] text-content-muted">
                  Connected compute
                </p>
                <h2 className="text-2xl font-medium tracking-display text-content-primary sm:text-3xl">
                  One job, <span className="highlight-span">many idle GPUs</span>
                </h2>
                <p className="max-w-md text-sm leading-relaxed text-content-secondary">
                  A training job enters the scheduler, which routes it to an available receiver. Signals travel
                  sparsely — one primary route, occasional secondaries — until the model comes back fine-tuned.
                </p>
                <ul className="space-y-2 pt-2 text-sm text-content-secondary">
                  <li className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                    Dispatch, smart scheduling, and checkpoint migration built into the route.
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-status-success" aria-hidden="true" />
                    Receivers report live hardware status before a job ever starts.
                  </li>
                </ul>
              </div>
              <NetworkVisual className="h-64 w-full" />
            </div>
          </Reveal>
        </section>

        {/* — Feature strip (content preserved) — */}
        <section id="features" className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-3">
            {FEATURES.map((feature) => (
              <Reveal key={feature.title} as="div" className="rounded-2xl border border-border bg-card p-6 transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:bg-card-hover">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <Icon name={feature.icon} size={22} />
                </div>
                <h3 className="mt-4 text-base font-semibold text-content-primary">{feature.title}</h3>
                <p className="mt-2 text-sm text-content-secondary">{feature.description}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* — Problem → solution narrative (§7.2) — */}
        <section className="border-t border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
            <Reveal>
              <p className="font-mono-tech text-[11px] uppercase tracking-[0.14em] text-content-muted">Why NeuroSync</p>
              <h2 className="mt-3 max-w-xl text-2xl font-medium tracking-display text-content-primary sm:text-3xl">
                Idle GPUs, on one side of the network. <span className="highlight-span">Demand on the other.</span>
              </h2>
            </Reveal>
            <div className="mt-12 space-y-px overflow-hidden rounded-2xl border border-border bg-border">
              {TRANSFORMS.map((t, i) => (
                <Reveal key={t.problem} as="div" className="grid bg-card sm:grid-cols-2">
                  <div className="border-b border-border p-6 sm:border-b-0 sm:border-r">
                    <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.1em] text-content-muted">
                      <Icon name="circle" size={8} /> Idle today
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-content-secondary">{t.problem}</p>
                  </div>
                  <div className="relative p-6">
                    <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.1em] text-status-success">
                      <span className="h-1.5 w-1.5 rounded-full bg-status-success" aria-hidden="true" /> Connected
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-content-primary">{t.solution}</p>
                    {/* causal arrow between the two halves */}
                    <span
                      className="absolute -left-3 top-1/2 hidden -translate-y-1/2 text-content-muted sm:block"
                      aria-hidden="true"
                    >
                      <Icon name="chevronRight" size={16} />
                    </span>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* — Causal workflow diagram (§7.3) — */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <RevealGroup stagger={60}>
            <p className="font-mono-tech text-[11px] uppercase tracking-[0.14em] text-content-muted">The workflow</p>
            <h2 className="mt-3 text-2xl font-medium tracking-display text-content-primary sm:text-3xl">
              From model selection to a <span className="highlight-span">fine-tuned result</span>
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-content-secondary">
              One causal path with real branches: the scheduler decides between single-GPU training, distributed
              fine-tuning, or checkpoint migration when a connection drops.
            </p>
          </RevealGroup>
          <Reveal className="mt-10">
            <WorkflowDiagram />
          </Reveal>
        </section>
      </main>

      <Footer />

      <div className="fixed bottom-5 right-5 z-40 hidden sm:block">
        <Testimonials />
      </div>
    </div>
  )
}
