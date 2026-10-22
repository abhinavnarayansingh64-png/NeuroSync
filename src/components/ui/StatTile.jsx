/** StatTile — compact KPI tile used across dashboards and monitoring. */
import { Icon } from './Icon'

export function StatTile({ label, value, sub, icon, tone = 'default' }) {
  const toneColor =
    tone === 'accent'
      ? 'text-accent'
      : tone === 'blue'
      ? 'text-status-running'
      : tone === 'amber'
      ? 'text-status-warning'
      : 'text-content-primary'
  return (
    <div className="rounded-xl border border-border bg-surface/50 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-content-muted">{label}</p>
        {icon && <Icon name={icon} size={16} className="text-content-muted" />}
      </div>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${toneColor}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-content-secondary">{sub}</p>}
    </div>
  )
}
