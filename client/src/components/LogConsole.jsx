/**
 * LogConsole — real-time training log viewer (PRD Section 5: Training Logs).
 * Auto-scrolls to the newest entry, lets the user pause auto-scroll, and
 * supports downloading the complete log as a text file.
 */

import { useEffect, useRef, useState } from 'react'
import { Button } from './ui/Button'
import { Icon } from './ui/Icon'

const LEVEL_COLOR = {
  info: 'text-content-secondary',
  success: 'text-accent',
  warn: 'text-status-warning',
  error: 'text-status-danger',
}

function formatClock(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0))
  const m = String(Math.floor(total / 60)).padStart(2, '0')
  const s = String(total % 60).padStart(2, '0')
  return `${m}:${s}`
}

export function LogConsole({ logs = [], jobId }) {
  const [autoScroll, setAutoScroll] = useState(true)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  const handleDownload = () => {
    const text = logs
      .map((log) => `[${formatClock(log.atSec)}] ${(log.level || 'info').toUpperCase()}  ${log.message}`)
      .join('\n')
    const blob = new Blob([text || 'No logs available.'], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${jobId || 'training'}-logs.txt`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-[#0a0807]">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm font-medium text-content-primary">
          <Icon name="document" size={16} className="text-content-secondary" />
          Training Logs
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            icon={autoScroll ? 'pause' : 'play'}
            onClick={() => setAutoScroll((v) => !v)}
          >
            {autoScroll ? 'Pause scroll' : 'Auto-scroll'}
          </Button>
          <Button variant="ghost" size="sm" icon="download" onClick={handleDownload} disabled={!logs.length}>
            Download
          </Button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="h-72 overflow-y-auto px-4 py-3 font-mono text-xs leading-relaxed"
        role="log"
        aria-live="polite"
        aria-label="Training log output"
      >
        {logs.length === 0 ? (
          <p className="text-content-muted">Waiting for log output…</p>
        ) : (
          logs.map((log, index) => {
            const isLatest = index === logs.length - 1 && logs.length > 1
            return (
              <div
                key={index}
                className={`flex gap-3 ${isLatest ? 'ns-line-new rounded-sm' : ''}`}
                aria-atomic={isLatest ? 'true' : undefined}
              >
                <span className="shrink-0 text-content-muted">{formatClock(log.atSec)}</span>
                <span className={`whitespace-pre-wrap break-words ${LEVEL_COLOR[log.level] || LEVEL_COLOR.info}`}>
                  {log.message}
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
