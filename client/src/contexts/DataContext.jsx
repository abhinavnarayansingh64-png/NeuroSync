import { createContext, useCallback, useContext, useMemo } from 'react'
import { trpc } from '../lib/trpc'
import { useAuth } from './AuthContext'

const DataContext = createContext(null)

const UI_STATUS = {
  draft: 'Initializing',
  awaiting_payment: 'Initializing',
  awaiting_receiver: 'Waiting for receiver',
  queued: 'Initializing',
  provisioning: 'Preparing',
  loading_dataset: 'Loading Dataset',
  running: 'Running',
  paused: 'Paused',
  cancelling: 'Preparing',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Canceled',
}

function toWorkspaceJob(job) {
  return { ...job, backendStatus: job.status, status: UI_STATUS[job.status] || job.status }
}

function deriveServerState(job) {
  const config = job.config || {}
  const params = config.params || {}
  const raw = job.metrics || {}
  const totalEpochs = Number(params.epochs || 1)
  const completed = job.status === 'completed'
  const progress = Number(raw.progress ?? (completed ? 100 : 0))
  const totalSteps = Number(raw.totalSteps ?? Math.max(1, totalEpochs * 100))
  const currentStep = Number(raw.currentStep ?? Math.round((progress / 100) * totalSteps))
  const currentEpoch = Number(raw.currentEpoch ?? Math.min(totalEpochs, Math.max(1, Math.ceil((progress / 100) * totalEpochs))))
  const elapsedSec = Number(raw.elapsedSec ?? (job.startedAt ? Math.max(0, (Date.now() - new Date(job.startedAt).getTime()) / 1000) : 0))
  const remainingSec = Number(raw.remainingSec ?? (progress > 0 && progress < 100 ? elapsedSec * (100 - progress) / progress : 0))
  return {
    status: job.status,
    progress,
    currentEpoch,
    totalEpochs,
    currentStep,
    totalSteps,
    elapsedSec,
    remainingSec,
    metrics: {
      gpuUtil: Number(raw.gpuUtil ?? 0),
      vramUsedGb: Number(raw.vramUsedGb ?? 0),
      vramTotalGb: Number(raw.vramTotalGb ?? config.receiver?.vramGb ?? 0),
      loss: Number(raw.loss ?? 0),
      learningRate: raw.learningRate ?? params.learningRate ?? 0,
      speed: Number(raw.speed ?? 0),
    },
    metricHistory: Array.isArray(raw.metricHistory)
      ? raw.metricHistory.filter((sample) => sample && typeof sample === 'object')
      : [],
  }
}

export function DataProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const utils = trpc.useUtils()
  const queryOptions = { enabled: isAuthenticated, retry: 2, retryDelay: 750, refetchInterval: 4_000, refetchOnWindowFocus: true }
  const jobsQuery = trpc.jobs.list.useQuery(undefined, queryOptions)
  const modelsQuery = trpc.models.list.useQuery(undefined, queryOptions)
  const notificationsQuery = trpc.notifications.list.useQuery(undefined, queryOptions)
  const gpuModeQuery = trpc.gpu.mode.useQuery(undefined, { enabled: isAuthenticated, retry: false })
  const receiversQuery = trpc.catalog.receivers.useQuery(undefined, queryOptions)
  const membershipQuery = trpc.workspace.membership.useQuery(undefined, queryOptions)
  const createJob = trpc.jobs.create.useMutation()
  const settleJob = trpc.jobs.confirmSettlement.useMutation()
  const pause = trpc.jobs.pause.useMutation()
  const resume = trpc.jobs.resume.useMutation()
  const cancel = trpc.jobs.cancel.useMutation()
  const removeJob = trpc.jobs.delete.useMutation()
  const rename = trpc.models.rename.useMutation()
  const removeModel = trpc.models.delete.useMutation()
  const markRead = trpc.notifications.markRead.useMutation()
  const markAllRead = trpc.notifications.markAllRead.useMutation()
  const clear = trpc.notifications.clear.useMutation()
  const activatePremiumTrial = trpc.workspace.activatePremiumTrial.useMutation()
  const createPremiumCheckout = trpc.workspace.createPremiumCheckout.useMutation()

  const jobs = useMemo(() => (jobsQuery.data ?? []).map(toWorkspaceJob), [jobsQuery.data])
  const models = modelsQuery.data ?? []
  const notifications = useMemo(() => (notificationsQuery.data ?? []).map((item) => ({ ...item, read: !!item.readAt })), [notificationsQuery.data])

  const refresh = useCallback(async () => {
    await Promise.all([
      utils.jobs.list.invalidate(),
      utils.models.list.invalidate(),
      utils.notifications.list.invalidate(),
      utils.catalog.receivers.invalidate(),
      utils.workspace.membership.invalidate(),
    ])
  }, [utils])

  const startJob = useCallback(async (config) => {
    const estimated = config.pricing?.basePriceInr ?? config.pricing?.baseFee ?? config.pricing?.total ?? 0
    const { file: _file, ...datasetMetadata } = config.dataset || {}
    const persistedConfig = { ...config, dataset: { ...datasetMetadata, storageKey: config.datasetKey, storageUrl: config.datasetUrl } }
    const job = await createJob.mutateAsync({
      name: config.name,
      receiverId: config.receiver?.id,
      receiverIds: config.trainingMode === 'distributed' ? config.receivers?.map((receiver) => receiver.id) : undefined,
      baseModelId: config.modelId,
      config: persistedConfig,
      datasetName: config.dataset?.name,
      datasetKey: config.datasetKey,
      datasetUrl: config.datasetUrl,
      estimatedCost: String(Number(estimated || 0).toFixed(2)),
      provider: 'runpod',
      trainingMode: config.trainingMode ?? 'single',
      synchronizationStrategy: config.trainingMode === 'distributed' ? config.synchronizationStrategy : undefined,
    })
    const settled = await settleJob.mutateAsync({ jobId: job.id })
    await refresh()
    return settled.job || job
  }, [createJob, refresh, settleJob])

  const pauseJob = useCallback(async (jobId) => { await pause.mutateAsync({ jobId }); await refresh() }, [pause, refresh])
  const resumeJob = useCallback(async (jobId) => { await resume.mutateAsync({ jobId }); await refresh() }, [refresh, resume])
  const cancelJob = useCallback(async (jobId) => { await cancel.mutateAsync({ jobId }); await refresh() }, [cancel, refresh])
  const deleteJob = useCallback(async (jobId) => { await removeJob.mutateAsync({ jobId }); await refresh() }, [refresh, removeJob])
  const renameModel = useCallback(async (modelId, name) => { await rename.mutateAsync({ modelId, name: name.trim() }); await refresh() }, [refresh, rename])
  const deleteModel = useCallback(async (modelId) => { await removeModel.mutateAsync({ modelId }); await refresh() }, [refresh, removeModel])
  const markNotificationRead = useCallback(async (id) => { await markRead.mutateAsync({ id }); await refresh() }, [markRead, refresh])
  const markAllNotificationsRead = useCallback(async () => { await markAllRead.mutateAsync(); await refresh() }, [markAllRead, refresh])
  const clearNotifications = useCallback(async () => { await clear.mutateAsync(); await refresh() }, [clear, refresh])
  const beginPremiumTrial = useCallback(async () => {
    const membership = await activatePremiumTrial.mutateAsync()
    utils.workspace.membership.setData(undefined, membership)
    await refresh()
    return membership
  }, [activatePremiumTrial, refresh, utils.workspace.membership])
  const beginPremiumCheckout = useCallback(async () => createPremiumCheckout.mutateAsync(), [createPremiumCheckout])

  const unreadCount = useMemo(() => notifications.filter((item) => !item.read).length, [notifications])
  const getJob = useCallback((jobId) => jobs.find((job) => job.id === jobId) || null, [jobs])
  const getJobState = useCallback((job) => deriveServerState(job), [])

  const value = useMemo(() => ({
    jobs, models, notifications, receivers: receiversQuery.data ?? [], membership: membershipQuery.data ?? { plan: 'free' }, unreadCount, gpuMode: gpuModeQuery.data?.mode ?? 'simulation',
    receiverDirectoryError: receiversQuery.error, refreshReceivers: () => utils.catalog.receivers.invalidate(),
    isLoading: jobsQuery.isLoading || modelsQuery.isLoading || receiversQuery.isLoading,
    startJob, pauseJob, resumeJob, cancelJob, deleteJob, getJob, getJobState,
    renameModel, deleteModel,
    addNotification: () => {},
    markNotificationRead, markAllNotificationsRead, clearNotifications, beginPremiumTrial, beginPremiumCheckout,
  }), [
    jobs, models, notifications, receiversQuery.data, receiversQuery.error, membershipQuery.data, unreadCount, gpuModeQuery.data?.mode, jobsQuery.isLoading, modelsQuery.isLoading, receiversQuery.isLoading, utils.catalog.receivers,
    startJob, pauseJob, resumeJob, cancelJob, deleteJob, getJob, getJobState,
    renameModel, deleteModel, markNotificationRead, markAllNotificationsRead, clearNotifications, beginPremiumTrial, beginPremiumCheckout,
  ])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const context = useContext(DataContext)
  if (!context) throw new Error('useData must be used within a DataProvider.')
  return context
}
