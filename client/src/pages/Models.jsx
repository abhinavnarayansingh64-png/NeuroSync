/**
 * Models (PRD Section 5: Model Management). Lists trained models produced by
 * completed jobs with download, rename, delete and view-details actions.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { RevealGroup } from '../components/motion/Reveal'
import { useData } from '../contexts/DataContext'
import { useToast } from '../contexts/ToastContext'
import { PageContainer, PageHeader } from '../components/ui/PageContainer'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Input } from '../components/ui/Input'
import { formatBytes, formatDateTime } from '../utils/format'
import { downloadTextFile } from '../utils/download'
import { validateRequired } from '../utils/validation'

export default function Models() {
  const { models, renameModel, deleteModel } = useData()
  const { toast } = useToast()
  const [renameTarget, setRenameTarget] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)

  const openRename = (model) => {
    setRenameTarget(model)
    setRenameValue(model.name)
    setRenameError('')
  }

  const submitRename = () => {
    const error = validateRequired(renameValue, 'Model name')
    if (error) {
      setRenameError(error)
      return
    }
    renameModel(renameTarget.id, renameValue)
    setRenameTarget(null)
    toast.success('Model renamed')
  }

  const download = (model) => {
    const manifest = {
      model: model.name,
      baseModel: model.baseModel,
      method: model.method,
      job: model.jobId,
      createdAt: new Date(model.createdAt).toISOString(),
      sizeBytes: model.sizeBytes,
      note: 'This manifest represents the fine-tuned adapter produced by NeuroSync.',
    }
    downloadTextFile(`${model.name}.json`, JSON.stringify(manifest, null, 2))
    toast.success('Model manifest downloaded')
  }

  return (
    <PageContainer>
      <PageHeader title="Models" description="Fine-tuned models produced by your completed training jobs." />

      {models.length === 0 ? (
        <EmptyState
          icon="cube"
          title="No trained models yet"
          description="When a training job completes, its fine-tuned model will appear here ready to download."
          action={
            <Link to="/jobs/new">
              <Button>New Training Job</Button>
            </Link>
          }
        />
      ) : (
        <RevealGroup as="div" className="grid gap-4 sm:grid-cols-2" stagger={56}>
          {models.map((model) => (
            <Card key={model.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                    <Icon name="cube" size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-content-primary">{model.name}</h3>
                    <p className="mt-0.5 text-xs text-content-muted">Base: {model.baseModel}</p>
                  </div>
                </div>
                <Badge tone="cyan">{model.method}</Badge>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <dt className="text-xs text-content-muted">Size</dt>
                  <dd className="text-content-primary">{formatBytes(model.sizeBytes)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-content-muted">Created</dt>
                  <dd className="text-content-primary">{formatDateTime(model.createdAt)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-content-muted">Training Job</dt>
                  <dd>
                    <Link to={`/jobs/${model.jobId}`} className="font-mono text-sm text-accent hover:underline">
                      {model.jobId}
                    </Link>
                  </dd>
                </div>
              </dl>

              <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-border/60 pt-4">
                <Button variant="ghost" size="sm" icon="pencil" onClick={() => openRename(model)}>
                  Rename
                </Button>
                <Button variant="ghost" size="sm" icon="download" onClick={() => download(model)}>
                  Download
                </Button>
                <Button variant="danger" size="sm" icon="trash" onClick={() => setDeleteTarget(model)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </RevealGroup>
      )}

      {/* Rename modal */}
      <Modal
        open={!!renameTarget}
        onClose={() => setRenameTarget(null)}
        title="Rename model"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button onClick={submitRename}>Save</Button>
          </>
        }
      >
        <Input
          label="Model name"
          value={renameValue}
          onChange={(e) => {
            setRenameValue(e.target.value)
            if (renameError) setRenameError('')
          }}
          error={renameError}
          autoFocus
        />
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          deleteModel(deleteTarget.id)
          setDeleteTarget(null)
          toast.success('Model deleted')
        }}
        title="Delete this model?"
        description="This permanently removes the fine-tuned model from your workspace."
        confirmLabel="Delete model"
      />
    </PageContainer>
  )
}
