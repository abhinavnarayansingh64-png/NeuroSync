/**
 * Landing page — "Signal & Structure" redesign.
 *
 * Signal & Structure style reminder: a black operational field with restrained
 * cream signal accents, generous technical negative space, and semantic motion.
 * Hero beats (PDR §7.1): label + headline settle first, support copy + CTAs
 * become available immediately after (never gated behind motion — CTAs are
 * in the initial keyboard order), and the system diagram starts a
 * low-frequency signal flow. The strands remain the sole hero visual so the
 * entry point stays focused and uncluttered.
 *
 * Preserved behavior: / route semantics, authenticated redirect, CTA
 * destinations (Get Started → /login, Learn More → #features), feature
 * strip content, footer, and semantic headings.
 */

import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { trpc } from '../lib/trpc'
import { workspaceRouteForRole } from '../utils/workspaceRoute'
import { LandingNavbar } from '../components/LandingNavbar'
import { Footer } from '../components/Footer'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { NetworkVisual } from '../components/NetworkVisual'
import { CursorGlow } from '../components/CursorGlow'
import { Reveal, RevealGroup } from '../components/motion/Reveal'
import { WorkflowDiagram } from '../components/WorkflowDiagram'
import { Strands } from '../components/Strands'
import { EdgeGlowCard } from '../components/EdgeGlowCard'
import { ScrollExpand } from '../components/ScrollExpand'

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

function HeroStrandBridge() {
  return (
    <div
      className="pointer-events-none absolute inset-y-0 right-0 hidden overflow-hidden lg:block"
      style={{ width: 'min(59vw, 47rem)' }}
      aria-hidden="true"
    >
      <div
        className="absolute inset-0 opacity-90"
        style={{
          WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.92) 11%, #000 20%, #000 80%, rgba(0,0,0,0.92) 89%, transparent 100%)',
          maskImage: 'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.92) 11%, #000 20%, #000 80%, rgba(0,0,0,0.92) 89%, transparent 100%)',
        }}
      >
        <Strands
          colors={['#f7f0e5', '#d7c8b6', '#ffffff']}
          count={4}
          speed={0.28}
          amplitude={0.82}
          waviness={0.9}
          thickness={0.42}
          glow={1.35}
          taper={2.4}
          spread={0.78}
          intensity={0.54}
          saturation={0}
          opacity={0.68}
          scale={1.25}
        />
      </div>
      <div className="absolute top-1/2 -translate-y-1/2 font-mono text-[9px] uppercase tracking-[0.14em]" style={{ left: '5%' }}>
        <div className="relative flex flex-col items-center gap-1.5 text-center">
          <span className="font-semibold text-[#f7f0e5]">PC</span>
          <div className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-[#e3b26c]/55 bg-[#090909]/80 p-2 text-[#f7f0e5] shadow-[0_0_24px_rgba(227,178,108,0.14)]">
            <svg className="h-full w-full" viewBox="0 0 44 44" fill="none"><rect x="6" y="7" width="32" height="22" rx="3" stroke="currentColor" strokeWidth="1.6" /><path d="M17 36H27M22 29V36M11 36H33" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><circle cx="11" cy="12" r="1.4" fill="currentColor" /></svg>
            <span className="absolute -right-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 border-[#090909] bg-[#e3b26c] shadow-[0_0_10px_rgba(227,178,108,0.95)]" />
          </div>
          <span className="text-[#e3b26c]">Job source</span>
        </div>
      </div>
      <div className="absolute top-1/2 -translate-y-1/2 font-mono text-[9px] uppercase tracking-[0.14em]" style={{ right: '5%' }}>
        <div className="relative flex flex-col items-center gap-1.5 text-center">
          <span className="font-semibold text-[#f7f0e5]">GPU</span>
          <div className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-[#8cc8d4]/55 bg-[#090909]/80 p-2 text-[#f7f0e5] shadow-[0_0_24px_rgba(140,200,212,0.14)]">
            <svg className="h-full w-full" viewBox="0 0 44 44" fill="none"><rect x="5" y="11" width="34" height="22" rx="3" stroke="currentColor" strokeWidth="1.6" /><rect x="11" y="16" width="13" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4" /><path d="M29 17H34M29 22H34M29 27H34M9 8V11M16 8V11M23 8V11M30 8V11M9 33V36M16 33V36M23 33V36M30 33V36" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
            <span className="absolute -left-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 border-[#090909] bg-[#8cc8d4] shadow-[0_0_10px_rgba(140,200,212,0.95)]" />
          </div>
          <span className="text-[#8cc8d4]">Receiver</span>
        </div>
      </div>
    </div>
  )
}

export default function Landing() {
  const { isAuthenticated } = useAuth()
  const profileQuery = trpc.workspace.profile.useQuery(undefined, { enabled: isAuthenticated, retry: false, staleTime: 30_000 })
  if (isAuthenticated && profileQuery.isLoading) return null
  if (isAuthenticated) return <Navigate to={workspaceRouteForRole(profileQuery.data?.workspaceRole)} replace />

  return (
    <div className="flex min-h-screen flex-col bg-base">
      <CursorGlow />
      <LandingNavbar />

      <main className="flex-1">
        {/* — Hero: label/headline settle first, CTAs immediately available — */}
        <section
          className="relative overflow-hidden bg-[#090909]"
          style={{ background: 'radial-gradient(circle at 82% 24%, rgba(255,255,255,0.07), transparent 25rem), radial-gradient(circle at 12% 100%, rgba(247,240,229,0.055), transparent 26rem), #090909' }}
        >
          <HeroStrandBridge />
          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(9,9,9,0.98)_0%,rgba(9,9,9,0.94)_44%,rgba(9,9,9,0.62)_68%,rgba(9,9,9,0.24)_100%)]"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-96 opacity-70"
            style={{
              background: 'radial-gradient(55% 55% at 50% 0%, rgba(255,255,255,0.08) 0%, rgba(9,9,9,0) 70%)',
            }}
            aria-hidden="true"
          />
          <div className="relative mx-auto flex min-h-[36rem] max-w-6xl items-center px-4 pb-20 pt-20 sm:px-6 sm:pt-28 lg:text-left">
            <div className="text-center lg:text-left">
              <span
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-[#f4eee4]"
                style={{ animation: 'ns-settle 0.3s cubic-bezier(0.23,1,0.32,1) both' }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                Open Source AI Fine-Tuning Platform
              </span>

              <h1
                className="mx-auto mt-8 max-w-xl text-4xl font-medium leading-[1.12] tracking-display text-white sm:text-6xl lg:mx-0"
                style={{ animation: 'ns-settle 0.35s cubic-bezier(0.23,1,0.32,1) 0.06s both' }}
              >
                Fine-tune your way <span className="text-[#e8ddcd]">Through the Network</span>
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
                  <Button size="lg" iconRight="chevronRight" fullWidth className="border-[#f7f0e5] bg-[#f7f0e5] text-[#1c1a17] hover:bg-white">
                    Enter workspace
                  </Button>
                </Link>
                <a href="#features" className="w-full sm:w-auto">
                  <Button size="lg" variant="secondary" fullWidth className="border-white/35 text-white hover:border-white hover:bg-white/10">
                    Learn More
                  </Button>
                </a>
              </div>
            </div>

          </div>
        </section>

        {/* — Connected-compute band: the network dispatch diagram — */}
        <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
          <ScrollExpand>
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
                    A job leaves the sender workstation, is assigned by the scheduler, and lands on a verified GPU
                    receiver. The returned checkpoint follows the same route back to the source machine.
                  </p>
                  <ul className="space-y-2 pt-2 text-sm text-content-secondary">
                    <li className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                      Sender → scheduler → GPU receiver, with execution state visible at each handoff.
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                      Receiver capacity, job state, and checkpoint return all remain explicit—not abstract nodes.
                    </li>
                  </ul>
                </div>
                <NetworkVisual className="h-64 w-full" />
              </div>
            </Reveal>
          </ScrollExpand>
        </section>

        {/* — Feature strip (content preserved) — */}
        <section id="features" className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-3">
            {FEATURES.map((feature) => (
              <Reveal key={feature.title} as="div" className="h-full">
                <EdgeGlowCard label={feature.title} className="tactile-card relative rounded-2xl border border-border bg-card p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
                    <Icon name={feature.icon} size={22} />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-content-primary">{feature.title}</h3>
                  <p className="mt-2 text-sm text-content-secondary">{feature.description}</p>
                </EdgeGlowCard>
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
                    <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.1em] text-content-secondary">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" /> Connected
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

    </div>
  )
}
