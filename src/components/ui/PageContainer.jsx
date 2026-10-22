/**
 * PageContainer — consistent max-width, padding and optional page header
 * used by every authenticated page so spacing stays uniform across the app.
 */

export function PageContainer({ children, className = '', size = 'default' }) {
  const maxWidth = size === 'narrow' ? 'max-w-3xl' : size === 'wide' ? 'max-w-7xl' : 'max-w-6xl'
  return (
    <div className={`mx-auto w-full ${maxWidth} px-4 py-6 sm:px-6 sm:py-8 lg:px-8 ${className}`}>{children}</div>
  )
}

export function PageHeader({ title, description, actions, back }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back}
        <h1 className="text-2xl font-medium tracking-heading text-content-primary sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 text-sm text-content-secondary sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
