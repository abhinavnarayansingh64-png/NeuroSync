/** ProgressBar — accessible horizontal progress indicator. */
import { clamp } from '../../utils/format'

export function ProgressBar({ value = 0, tone = 'accent', className = '', showLabel = false, height = 'h-2' }) {
  const pct = clamp(value, 0, 100)
  const barColor =
    tone === 'blue' ? 'bg-status-running' : tone === 'amber' ? 'bg-status-warning' : 'bg-accent'
  return (
    <div className={className}>
      <div
        className={`w-full overflow-hidden rounded-full bg-surface ${height}`}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full ${barColor} motion-out-fill`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && <p className="mt-1 text-right text-xs text-content-muted">{pct.toFixed(1)}%</p>}
    </div>
  )
}
