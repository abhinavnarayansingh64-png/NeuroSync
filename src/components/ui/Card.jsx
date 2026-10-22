/**
 * Card — the reusable surface container used for every panel in the app.
 * Supports an optional header (title / description / actions) and a
 * selectable/interactive mode for grids of choosable cards.
 */

export function Card({
  children,
  className = '',
  title,
  description,
  actions,
  as: Tag = 'div',
  interactive = false,
  selected = false,
  padded = true,
  ...rest
}) {
  return (
    <Tag
      className={[
        'bg-card border rounded-xl',
        selected ? 'border-accent ring-1 ring-accent/40' : 'border-border',
        interactive ? 'transition-colors duration-150 hover:border-border-strong cursor-pointer text-left w-full' : '',
        padded ? 'p-6' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {(title || actions) && (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {title && <h3 className="text-base font-semibold text-content-primary">{title}</h3>}
            {description && <p className="mt-1 text-sm text-content-secondary">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </Tag>
  )
}

/** Section header used inside multi-section pages (e.g. the training workspace). */
export function SectionHeader({ step, title, description, complete = false }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      {step != null && (
        <span
          className={[
            'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]',
            complete ? 'bg-accent text-white scale-100' : 'bg-surface text-content-secondary border border-border scale-95',
          ].join(' ')}
          aria-label={complete ? `Section ${step} complete` : `Section ${step}`}
        >
          {complete ? '✓' : step}
        </span>
      )}
      <div>
        <h3 className="text-base font-semibold text-content-primary">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-content-secondary">{description}</p>}
      </div>
    </div>
  )
}
