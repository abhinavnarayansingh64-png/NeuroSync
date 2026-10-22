/**
 * Settings (PRD Section 5: Settings). Theme, notification preferences, default
 * training parameters, download directory, automatic model cleanup and cache
 * management. Changes persist immediately via SettingsContext.
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings, DEFAULT_SETTINGS } from '../contexts/SettingsContext'
import { useReceiverDirectory } from '../hooks/useReceiverDirectory'
import { useToast } from '../contexts/ToastContext'
import { PageContainer, PageHeader } from '../components/ui/PageContainer'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Toggle, Select } from '../components/ui/Field'
import { Button } from '../components/ui/Button'
import { validateNumberInRange, isFormValid } from '../utils/validation'

const PARAM_FIELDS = [
  { key: 'epochs', label: 'Epochs', rule: { min: 1, max: 100, integer: true, label: 'Epochs' }, step: '1' },
  { key: 'learningRate', label: 'Learning Rate', rule: { min: 0.000001, max: 1, label: 'Learning Rate' }, step: '0.0001' },
  { key: 'batchSize', label: 'Batch Size', rule: { min: 1, max: 128, integer: true, label: 'Batch Size' }, step: '1' },
  {
    key: 'gradientAccumulation',
    label: 'Gradient Accumulation',
    rule: { min: 1, max: 64, integer: true, label: 'Gradient Accumulation' },
    step: '1',
  },
  {
    key: 'maxSeqLength',
    label: 'Max Sequence Length',
    rule: { min: 128, max: 8192, integer: true, label: 'Max Sequence Length' },
    step: '1',
  },
]

const NOTIFICATION_OPTIONS = [
  { key: 'trainingStarted', label: 'Training started, paused & resumed' },
  { key: 'trainingCompleted', label: 'Training completed' },
  { key: 'trainingFailed', label: 'Training failed or cancelled' },
  { key: 'receiverEvents', label: 'Receiver & model events' },
]

export default function Settings() {
  const { settings, updateSettings, updateNotificationPreference, updateDefaultParams, resetSettings } = useSettings()
  const { receivers, isLoading: receiversLoading, isError: receiversError } = useReceiverDirectory()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [params, setParams] = useState(() => {
    const initial = {}
    PARAM_FIELDS.forEach(({ key }) => {
      initial[key] = String(settings.defaultParams[key])
    })
    return initial
  })

  const paramErrors = useMemo(() => {
    const errors = {}
    PARAM_FIELDS.forEach(({ key, rule }) => {
      errors[key] = validateNumberInRange(params[key], rule)
    })
    return errors
  }, [params])

  const saveDefaults = () => {
    if (!isFormValid(paramErrors)) return
    const numeric = {}
    PARAM_FIELDS.forEach(({ key }) => {
      numeric[key] = Number(params[key])
    })
    updateDefaultParams(numeric)
    toast.success('Default training parameters saved')
  }

  const handleReset = () => {
    resetSettings()
    const restored = {}
    PARAM_FIELDS.forEach(({ key }) => {
      restored[key] = String(DEFAULT_SETTINGS.defaultParams[key])
    })
    setParams(restored)
    toast.success('Settings reset to defaults')
  }

  const switchRole = async (role) => {
    if (role === settings.workspaceRole) return
    const result = await updateSettings({ workspaceRole: role })
    if (!result.success) {
      toast.error('Unable to switch workspace. Please try again.')
      return
    }
    toast.success(`Switched to ${role === 'receiver' ? 'Receiver' : 'Sender'} workspace`)
    navigate(role === 'receiver' ? '/receiver' : '/dashboard')
  }

  return (
    <PageContainer size="narrow">
      <PageHeader title="Settings" description="Configure NeuroSync to match your workflow." />

      <div className="space-y-6">
        {/* Workspace role */}
        <Card
          title="Workspace Role"
          description="Which side of the marketplace you're using. This drives the navigation you see."
        >
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'sender', label: 'Sender', hint: 'Send training jobs' },
              { key: 'receiver', label: 'Receiver', hint: 'Run jobs on my GPU' },
            ].map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => switchRole(option.key)}
                className={[
                  'rounded-xl border p-4 text-left transition-colors',
                  settings.workspaceRole === option.key
                    ? 'border-accent-border bg-accent-soft'
                    : 'border-border bg-surface hover:bg-card-hover',
                ].join(' ')}
              >
                <p
                  className={
                    settings.workspaceRole === option.key
                      ? 'text-sm font-semibold text-accent'
                      : 'text-sm font-semibold text-content-primary'
                  }
                >
                  {option.label}
                </p>
                <p className="mt-1 text-xs text-content-muted">{option.hint}</p>
              </button>
            ))}
          </div>
        </Card>

        {/* Notifications */}
        <Card title="Notifications" description="Choose which events add an in-app notification.">
          <div className="space-y-4">
            {NOTIFICATION_OPTIONS.map((option) => (
              <Toggle
                key={option.key}
                checked={settings.notifications[option.key]}
                onChange={(checked) => updateNotificationPreference(option.key, checked)}
                label={option.label}
              />
            ))}
          </div>
        </Card>

        {/* Receiver identity */}
        <Card
          title="Receiver Machine"
          description="If you run a GPU machine that accepts training jobs, identify it here to unlock the Receiver Dashboard."
        >
          <Select
            label="My receiver"
            value={settings.myReceiverId || ''}
            onChange={(e) => updateSettings({ myReceiverId: e.target.value || null })}
            hint={
              receiversError
                ? 'The persistent receiver directory is unavailable. Try refreshing before selecting a machine.'
                : receiversLoading
                ? 'Loading the persistent receiver directory…'
                : 'Server-backed receiver directory. Switch to Receiver in the sidebar to monitor jobs.'
            }
            options={[
              { value: '', label: "I don't operate a receiver" },
              ...receivers.map((receiver) => ({
                value: receiver.id,
                label: `${receiver.id} — ${receiver.gpu} (${receiver.vram})`,
              })),
            ]}
          />
        </Card>

        {/* Default training parameters */}
        <Card
          title="Default Training Parameters"
          description="These pre-fill the training workspace for every new job."
          actions={<Button size="sm" onClick={saveDefaults} disabled={!isFormValid(paramErrors)}>Save</Button>}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {PARAM_FIELDS.map((field) => (
              <Input
                key={field.key}
                label={field.label}
                type="number"
                step={field.step}
                value={params[field.key]}
                onChange={(e) => setParams((current) => ({ ...current, [field.key]: e.target.value }))}
                error={paramErrors[field.key]}
              />
            ))}
          </div>
        </Card>

        {/* Storage & cache */}
        <Card title="Storage & Cache">
          <div className="space-y-5">
            <Input
              label="Download Directory"
              value={settings.downloadDirectory}
              onChange={(e) => updateSettings({ downloadDirectory: e.target.value })}
              hint="Where receivers save trained models and adapters."
            />
            <Toggle
              checked={settings.autoModelCleanup}
              onChange={(checked) => updateSettings({ autoModelCleanup: checked })}
              label="Automatic model cleanup"
              description="Remove old cached base models to reclaim disk space."
            />
            <Toggle
              checked={settings.cacheEnabled}
              onChange={(checked) => updateSettings({ cacheEnabled: checked })}
              label="Cache downloaded models"
              description="Reuse downloaded foundation models across jobs to avoid re-downloading."
            />
            <div className="flex items-center justify-between gap-4 border-t border-border/60 pt-4">
              <div>
                <p className="text-sm font-medium text-content-primary">Clear model cache</p>
                <p className="mt-0.5 text-xs text-content-secondary">Free up space used by cached base models.</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => toast.success('Model cache cleared')}>
                Clear cache
              </Button>
            </div>
          </div>
        </Card>

        {/* Reset */}
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-content-primary">Reset all settings</p>
              <p className="mt-0.5 text-xs text-content-secondary">Restore every setting to its default value.</p>
            </div>
            <Button variant="danger" size="sm" onClick={handleReset}>
              Reset to defaults
            </Button>
          </div>
        </Card>
      </div>
    </PageContainer>
  )
}
