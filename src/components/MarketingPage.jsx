/** Signal & Structure style reminder: public information pages retain the technical network frame and telemetry hierarchy. */
import { LandingNavbar } from './LandingNavbar'
import { Footer } from './Footer'
import { RevealGroup } from './motion/Reveal'

export function MarketingPage({ eyebrow, title, subtitle, children }) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-base texture-ruled">
      <LandingNavbar />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_16%,rgba(67,178,244,0.08),transparent_24%)]" aria-hidden="true" />
      <main className="relative flex-1">
        <div className="animate-ns-settle mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
          {eyebrow && (
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-content-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              {eyebrow}
            </span>
          )}
          <div className="mt-6 flex items-center gap-3 font-mono-tech text-[10px] uppercase tracking-[0.14em] text-content-muted"><span className="h-px w-8 bg-accent/60" />System brief</div>
          <h1 className="mt-3 text-3xl font-medium tracking-display text-content-primary sm:text-4xl">{title}</h1>
          {subtitle && <p className="mt-3 max-w-2xl text-base leading-relaxed text-content-secondary">{subtitle}</p>}
          <RevealGroup as="div" className="mt-10 space-y-10" stagger={80}>
            {children}
          </RevealGroup>
        </div>
      </main>
      <Footer />
    </div>
  )
}
