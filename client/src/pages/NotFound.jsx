/**
 * NotFound — custom 404 page (PRD Section 1). Clean, on-brand, with a clear
 * recovery action back to a safe location depending on auth state.
 */

import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Logo } from '../components/Logo'
import { Button } from '../components/ui/Button'

export default function NotFound() {
  const { isAuthenticated } = useAuth()
  const target = isAuthenticated ? '/dashboard' : '/'

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-base px-4 text-center">
      <Logo />
      <p className="mt-10 text-7xl font-medium tracking-display text-accent sm:text-8xl">404</p>
      <h1 className="mt-4 text-xl font-medium tracking-heading text-content-primary sm:text-2xl">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-content-secondary">
        The page you&apos;re looking for doesn&apos;t exist or may have been moved.
      </p>
      <Link to={target} className="mt-8">
        <Button size="lg" iconRight="chevronRight">
          {isAuthenticated ? 'Back to dashboard' : 'Back to home'}
        </Button>
      </Link>
    </div>
  )
}
