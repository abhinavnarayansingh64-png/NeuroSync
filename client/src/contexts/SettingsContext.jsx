import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { trpc } from '../lib/trpc'
import { useAuth } from './AuthContext'

const SettingsContext = createContext(null)

export const DEFAULT_SETTINGS = {
  theme: 'dark',
  notifications: {
    trainingStarted: true,
    trainingCompleted: true,
    trainingFailed: true,
    receiverEvents: true,
  },
  defaultParams: {
    epochs: 3,
    learningRate: 0.0002,
    batchSize: 4,
    gradientAccumulation: 1,
    maxSeqLength: 1024,
  },
  downloadDirectory: '~/neurosync/models',
  autoModelCleanup: false,
  cacheEnabled: true,
  myReceiverId: null,
  workspaceRole: null,
}

function mergeSettings(persisted, workspaceRole = null) {
  const source = persisted && typeof persisted === 'object' ? persisted : {}
  return {
    ...DEFAULT_SETTINGS,
    ...source,
    workspaceRole: workspaceRole === 'unassigned' ? null : workspaceRole,
    notifications: { ...DEFAULT_SETTINGS.notifications, ...(source.notifications || {}) },
    defaultParams: { ...DEFAULT_SETTINGS.defaultParams, ...(source.defaultParams || {}) },
  }
}

function toPreferences(settings) {
  const { workspaceRole: _workspaceRole, ...preferences } = settings
  return preferences
}

export function SettingsProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const profileQuery = trpc.workspace.profile.useQuery(undefined, { enabled: isAuthenticated, retry: false, staleTime: 30_000 })
  const updatePreferences = trpc.workspace.updatePreferences.useMutation()
  const setRole = trpc.workspace.setRole.useMutation()
  const utils = trpc.useUtils()
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const settingsRef = useRef(DEFAULT_SETTINGS)

  useEffect(() => {
    const next = isAuthenticated && profileQuery.data
      ? mergeSettings(profileQuery.data.preferences, profileQuery.data.workspaceRole)
      : DEFAULT_SETTINGS
    settingsRef.current = next
    setSettings(next)
  }, [isAuthenticated, profileQuery.data])

  const updateSettings = useCallback(async (patch) => {
    const previous = settingsRef.current
    const next = mergeSettings({ ...previous, ...patch }, patch.workspaceRole ?? previous.workspaceRole)
    settingsRef.current = next
    setSettings(next)

    if (!isAuthenticated) return { success: false }
    try {
      const savedPreferences = await updatePreferences.mutateAsync({ preferences: toPreferences(next) })
      let persistedProfile = savedPreferences
      if (patch.workspaceRole && patch.workspaceRole !== previous.workspaceRole) {
        persistedProfile = await setRole.mutateAsync({ workspaceRole: patch.workspaceRole })
      }
      utils.workspace.profile.setData(undefined, persistedProfile)
      return { success: true }
    } catch (error) {
      settingsRef.current = previous
      setSettings(previous)
      console.error('[Settings] Unable to persist profile preferences', error)
      return { success: false }
    }
  }, [isAuthenticated, setRole, updatePreferences, utils.workspace.profile])

  const updateNotificationPreference = useCallback((key, enabled) => (
    updateSettings({ notifications: { ...settingsRef.current.notifications, [key]: enabled } })
  ), [updateSettings])

  const updateDefaultParams = useCallback((params) => (
    updateSettings({ defaultParams: { ...settingsRef.current.defaultParams, ...params } })
  ), [updateSettings])

  const resetSettings = useCallback(() => (
    updateSettings({
      ...DEFAULT_SETTINGS,
      workspaceRole: settingsRef.current.workspaceRole,
      myReceiverId: settingsRef.current.myReceiverId,
    })
  ), [updateSettings])

  const value = useMemo(() => ({
    settings,
    loading: isAuthenticated && profileQuery.isLoading,
    updateSettings,
    updateNotificationPreference,
    updateDefaultParams,
    resetSettings,
  }), [isAuthenticated, profileQuery.isLoading, resetSettings, settings, updateDefaultParams, updateNotificationPreference, updateSettings])

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (!context) throw new Error('useSettings must be used within a SettingsProvider.')
  return context
}
