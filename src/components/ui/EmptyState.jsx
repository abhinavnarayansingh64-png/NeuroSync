/**
 * EmptyState — reusable empty/placeholder block used wherever a list has no
 * items yet (dashboard, jobs, models, notifications).
 */

import { Icon } from './Icon'

export function EmptyState({ icon = 'layers', title, description, action, className = '' }) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-12 text-center ${className}`}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-surface text-content-muted">
        <Icon name={icon} size={24} />
      </div>
      <h3 className="text-base font-semibold text-content-primary">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm text-content-secondary">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
