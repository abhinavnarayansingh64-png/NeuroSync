/**
 * ErrorBoundary — catches rendering errors anywhere in the tree and shows a
 * recoverable fallback instead of a blank screen (PRD: "Handle every error
 * gracefully. Avoid exposing internal system details."). Details are logged
 * to the console, never shown to the user.
 */

import { Component } from 'react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('[NeuroSync] Unhandled UI error:', error, info)
  }

  handleReload = () => {
    this.setState({ hasError: false })
    window.location.assign('/')
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-base px-4">
          <div className="max-w-md text-center">
            <p className="text-5xl font-bold text-accent">Oops</p>
            <h1 className="mt-4 text-xl font-semibold text-content-primary">Something went wrong</h1>
            <p className="mt-2 text-sm text-content-secondary">
              An unexpected error interrupted the application. Your saved data is safe. Reloading usually resolves it.
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-accent px-6 text-sm font-medium text-white hover:bg-accent-hover"
            >
              Reload NeuroSync
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
