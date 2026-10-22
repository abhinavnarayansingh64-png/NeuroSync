import { useCallback, useMemo } from 'react'
import { trpc } from '../lib/trpc'

const STATUS_LABELS = {
  available: 'Available',
  busy: 'Busy',
  offline: 'Offline',
  maintenance: 'Maintenance',
}

export function normalizeReceiver(receiver) {
  const capabilities = receiver.capabilities && typeof receiver.capabilities === 'object' ? receiver.capabilities : {}
  return {
    ...receiver,
    status: STATUS_LABELS[receiver.availability] || 'Offline',
    vram: `${receiver.vramGb} GB`,
    cpu: capabilities.cpu || 'Not listed',
    ram: capabilities.ram || 'Not listed',
    activity: capabilities.activity || 'Directory listed',
  }
}

export function useReceiverDirectory() {
  const query = trpc.catalog.receivers.useQuery(undefined, { staleTime: 30_000 })
  const receivers = useMemo(() => (query.data || []).map(normalizeReceiver), [query.data])
  const getReceiverById = useCallback(
    (receiverId) => receivers.find((receiver) => receiver.id === receiverId) || null,
    [receivers],
  )

  return { ...query, receivers, getReceiverById }
}
