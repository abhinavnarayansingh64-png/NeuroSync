/** Signal & Structure style reminder: auth is an identity gate inside the operational network, not a generic SaaS card. */
import { Logo } from './Logo'

export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-base texture-ruled">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_34%,rgba(67,178,244,0.1),transparent_28%),radial-gradient(circle_at_12%_78%,rgba(67,178,244,0.05),transparent_18%)]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-4 top-5 flex items-center justify-between font-mono-tech text-[10px] uppercase tracking-[0.14em] text-content-muted sm:inset-x-8" aria-hidden="true">
        <span>NeuroSync / identity gateway</span>
        <span className="hidden sm:block">channel secure · v1.0</span>
      </div>
      <div className="relative flex flex-1 items-center justify-center px-4 py-16 sm:py-20">
        <div className="w-full max-w-md">
          <div className="mb-5 flex justify-center">
            <Logo />
          </div>
          <div className="animate-ns-scale-in rounded-2xl border border-border bg-card/95 p-6 shadow-card backdrop-blur-sm sm:p-8">
            <div className="mb-6 border-b border-border pb-5 text-center">
              <p className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-accent">Identity verified on submit</p>
              <h1 className="text-xl font-medium tracking-heading text-content-primary sm:text-2xl">{title}</h1>
              {subtitle && <p className="mt-1.5 text-sm text-content-secondary">{subtitle}</p>}
            </div>
            {children}
          </div>
          {footer && <p className="mt-5 text-center text-sm text-content-secondary">{footer}</p>}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-4 bottom-5 flex items-center justify-between font-mono-tech text-[10px] uppercase tracking-[0.14em] text-content-muted sm:inset-x-8" aria-hidden="true">
        <span>auth / ready</span>
        <span className="hidden sm:block">encrypted session handoff</span>
      </div>
    </div>
  )
}
