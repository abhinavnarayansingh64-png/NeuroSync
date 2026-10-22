/**
 * NewJob — the guided training workspace (PRD Section 2).
 *
 * A single page composed of clearly separated cards: Job Information, Receiver
 * Selection, Foundation Model, Dataset, Training Configuration (+ collapsible
 * Advanced Settings) and a live Configuration Summary. All state is local to
 * the page so users can move freely between sections without losing input.
 * The Start Training button stays disabled until every required field is
 * valid, and submission is guarded against duplicate clicks.
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../contexts/DataContext'
import { useSettings } from '../contexts/SettingsContext'
import { useToast } from '../contexts/ToastContext'
import { trpc } from '../lib/trpc'
import { PageContainer, PageHeader } from '../components/ui/PageContainer'
import { Card, SectionHeader } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Textarea, Toggle, Select } from '../components/ui/Field'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { StatusBadge } from '../components/ui/Badge'
import { DatasetUpload } from '../components/DatasetUpload'
import { PaymentModal } from '../components/PaymentModal'
import { TRAINING_METHODS } from '../constants/trainingOptions'
import { validateNumberInRange, validateRequired } from '../utils/validation'
import { formatBytes } from '../utils/format'
import { estimateJobCost, formatInr } from '../services/pricing'
import { uploadDatasetToWorkspace } from '../services/datasetTransfer'

const PARAM_RULES = {
  epochs: { min: 1, max: 100, integer: true, label: 'Epochs' },
  learningRate: { min: 0.000001, max: 1, label: 'Learning Rate' },
  batchSize: { min: 1, max: 128, integer: true, label: 'Batch Size' },
  gradientAccumulation: { min: 1, max: 64, integer: true, label: 'Gradient Accumulation Steps' },
  maxSeqLength: { min: 128, max: 8192, integer: true, label: 'Maximum Sequence Length' },
}

const ADVANCED_RULES = {
  weightDecay: { min: 0, max: 1, label: 'Weight Decay' },
  warmupRatio: { min: 0, max: 0.5, label: 'Warmup Ratio' },
  randomSeed: { min: 0, max: 2 ** 31, integer: true, label: 'Random Seed' },
}

const receiverStatus = {
  available: 'Available',
  busy: 'Busy',
  offline: 'Offline',
  maintenance: 'Maintenance',
}

function normalizeReceiver(receiver) {
  const capabilities = receiver.capabilities && typeof receiver.capabilities === 'object' ? receiver.capabilities : {}
  const browserReported = capabilities.reportSource === 'browser_receiver_console'
  return {
    ...receiver,
    status: receiverStatus[receiver.availability] || 'Offline',
    vram: `${receiver.vramGb} GB`,
    cpu: capabilities.cpu || 'Not listed',
    ram: capabilities.ram || 'Not listed',
    activity: capabilities.activity || 'Directory listed',
    browserReported,
    hardwareReport: browserReported ? 'Self-reported via browser heartbeat' : null,
  }
}

function normalizeModel(model) {
  const metadata = model.metadata && typeof model.metadata === 'object' ? model.metadata : {}
  return {
    ...model,
    developer: model.provider,
    parameters: model.sizeLabel,
    size: metadata.storageSize || '—',
    architecture: metadata.architecture || 'Model architecture not listed',
    contextLength: model.contextWindow ? `${Number(model.contextWindow).toLocaleString()} tokens` : 'Not listed',
    license: metadata.license || 'See model card',
    recommendedVram: metadata.recommendedVram || 'See deployment requirements',
    useCases: Array.isArray(metadata.useCases) ? metadata.useCases : (Array.isArray(model.tags) ? model.tags : []),
    basePriceInr: Number(model.baseFeeInr),
    hourlyRateInr: Number(model.hourlyRateInr),
    mbPerHour: Number(model.throughputMbPerHour),
  }
}

function SummaryRow({ label, value, missing }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-content-secondary">{label}</span>
      {missing ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-status-warning">
          <Icon name="alert" size={14} /> Required
        </span>
      ) : (
        <span className="truncate text-sm font-medium text-content-primary">{value}</span>
      )}
    </div>
  )
}

export default function NewJob() {
  const navigate = useNavigate()
  const { startJob, gpuMode, membership, receivers: liveReceiverDirectory, receiverDirectoryError, refreshReceivers, isLoading: workspaceDataLoading, beginPremiumTrial, beginPremiumCheckout } = useData()
  const { settings } = useSettings()
  const { toast } = useToast()
  const baseModelCatalog = trpc.catalog.baseModels.useQuery(undefined, { staleTime: 30_000 })

  const defaults = settings.defaultParams

  const [form, setForm] = useState({
    name: '',
    description: '',
    receiverId: '',
    receiverIds: [],
    trainingMode: 'single',
    synchronizationStrategy: 'per_step',
    modelId: '',
    dataset: null,
    params: {
      epochs: String(defaults.epochs),
      learningRate: String(defaults.learningRate),
      batchSize: String(defaults.batchSize),
      gradientAccumulation: String(defaults.gradientAccumulation),
      maxSeqLength: String(defaults.maxSeqLength),
    },
    advanced: {
      method: 'lora',
      mixedPrecision: 'bf16',
      gradientCheckpointing: true,
      weightDecay: '0.01',
      warmupRatio: '0.03',
      randomSeed: '42',
    },
  })
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [pendingConfig, setPendingConfig] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState('Authorize & start')

  const receivers = useMemo(() => liveReceiverDirectory.map(normalizeReceiver), [liveReceiverDirectory])
  const models = useMemo(() => (baseModelCatalog.data || []).map(normalizeModel), [baseModelCatalog.data])
  const selectedReceiver = form.receiverId ? receivers.find((receiver) => receiver.id === form.receiverId) || null : null
  const selectedReceivers = useMemo(
    () => receivers.filter((receiver) => form.receiverIds.includes(receiver.id)),
    [form.receiverIds, receivers],
  )
  const selectedModel = form.modelId ? models.find((model) => model.id === form.modelId) || null : null
  const hasPremium = membership?.plan === 'premium' && ['active', 'trialing'].includes(membership?.status)
  const catalogLoading = workspaceDataLoading || baseModelCatalog.isLoading
  const catalogError = baseModelCatalog.isError || Boolean(receiverDirectoryError)

  const estimate = useMemo(
    () => estimateJobCost(selectedModel, form.dataset, Number(form.params.epochs), {
      receiver: form.trainingMode === 'distributed' ? selectedReceivers[0] : selectedReceiver,
      receiverCount: form.trainingMode === 'distributed' ? selectedReceivers.length : 1,
      trainingMode: form.trainingMode,
    }),
    [selectedModel, form.dataset, form.params.epochs, form.trainingMode, selectedReceiver, selectedReceivers],
  )

  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }))
  const setParam = (key, value) =>
    setForm((current) => ({ ...current, params: { ...current.params, [key]: value } }))
  const setAdvanced = (key, value) =>
    setForm((current) => ({ ...current, advanced: { ...current.advanced, [key]: value } }))
  const chooseTrainingMode = (trainingMode) => setForm((current) => ({
    ...current,
    trainingMode,
    receiverId: trainingMode === 'single' ? current.receiverId : '',
    receiverIds: trainingMode === 'single' ? [] : current.receiverIds,
  }))
  const toggleDistributedReceiver = (receiverId) => setForm((current) => ({
    ...current,
    receiverIds: current.receiverIds.includes(receiverId)
      ? current.receiverIds.filter((id) => id !== receiverId)
      : [...current.receiverIds, receiverId],
  }))

  // ---- Validation --------------------------------------------------------
  const paramErrors = useMemo(() => {
    const errors = {}
    for (const [key, rule] of Object.entries(PARAM_RULES)) {
      errors[key] = validateNumberInRange(form.params[key], rule)
    }
    return errors
  }, [form.params])

  const advancedErrors = useMemo(() => {
    const errors = {}
    for (const [key, rule] of Object.entries(ADVANCED_RULES)) {
      errors[key] = validateNumberInRange(form.advanced[key], rule)
    }
    return errors
  }, [form.advanced])

  const nameError = validateRequired(form.name, 'Job Name')

  const paramsValid = Object.values(paramErrors).every((e) => !e)
  const advancedValid = Object.values(advancedErrors).every((e) => !e)

  const missing = {
    name: !!nameError,
    receiver: form.trainingMode === 'distributed' ? form.receiverIds.length < 2 : !form.receiverId,
    model: !form.modelId,
    dataset: !form.dataset,
    params: !paramsValid,
  }

  const receiverSelectionValid = form.trainingMode === 'distributed' ? form.receiverIds.length >= 2 : !!form.receiverId
  const canStart = !catalogLoading && !catalogError && !nameError && receiverSelectionValid && form.modelId && form.dataset && paramsValid && advancedValid && (form.trainingMode !== 'distributed' || hasPremium)

  // ---- Submit ------------------------------------------------------------
  const handleStart = () => {
    setTouched(true)
    if (!canStart || submitting) return

    const receiver = selectedReceiver || selectedReceivers[0]
    if (!receiver || (form.trainingMode === 'distributed' && selectedReceivers.length < 2)) {
      toast.error('The selected receiver set is no longer available. Refresh the live directory and choose available receivers.')
      return
    }
    const config = {
      name: form.name.trim(),
      description: form.description.trim(),
      receiver: {
        id: receiver.id,
        gpu: receiver.gpu,
        vram: receiver.vram,
        vramGb: receiver.vramGb,
        cpu: receiver.cpu,
        ram: receiver.ram,
      },
      receivers: form.trainingMode === 'distributed'
        ? selectedReceivers.map((item) => ({ id: item.id, gpu: item.gpu, vram: item.vram, vramGb: item.vramGb }))
        : undefined,
      trainingMode: form.trainingMode,
      synchronizationStrategy: form.trainingMode === 'distributed' ? form.synchronizationStrategy : undefined,
      modelId: form.modelId,
      modelName: selectedModel?.name,
      dataset: form.dataset,
      params: {
        epochs: Number(form.params.epochs),
        learningRate: Number(form.params.learningRate),
        batchSize: Number(form.params.batchSize),
        gradientAccumulation: Number(form.params.gradientAccumulation),
        maxSeqLength: Number(form.params.maxSeqLength),
      },
      advanced: {
        method: form.advanced.method,
        mixedPrecision: form.advanced.mixedPrecision,
        gradientCheckpointing: form.advanced.gradientCheckpointing,
        weightDecay: Number(form.advanced.weightDecay),
        warmupRatio: Number(form.advanced.warmupRatio),
        randomSeed: Number(form.advanced.randomSeed),
      },
      // Pricing snapshot at the moment of dispatch — the base fee is what's
      // charged now; finalPaymentInr is billed after training completes.
      pricing: estimate,
    }

    // Base fee is paid before the job is dispatched.
    setPendingConfig(config)
  }

  const handleConfirmPayment = async () => {
    if (!pendingConfig?.dataset?.file) {
      toast.error('Please choose the dataset again before authorizing this job.')
      return
    }
    setSubmitting(true)
    setUploadProgress(0)
    setUploadStatus('Uploading dataset securely…')
    try {
      const upload = await uploadDatasetToWorkspace(pendingConfig.dataset, (progress) => {
        setUploadProgress(progress)
        setUploadStatus(progress >= 100 ? 'Reserving receiver and authorizing job…' : `Uploading dataset securely · ${progress}%`)
      })
      const job = await startJob({
        ...pendingConfig,
        dataset: { ...pendingConfig.dataset, storageKey: upload.key },
        datasetKey: upload.key,
        datasetUrl: upload.url,
      })
      setPendingConfig(null)
      toast.success(`Dataset transferred · job authorized · ${job.id}`)
      navigate(`/jobs/${job.id}`)
    } catch (error) {
      setUploadStatus('Upload authorization failed')
      toast.error(error?.message || 'The training request could not be recorded.')
    } finally {
      setSubmitting(false)
    }
  }

  const showError = (error) => (touched ? error : '')

  return (
    <PageContainer>
      <div className="animate-ns-settle">
      <PageHeader
        title="New Training Job"
        description="Configure and launch a fine-tuning job on a connected GPU receiver."
        back={
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="mb-2 inline-flex items-center gap-1 text-sm text-content-secondary hover:text-content-primary"
          >
            <Icon name="arrowLeft" size={16} /> Back to dashboard
          </button>
        }
      />

      {gpuMode === 'simulation' && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-accent-border bg-accent-soft/20 px-4 py-3 text-sm text-content-secondary">
          <Icon name="info" size={17} className="mt-0.5 shrink-0 text-accent" />
          <p><span className="font-medium text-content-primary">Server simulation active.</span> Job records, telemetry, events, and model artifacts are persisted by the backend. Add provider credentials later to dispatch this same workflow to RunPod GPUs.</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Job Information */}
          <Card>
            <SectionHeader step={1} title="Job Information" description="Name your training job." complete={!missing.name} />
            <div className="space-y-4">
              <Input
                label="Job Name"
                placeholder="e.g. support-assistant-v1"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                error={showError(nameError)}
                required
              />
              <Textarea
                label="Description"
                placeholder="Optional — describe the purpose of this fine-tune."
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                rows={2}
              />
            </div>
          </Card>

          <Card>
            <SectionHeader step={2} title="Training topology" description="Keep a familiar single-receiver path or coordinate multiple live receivers." complete />
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => chooseTrainingMode('single')} className={`rounded-xl border p-4 text-left transition ${form.trainingMode === 'single' ? 'border-accent bg-accent-soft/30 ring-1 ring-accent/40' : 'border-border hover:border-border-strong'}`}>
                <div className="flex items-center justify-between"><span className="font-semibold text-content-primary">Simple fine-tuning</span><span className="rounded-full bg-surface px-2 py-0.5 text-[11px] text-content-secondary">One GPU</span></div>
                <p className="mt-2 text-sm text-content-secondary">The existing single-GPU workflow with one receiver, one dataset stream, and isolated checkpoints.</p>
              </button>
              <button type="button" onClick={() => chooseTrainingMode('distributed')} className={`rounded-xl border p-4 text-left transition ${form.trainingMode === 'distributed' ? 'border-accent bg-accent-soft/30 ring-1 ring-accent/40' : 'border-border hover:border-border-strong'}`}>
                <div className="flex items-center justify-between"><span className="font-semibold text-content-primary">Distributed fine-tuning</span><span className="rounded-full border border-amber-400/30 bg-amber-300/10 px-2 py-0.5 text-[11px] text-amber-200">Premium</span></div>
                <p className="mt-2 text-sm text-content-secondary">Partition the dataset across two or more receivers with server-owned assignments and coordinated checkpoints.</p>
              </button>
            </div>
            {form.trainingMode === 'distributed' && (
              <div className="mt-4 rounded-xl border border-accent-border bg-surface-raised p-4">
                {!hasPremium ? (
                  <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium text-content-primary">Premium access is required</p><p className="mt-1 text-sm text-content-secondary">Unlock distributed jobs with a secure monthly membership, or use the workspace trial while testing.</p></div><div className="flex flex-wrap gap-2"><Button size="sm" onClick={async () => { const checkout = await beginPremiumCheckout(); window.open(checkout.url, '_blank', 'noopener'); toast.success('Opening secure Premium checkout in a new tab.') }}>Upgrade to Premium</Button><Button variant="outline" size="sm" onClick={async () => { await beginPremiumTrial(); toast.success('Premium trial is active for this workspace.') }}>Start trial</Button></div></div>
                ) : (
                  <><p className="text-sm font-medium text-content-primary">Synchronization strategy</p><div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <button type="button" onClick={() => setField('synchronizationStrategy', 'per_step')} className={`rounded-lg border p-3 text-left ${form.synchronizationStrategy === 'per_step' ? 'border-accent bg-accent-soft/30' : 'border-border'}`}><span className="block text-sm font-medium text-content-primary">Per-step synchronization</span><span className="mt-1 block text-xs text-content-secondary">Workers synchronize gradients and a common checkpoint after every optimization step.</span></button>
                    <button type="button" onClick={() => setField('synchronizationStrategy', 'adaptive')} className={`rounded-lg border p-3 text-left ${form.synchronizationStrategy === 'adaptive' ? 'border-accent bg-accent-soft/30' : 'border-border'}`}><span className="block text-sm font-medium text-content-primary">Adaptive synchronization</span><span className="mt-1 block text-xs text-content-secondary">The coordinator syncs on loss divergence, interval budget, and receiver latency signals.</span></button>
                  </div><p className="mt-3 text-xs text-content-muted">Both strategies create durable receiver assignments, dataset partitions, and recoverable coordinator checkpoints.</p></>
                )}
              </div>
            )}
          </Card>

          {/* Receiver Selection */}
          <Card>
            <SectionHeader
              step={3}
              title="Receiver Selection"
              description={form.trainingMode === 'distributed' ? 'Choose two or more available connected GPU receivers.' : 'Choose a connected GPU receiver to run the job.'}
              complete={!missing.receiver}
            />
            <p className="-mt-2 mb-4 flex items-center gap-1.5 text-xs text-content-muted">
              <span className={`h-1.5 w-1.5 rounded-full ${catalogError ? 'bg-status-danger' : catalogLoading ? 'bg-status-warning' : 'bg-status-success'}`} />
              {catalogError ? 'The live receiver directory is temporarily unavailable. Retry to refresh it.' : catalogLoading ? 'Loading server-backed receiver directory…' : 'Live directory · availability refreshes every 4 seconds'}
            </p>
            {receiverDirectoryError && (
              <div className="-mt-1 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-status-danger/30 bg-status-danger/5 px-3 py-2 text-sm text-content-secondary">
                <span>{receiverDirectoryError.message || 'Receiver data could not be loaded.'}</span>
                <Button size="sm" variant="secondary" onClick={() => refreshReceivers()}>Retry receiver directory</Button>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {receivers.map((receiver) => {
                const selectable = receiver.status === 'Available'
                const selected = form.trainingMode === 'distributed' ? form.receiverIds.includes(receiver.id) : form.receiverId === receiver.id
                return (
                  <button
                    key={receiver.id}
                    type="button"
                    disabled={!selectable}
                    onClick={() => form.trainingMode === 'distributed' ? toggleDistributedReceiver(receiver.id) : setField('receiverId', receiver.id)}
                    className={[
                      'rounded-xl border p-4 text-left transition-all duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]',
                      selected ? 'border-accent ring-1 ring-accent/40 bg-accent-soft/40' : 'border-border',
                      selectable ? 'hover:border-border-strong active:scale-[0.97]' : 'cursor-not-allowed opacity-55',
                    ].join(' ')}
                  >
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="min-w-0"><span className="block truncate text-sm font-semibold text-content-primary">{receiver.name || 'Browser receiver'}</span><span className="mt-0.5 block truncate font-mono text-[11px] text-content-muted">{receiver.id}</span></div>
                      <span className="shrink-0"><StatusBadge status={receiver.status} /></span>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                      <div className="col-span-2 flex justify-between">
                        <dt className="text-content-muted">GPU</dt>
                        <dd className="font-medium text-content-primary">{receiver.gpu}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-content-muted">VRAM</dt>
                        <dd className="text-content-secondary">{receiver.vram}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-content-muted">RAM</dt>
                        <dd className="text-content-secondary">{receiver.ram}</dd>
                      </div>
                      <div className="col-span-2 flex justify-between">
                        <dt className="text-content-muted">CPU</dt>
                        <dd className="text-content-secondary">{receiver.cpu}</dd>
                      </div>
                      <div className="col-span-2 flex justify-between">
                        <dt className="text-content-muted">Activity</dt>
                        <dd className="text-content-secondary">{receiver.activity}</dd>
                      </div>
                      {receiver.hardwareReport && (
                        <div className="col-span-2 mt-1 flex items-start gap-1.5 rounded-md border border-amber-300/20 bg-amber-300/5 px-2 py-1.5 text-[11px] text-amber-100">
                          <Icon name="info" size={13} className="mt-0.5 shrink-0" />
                          <span><span className="font-medium">Hardware self-reported.</span> This browser receiver is available for network coordination; a local agent is required for verified CUDA telemetry.</span>
                        </div>
                      )}
                    </dl>
                  </button>
                )
              })}
            </div>

            {form.trainingMode === 'distributed' && (
              <p className="mt-4 text-sm text-content-secondary"><span className="font-medium text-content-primary">{selectedReceivers.length}</span> of 2+ receivers selected. Receiver availability is rechecked atomically before dispatch.</p>
            )}

            {selectedReceiver && form.trainingMode === 'single' && (
              <div key={selectedReceiver.id} className="mt-4 animate-ns-pop rounded-xl border border-accent-border bg-accent-soft/30 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent">Selected receiver</p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                  {[
                    ['Receiver ID', selectedReceiver.id],
                    ['GPU', selectedReceiver.gpu],
                    ['VRAM', selectedReceiver.vram],
                    ['CPU', selectedReceiver.cpu],
                    ['RAM', selectedReceiver.ram],
                    ['Status', selectedReceiver.status],
                    ...(selectedReceiver.hardwareReport ? [['Hardware report', selectedReceiver.hardwareReport]] : []),
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-content-muted">{label}</dt>
                      <dd className="text-content-primary">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </Card>

          {/* Foundation Model */}
          <Card>
            <SectionHeader
              step={4}
              title="Foundation Model"
              description="Select the open-source model to fine-tune."
              complete={!missing.model}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              {models.map((model) => {
                const selected = form.modelId === model.id
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => setField('modelId', model.id)}
                    className={[
                      'rounded-xl border p-4 text-left transition-all duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-border-strong active:scale-[0.97]',
                      selected ? 'border-accent ring-1 ring-accent/40 bg-accent-soft/40' : 'border-border',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-content-primary">{model.name}</span>
                      <span className="rounded-md bg-surface px-1.5 py-0.5 text-[11px] text-content-secondary">
                        {model.parameters}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-content-muted">{model.developer} · {model.size}</p>
                    <p className="mt-2 text-xs text-content-secondary">{model.description}</p>
                    <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5">
                      <span className="text-sm font-semibold text-accent">{formatInr(Math.min(300, Math.max(100, model.basePriceInr)))}</span>
                      <span className="text-[11px] text-content-muted">
                        base fee · +{formatInr(Math.min(60, Math.max(30, model.hourlyRateInr)))}/hr after
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>

            {selectedModel && (
              <div key={selectedModel.id} className="mt-4 animate-ns-pop rounded-xl border border-accent-border bg-accent-soft/30 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent">
                  {selectedModel.name} details
                </p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {[
                    ['Architecture', selectedModel.architecture],
                    ['Context Length', selectedModel.contextLength],
                    ['License', selectedModel.license],
                    ['Recommended VRAM', selectedModel.recommendedVram],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-content-muted">{label}</dt>
                      <dd className="text-content-primary">{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-3">
                  <p className="text-xs text-content-muted">Typical Use Cases</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {selectedModel.useCases.map((useCase) => (
                      <span
                        key={useCase}
                        className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs text-content-secondary"
                      >
                        {useCase}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Dataset */}
          <Card>
            <SectionHeader
              step={5}
              title="Dataset"
              description="Upload a JSON, JSONL or CSV dataset."
              complete={!missing.dataset}
            />
            <DatasetUpload
              dataset={form.dataset}
              onChange={(dataset) => setField('dataset', dataset)}
              onClear={() => setField('dataset', null)}
              error={touched && missing.dataset ? 'A dataset is required to start training.' : ''}
            />

            {estimate && (
              <div className="mt-4 rounded-xl border border-accent-border bg-accent-soft/30 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-accent">
                  Estimated for this dataset
                </p>
                <div className="mb-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-content-muted">Training time</p>
                    <p className="font-medium tabular-nums text-content-primary">~{estimate.estimatedHours} hr</p>
                  </div>
                  <div>
                    <p className="text-xs text-content-muted">Projected total</p>
                    <p className="font-medium tabular-nums text-content-primary">
                      {formatInr(estimate.estimatedTotalInr)}
                    </p>
                  </div>
                </div>
                {estimate.referenceTime && <p className="mb-3 rounded-lg border border-sky-300/20 bg-sky-300/5 px-3 py-2 text-xs text-sky-100">Reference calibration: {estimate.referenceTime}</p>}
                <div className="space-y-1 border-t border-border pt-3 text-xs">
                  <div className="flex justify-between text-content-secondary">
                    <span>Base fee (pay now)</span>
                    <span className="font-medium text-content-primary">{formatInr(estimate.basePriceInr)}</span>
                  </div>
                  <div className="flex justify-between text-content-secondary">
                    <span>Final payment (after training, unlocks download)</span>
                    <span className="font-medium text-content-primary">{formatInr(estimate.finalPaymentInr)}</span>
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-content-muted">
                  Based on your dataset's record count and the selected model — the final amount may shift
                  slightly with actual training time.
                </p>
              </div>
            )}
          </Card>

          {/* Training Configuration */}
          <Card>
            <SectionHeader
              step={6}
              title="Training Configuration"
              description="Set the core training parameters."
              complete={paramsValid}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Epochs"
                type="number"
                min="1"
                step="1"
                value={form.params.epochs}
                onChange={(e) => setParam('epochs', e.target.value)}
                error={showError(paramErrors.epochs)}
              />
              <Input
                label="Learning Rate"
                type="number"
                step="0.0001"
                value={form.params.learningRate}
                onChange={(e) => setParam('learningRate', e.target.value)}
                error={showError(paramErrors.learningRate)}
              />
              <Input
                label="Batch Size"
                type="number"
                min="1"
                step="1"
                value={form.params.batchSize}
                onChange={(e) => setParam('batchSize', e.target.value)}
                error={showError(paramErrors.batchSize)}
              />
              <Input
                label="Gradient Accumulation Steps"
                type="number"
                min="1"
                step="1"
                value={form.params.gradientAccumulation}
                onChange={(e) => setParam('gradientAccumulation', e.target.value)}
                error={showError(paramErrors.gradientAccumulation)}
              />
              <Input
                label="Maximum Sequence Length"
                type="number"
                min="128"
                step="1"
                value={form.params.maxSeqLength}
                onChange={(e) => setParam('maxSeqLength', e.target.value)}
                error={showError(paramErrors.maxSeqLength)}
                className="sm:col-span-2"
              />
            </div>

            {/* Advanced settings (collapsible) */}
            <div className="mt-5 rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setAdvancedOpen((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-content-primary"
                aria-expanded={advancedOpen}
              >
                <span className="flex items-center gap-2">
                  <Icon name="settings" size={16} className="text-content-secondary" />
                  Advanced Settings
                </span>
                <Icon name={advancedOpen ? 'chevronDown' : 'chevronRight'} size={18} className="text-content-muted" />
              </button>
              {advancedOpen && (
                <div className="border-t border-border p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Select
                      label="Training Method"
                      value={form.advanced.method}
                      onChange={(e) => setAdvanced('method', e.target.value)}
                      options={TRAINING_METHODS.map((m) => ({ value: m.id, label: m.name }))}
                    />
                    <Select
                      label="Mixed Precision"
                      value={form.advanced.mixedPrecision}
                      onChange={(e) => setAdvanced('mixedPrecision', e.target.value)}
                      options={[
                        { value: 'bf16', label: 'bf16' },
                        { value: 'fp16', label: 'fp16' },
                        { value: 'none', label: 'None (fp32)' },
                      ]}
                    />
                    <Input
                      label="Weight Decay"
                      type="number"
                      step="0.001"
                      value={form.advanced.weightDecay}
                      onChange={(e) => setAdvanced('weightDecay', e.target.value)}
                      error={showError(advancedErrors.weightDecay)}
                    />
                    <Input
                      label="Warmup Ratio"
                      type="number"
                      step="0.01"
                      value={form.advanced.warmupRatio}
                      onChange={(e) => setAdvanced('warmupRatio', e.target.value)}
                      error={showError(advancedErrors.warmupRatio)}
                    />
                    <Input
                      label="Random Seed"
                      type="number"
                      step="1"
                      value={form.advanced.randomSeed}
                      onChange={(e) => setAdvanced('randomSeed', e.target.value)}
                      error={showError(advancedErrors.randomSeed)}
                    />
                    <div className="flex items-end pb-1">
                      <Toggle
                        checked={form.advanced.gradientCheckpointing}
                        onChange={(checked) => setAdvanced('gradientCheckpointing', checked)}
                        label="Gradient Checkpointing"
                        description="Trade compute for lower VRAM usage."
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Summary sidebar */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-24">
            <Card title="Configuration Summary" description="Updates as you configure the job.">
              <dl className="divide-y divide-border/60">
                <SummaryRow label="Job Name" value={form.name} missing={missing.name} />
                <SummaryRow label="Training mode" value={form.trainingMode === 'distributed' ? 'Distributed fine-tuning' : 'Simple fine-tuning'} />
                <SummaryRow label="Receiver" value={form.trainingMode === 'distributed' ? `${selectedReceivers.length} live receivers` : selectedReceiver?.id} missing={missing.receiver} />
                {form.trainingMode === 'distributed' && <SummaryRow label="Synchronization" value={form.synchronizationStrategy === 'adaptive' ? 'Adaptive synchronization' : 'Per-step synchronization'} />}
                <SummaryRow label="Model" value={selectedModel?.name} missing={missing.model} />
                <SummaryRow
                  label="Dataset"
                  value={form.dataset ? `${form.dataset.name} (${formatBytes(form.dataset.sizeBytes)})` : null}
                  missing={missing.dataset}
                />
                <SummaryRow label="Epochs" value={form.params.epochs} missing={!!paramErrors.epochs} />
                <SummaryRow label="Learning Rate" value={form.params.learningRate} missing={!!paramErrors.learningRate} />
                <SummaryRow label="Batch Size" value={form.params.batchSize} missing={!!paramErrors.batchSize} />
                <SummaryRow
                  label="Max Sequence Length"
                  value={form.params.maxSeqLength}
                  missing={!!paramErrors.maxSeqLength}
                />
                {estimate && (
                  <SummaryRow label="Projected Total" value={formatInr(estimate.estimatedTotalInr)} />
                )}
              </dl>

              <div className="mt-5">
                <Button fullWidth size="lg" icon="play" onClick={handleStart} disabled={!canStart} loading={submitting}>
                  {estimate ? `Pay ${formatInr(estimate.basePriceInr)} & Start Training` : 'Start Training'}
                </Button>
                {!canStart && (
                  <p className="mt-2 text-center text-xs text-content-muted">
                    Complete all required fields to start training.
                  </p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      <PaymentModal
        open={!!pendingConfig}
        onClose={() => setPendingConfig(null)}
        title="Base fee — unlocks job dispatch"
        description={`Training ${selectedModel?.name || 'your model'} on this dataset. The remainder is billed after training finishes, before you can download the result.`}
        amountInr={estimate?.basePriceInr}
        onConfirm={handleConfirmPayment}
        processingLabel={submitting ? uploadStatus : 'Authorize & start'}
      />
      </div>
    </PageContainer>
  )
}
