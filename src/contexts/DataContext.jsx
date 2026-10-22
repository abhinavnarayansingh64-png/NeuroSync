/**
 * Data context — the single source of truth for training jobs, trained
 * models and in-app notifications. It also owns the live "ticker" that
 * advances the training simulation once per second and reacts to lifecycle
 * transitions (notifications + trained-model creation).
 *
 * All state is persisted to localStorage so the entire workspace — including
 * in-progress training — survives a page refresh.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { STORAGE_KEYS, readStorage, writeStorage } from '../services/storage'
import { formatJobId, uid } from '../utils/id'
import { getModelById } from '../data/models'
import {
  JOB_STATUS,
  advanceJob,
  cancelJob as cancelJobState,
  createJob,
  deriveState,
  isActiveStatus,
  pauseJob as pauseJobState,
  resumeJob as resumeJobState,
} from '../services/trainingSimulator'
import { useSettings } from './SettingsContext'

const DataContext = createContext(null)

const TICK_MS = 1000

/** Build a trained-model record from a completed job. */
function buildModelFromJob(job) {
  const base = getModelById(job.config?.modelId)
  // Adapter weights are small relative to the base model; scale loosely by
  // the base model size so larger models yield larger adapters.
  const baseSizeGb = base ? parseFloat(base.size) || 8 : 8
  const adapterMb = Math.round(60 + baseSizeGb * 6)
  return {
    id: uid('model'),
    name: `${job.name}-ft`,
    baseModel: base?.name || job.config?.modelId || 'Unknown',
    baseModelId: job.config?.modelId || null,
    createdAt: job.completedAt || Date.now(),
    sizeBytes: adapterMb * 1024 * 1024,
    jobId: job.id,
    jobName: job.name,
    method: (job.config?.advanced?.method || 'lora').toUpperCase(),
  }
}

export function DataProvider({ children }) {
  const { settings } = useSettings()
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const [jobs, setJobs] = useState(() => readStorage(STORAGE_KEYS.jobs, []))
  const [models, setModels] = useState(() => readStorage(STORAGE_KEYS.models, []))
  const [notifications, setNotifications] = useState(() => readStorage(STORAGE_KEYS.notifications, []))

  // Refs mirror state so the interval callback always reads current values
  // without needing to be re-created on every render.
  const jobsRef = useRef(jobs)
  jobsRef.current = jobs
  const modelsRef = useRef(models)
  modelsRef.current = models

  // Persist on change. Block bodies so the effect returns undefined (not the
  // boolean from writeStorage, which React would treat as a cleanup function).
  useEffect(() => {
    writeStorage(STORAGE_KEYS.jobs, jobs)
  }, [jobs])
  useEffect(() => {
    writeStorage(STORAGE_KEYS.models, models)
  }, [models])
  useEffect(() => {
    writeStorage(STORAGE_KEYS.notifications, notifications)
  }, [notifications])

  // Pick up jobs/models created or advanced in *other* tabs — e.g. a job
  // sent to your own GPU from a Sender tab while the Receiver Dashboard is
  // open in another tab. The `storage` event only fires in tabs other than
  // the one that wrote the change, so this is exactly the cross-tab sync
  // that was missing.
  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === STORAGE_KEYS.jobs) {
        setJobs(readStorage(STORAGE_KEYS.jobs, []))
      } else if (event.key === STORAGE_KEYS.models) {
        setModels(readStorage(STORAGE_KEYS.models, []))
      } else if (event.key === STORAGE_KEYS.notifications) {
        setNotifications(readStorage(STORAGE_KEYS.notifications, []))
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const addNotification = useCallback((notification) => {
    const entry = {
      id: uid('notif'),
      createdAt: Date.now(),
      read: false,
      type: 'info',
      ...notification,
    }
    setNotifications((current) => [entry, ...current].slice(0, 100))
  }, [])

  /** Whether a notification category is enabled in settings. */
  const notificationEnabled = useCallback((key) => {
    const prefs = settingsRef.current?.notifications
    return prefs ? prefs[key] !== false : true
  }, [])

  // ---- Live ticker -------------------------------------------------------
  useEffect(() => {
    const tick = () => {
      const current = jobsRef.current
      if (!current.some((job) => isActiveStatus(job.status) && job.status !== JOB_STATUS.PAUSED)) {
        return // nothing running — skip work
      }

      const now = Date.now()
      const completedModels = []
      const pendingNotifications = []

      const next = current.map((job) => {
        if (!isActiveStatus(job.status) || job.status === JOB_STATUS.PAUSED) return job

        const advanced = advanceJob(job, now)
        if (advanced === job) return job

        // React to status transitions.
        if (advanced.status !== job.status) {
          if (advanced.status === JOB_STATUS.RUNNING && notificationEnabled('trainingStarted')) {
            pendingNotifications.push({
              type: 'success',
              title: 'Training started',
              message: `${advanced.name} is now training on ${advanced.config?.receiver?.id}.`,
              jobId: advanced.id,
            })
          }
          if (advanced.status === JOB_STATUS.LOADING_DATASET && notificationEnabled('receiverEvents')) {
            pendingNotifications.push({
              type: 'info',
              title: 'Model download complete',
              message: `${getModelById(advanced.config?.modelId)?.name || 'Model'} is ready on ${advanced.config?.receiver?.id}.`,
              jobId: advanced.id,
            })
          }
          if (advanced.status === JOB_STATUS.COMPLETED) {
            // Guard against creating a duplicate model if one already exists
            // for this job (e.g. a Running job completing again after reload).
            const alreadyHasModel = modelsRef.current.some((m) => m.jobId === advanced.id)
            if (!alreadyHasModel) completedModels.push(buildModelFromJob(advanced))
            if (notificationEnabled('trainingCompleted')) {
              pendingNotifications.push({
                type: 'success',
                title: 'Training completed',
                message: `${advanced.name} finished successfully.`,
                jobId: advanced.id,
              })
            }
          }
        }
        return advanced
      })

      // Apply advancement with a functional update that preserves any job a
      // concurrent user action changed since this tick's snapshot: only swap in
      // the advanced job when the live job is still the exact snapshot object.
      const advancedById = new Map(next.map((job) => [job.id, job]))
      const snapshotById = new Map(current.map((job) => [job.id, job]))
      setJobs((live) =>
        live.map((job) => {
          const advanced = advancedById.get(job.id)
          const snapshot = snapshotById.get(job.id)
          return advanced && snapshot === job ? advanced : job
        }),
      )
      if (completedModels.length) {
        setModels((current2) => {
          const fresh = completedModels.filter((m) => !current2.some((e) => e.jobId === m.jobId))
          return fresh.length ? [...fresh, ...current2] : current2
        })
      }
      pendingNotifications.forEach(addNotification)
    }

    const interval = setInterval(tick, TICK_MS)
    return () => clearInterval(interval)
  }, [addNotification, notificationEnabled])

  // ---- Job actions -------------------------------------------------------

  /** Create and start a training job from a validated configuration. */
  const startJob = useCallback(
    (config) => {
      // Derive the next sequence from BOTH the persisted counter and the
      // highest existing job number, so a failed counter write (quota/private
      // mode) can never produce a duplicate Job ID within the session.
      const storedCounter = readStorage(STORAGE_KEYS.jobSequence, 0) || 0
      const highestExisting = jobsRef.current.reduce((max, job) => {
        const num = parseInt(String(job.id).replace(/\D/g, ''), 10)
        return Number.isFinite(num) && num > max ? num : max
      }, 0)
      const sequence = Math.max(storedCounter, highestExisting) + 1
      writeStorage(STORAGE_KEYS.jobSequence, sequence)
      const id = formatJobId(sequence)
      const job = createJob(config, id)
      setJobs((current) => [job, ...current])
      if (notificationEnabled('receiverEvents')) {
        addNotification({
          type: 'info',
          title: 'Job created',
          message: `${job.name} assigned to ${config.receiver?.id}.`,
          jobId: id,
        })
      }
      return job
    },
    [addNotification, notificationEnabled],
  )

  const pauseJob = useCallback((jobId) => {
    setJobs((current) => current.map((job) => (job.id === jobId ? pauseJobState(job) : job)))
    if (notificationEnabled('trainingStarted')) {
      const job = jobsRef.current.find((j) => j.id === jobId)
      if (job) {
        addNotification({ type: 'warning', title: 'Training paused', message: `${job.name} was paused.`, jobId })
      }
    }
  }, [addNotification, notificationEnabled])

  const resumeJob = useCallback((jobId) => {
    setJobs((current) => current.map((job) => (job.id === jobId ? resumeJobState(job) : job)))
    if (notificationEnabled('trainingStarted')) {
      const job = jobsRef.current.find((j) => j.id === jobId)
      if (job) {
        addNotification({ type: 'info', title: 'Training resumed', message: `${job.name} resumed.`, jobId })
      }
    }
  }, [addNotification, notificationEnabled])

  const cancelJob = useCallback((jobId) => {
    setJobs((current) => current.map((job) => (job.id === jobId ? cancelJobState(job) : job)))
    const job = jobsRef.current.find((j) => j.id === jobId)
    if (job && notificationEnabled('trainingFailed')) {
      addNotification({ type: 'error', title: 'Training cancelled', message: `${job.name} was cancelled.`, jobId })
    }
  }, [addNotification, notificationEnabled])

  const deleteJob = useCallback((jobId) => {
    setJobs((current) => current.filter((job) => job.id !== jobId))
  }, [])

  const getJob = useCallback((jobId) => jobsRef.current.find((job) => job.id === jobId) || null, [])

  // ---- Model actions -----------------------------------------------------

  const renameModel = useCallback((modelId, name) => {
    setModels((current) => current.map((model) => (model.id === modelId ? { ...model, name: name.trim() } : model)))
  }, [])

  const deleteModel = useCallback((modelId) => {
    setModels((current) => current.filter((model) => model.id !== modelId))
  }, [])

  // ---- Notification actions ---------------------------------------------

  const markNotificationRead = useCallback((id) => {
    setNotifications((current) => current.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }, [])

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((current) => current.map((n) => ({ ...n, read: true })))
  }, [])

  const clearNotifications = useCallback(() => setNotifications([]), [])

  // ---- Derived selectors -------------------------------------------------

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications])

  const value = useMemo(
    () => ({
      jobs,
      models,
      notifications,
      unreadCount,
      // job actions
      startJob,
      pauseJob,
      resumeJob,
      cancelJob,
      deleteJob,
      getJob,
      getJobState: deriveState,
      // model actions
      renameModel,
      deleteModel,
      // notification actions
      addNotification,
      markNotificationRead,
      markAllNotificationsRead,
      clearNotifications,
    }),
    [
      jobs,
      models,
      notifications,
      unreadCount,
      startJob,
      pauseJob,
      resumeJob,
      cancelJob,
      deleteJob,
      getJob,
      renameModel,
      deleteModel,
      addNotification,
      markNotificationRead,
      markAllNotificationsRead,
      clearNotifications,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const context = useContext(DataContext)
  if (!context) {
    throw new Error('useData must be used within a DataProvider.')
  }
  return context
}
