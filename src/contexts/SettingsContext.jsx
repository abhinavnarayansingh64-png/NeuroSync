/**
 * Application settings context (PRD Section 5: Settings).
 *
 * Persists user preferences to localStorage. `defaultParams` seeds the
 * training workspace so users can standardise their common configuration.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { STORAGE_KEYS, readStorage, writeStorage } from '../services/storage'

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
  // 'sender' | 'receiver' | null (null = not chosen yet, routes to /choose-role)
  workspaceRole: null,
}

/** Deep-merge persisted settings over defaults so new keys are always present. */
function mergeSettings(persisted) {
  if (!persisted) return DEFAULT_SETTINGS
  return {
    ...DEFAULT_SETTINGS,
    ...persisted,
    notifications: { ...DEFAULT_SETTINGS.notifications, ...(persisted.notifications || {}) },
    defaultParams: { ...DEFAULT_SETTINGS.defaultParams, ...(persisted.defaultParams || {}) },
  }
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => mergeSettings(readStorage(STORAGE_KEYS.settings)))

  useEffect(() => {
    writeStorage(STORAGE_KEYS.settings, settings)
  }, [settings])

  // Pick up settings changed in another tab (e.g. workspaceRole or
  // myReceiverId set from a different tab) — mirrors the same sync in
  // DataContext.
  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === STORAGE_KEYS.settings) {
        setSettings(mergeSettings(readStorage(STORAGE_KEYS.settings)))
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  /** Shallow-update top-level settings keys. */
  const updateSettings = useCallback((patch) => {
    setSettings((current) => ({ ...current, ...patch }))
  }, [])

  /** Update a single notification preference. */
  const updateNotificationPreference = useCallback((key, enabled) => {
    setSettings((current) => ({
      ...current,
      notifications: { ...current.notifications, [key]: enabled },
    }))
  }, [])

  /** Replace the default training parameters. */
  const updateDefaultParams = useCallback((params) => {
    setSettings((current) => ({
      ...current,
      defaultParams: { ...current.defaultParams, ...params },
    }))
  }, [])

  const resetSettings = useCallback(() => {
    setSettings((current) => ({
      ...DEFAULT_SETTINGS,
      // Identity choices, not "preferences" — a settings reset shouldn't
      // silently kick the user back to /choose-role or unset which machine
      // they operate.
      workspaceRole: current.workspaceRole,
      myReceiverId: current.myReceiverId,
    }))
  }, [])

  const value = useMemo(
    () => ({
      settings,
      updateSettings,
      updateNotificationPreference,
      updateDefaultParams,
      resetSettings,
    }),
    [settings, updateSettings, updateNotificationPreference, updateDefaultParams, resetSettings],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider.')
  }
  return context
}
