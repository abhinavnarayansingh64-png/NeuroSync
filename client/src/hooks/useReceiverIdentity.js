import { useMemo } from 'react'
import { useData } from '../contexts/DataContext'
import { trpc } from '../lib/trpc'
import { desktopRuntime } from '../services/desktopRuntime'

export function getReceiverFingerprint() {
  const key = 'neurosync.receiver.fingerprint'
  const existing = window.localStorage.getItem(key)
  if (existing) return existing
  const next = `browser-${crypto.randomUUID()}`
  window.localStorage.setItem(key, next)
  return next
}

export function useReceiverIdentity() {
  const { receivers } = useData()
  const isDesktop = Boolean(desktopRuntime())
  const fingerprint = useMemo(() => getReceiverFingerprint(), [])
  const localReceiver = useMemo(
    () => isDesktop ? receivers.find((item) => item.deviceFingerprint === fingerprint) || null : null,
    [fingerprint, isDesktop, receivers],
  )
  const desktopReceiver = trpc.receivers.desktopReceiver.useQuery(undefined, {
    enabled: !isDesktop,
    staleTime: 15_000,
  })
  const receiver = localReceiver || desktopReceiver.data || null
  return { receiverId: receiver?.id || null, receiver }
}
