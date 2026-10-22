/**
 * DatasetUpload — drag-and-drop + file-browser dataset uploader with
 * inline validation (PRD Section 2: Dataset). Reports a validated dataset
 * descriptor to the parent via onChange, or clears it via onClear.
 */

import { useId, useRef, useState } from 'react'
import { Icon } from './ui/Icon'
import { Spinner } from './ui/Spinner'
import { Button } from './ui/Button'
import { formatBytes } from '../utils/format'
import { SUPPORTED_EXTENSIONS, validateDatasetFile } from '../services/datasetValidator'

export function DatasetUpload({ dataset, onChange, onClear, error }) {
  const inputId = useId()
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [validating, setValidating] = useState(false)
  const [localError, setLocalError] = useState('')

  const handleFile = async (file) => {
    setLocalError('')
    setValidating(true)
    try {
      const result = await validateDatasetFile(file)
      onChange(result)
    } catch (err) {
      onClear()
      setLocalError(err.message || 'The file could not be validated.')
    } finally {
      setValidating(false)
    }
  }

  const onDrop = (event) => {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const onInputChange = (event) => {
    const file = event.target.files?.[0]
    if (file) handleFile(file)
    // Reset so re-selecting the same file re-triggers change.
    event.target.value = ''
  }

  const displayError = error || localError

  if (dataset) {
    return (
      <div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface/50 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <Icon name="document" size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-content-primary">{dataset.name}</p>
            <p className="text-xs text-content-secondary">
              {dataset.type} · {formatBytes(dataset.sizeBytes)} · {dataset.records.toLocaleString()} records
            </p>
          </div>
          <Button variant="ghost" size="sm" icon="trash" onClick={onClear}>
            Remove
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={[
          'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
          dragging ? 'border-accent bg-accent-soft' : 'border-border hover:border-border-strong',
          displayError ? 'border-status-danger/60' : '',
        ].join(' ')}
      >
        {validating ? (
          <Spinner size={28} className="text-accent" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface text-content-secondary">
            <Icon name="upload" size={24} />
          </div>
        )}
        <p className="mt-4 text-sm font-medium text-content-primary">
          {validating ? 'Validating dataset…' : 'Drag & drop your dataset here'}
        </p>
        <p className="mt-1 text-xs text-content-secondary">
          or <span className="text-accent">browse files</span> · {SUPPORTED_EXTENSIONS.map((e) => e.toUpperCase()).join(', ')} · up to 500 MB
        </p>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept=".json,.jsonl,.csv"
          className="sr-only"
          onChange={onInputChange}
        />
      </label>
      {displayError && <p className="mt-1.5 text-xs text-status-danger">{displayError}</p>}
    </div>
  )
}
