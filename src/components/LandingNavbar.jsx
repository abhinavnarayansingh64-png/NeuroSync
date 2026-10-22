/**
 * LandingNavbar — public marketing navigation (PRD Section 1).
 * All links route to real pages: Documentation, Pricing, About, and Login.
 * Collapses into a menu on small screens.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from './Logo'
import { Presence } from './motion/Presence'
import { Button } from './ui/Button'
import { Icon } from './ui/Icon'

const LINKS = [
  { label: 'Documentation', to: '/docs' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'About', to: '/about' },
]

export function LandingNavbar() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-base/80 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo />

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              className="rounded-lg px-3 py-2 text-sm text-content-secondary transition-colors hover:text-content-primary"
            >
              {link.label}
            </Link>
          ))}
          <Link to="/login" className="ml-2">
            <Button size="sm">Enter workspace</Button>
          </Link>
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-content-secondary hover:text-content-primary md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          <Icon name={open ? 'close' : 'menu'} size={22} />
        </button>
      </nav>

      <Presence when={open} origin="top">
        <div className="border-t border-border/60 bg-base px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                className="rounded-lg px-3 py-2 text-sm text-content-secondary hover:bg-card-hover hover:text-content-primary"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link to="/login" onClick={() => setOpen(false)} className="mt-1">
              <Button size="sm" fullWidth>
                Enter workspace
              </Button>
            </Link>
          </div>
        </div>
      </Presence>
    </header>
  )
}
