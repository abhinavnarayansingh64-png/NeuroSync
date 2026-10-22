/**
 * ReceiversContext — live GPU receiver registry.
 *
 * Connects to the NeuroSync backend (backend/main.py) over WebSocket and
 * receives a push every time any receiver's hardware/status changes, so
 * every open dashboard updates simultaneously. If no backend is configured
 * or reachable, it falls back to the static demo catalog in
 * `data/receivers.js` — the app is still fully usable standalone, it just
 * won't reflect real hardware.
 *
 * Configure the backend URL via VITE_RECEIVERS_WS_URL (see .env.example).
 * Defaults to ws://localhost:8000/ws/dashboard for local development.
 */

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getReceivers as getDemoReceivers } from '../data/receivers'

const ReceiversContext = createContext(null)

const WS_URL = import.meta.env.VITE_RECEIVERS_WS_URL || 'ws://localhost:8000/ws/dashboard'
const MAX_BACKOFF_MS = 15000

export function ReceiversProvider({ children }) {
  const [liveReceivers, setLiveReceivers] = useState(null) // null = not connected yet
  const [connected, setConnected] = useState(false)
  const backoffRef = useRef(1000)
  const closedByUsRef = useRef(false)

  useEffect(() => {
    let socket
    let retryTimer

    const connect = () => {
      try {
        socket = new WebSocket(WS_URL)
      } catch {
        scheduleRetry()
        return
      }

      socket.onopen = () => {
        setConnected(true)
        backoffRef.current = 1000
      }

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'snapshot' || data.type === 'update') {
            setLiveReceivers(data.receivers)
          }
        } catch {
          // ignore malformed frames
        }
      }

      socket.onclose = () => {
        setConnected(false)
        if (!closedByUsRef.current) scheduleRetry()
      }

      socket.onerror = () => {
        socket.close()
      }
    }

    const scheduleRetry = () => {
      clearTimeout(retryTimer)
      retryTimer = setTimeout(connect, backoffRef.current)
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS)
    }

    connect()

    return () => {
      closedByUsRef.current = true
      clearTimeout(retryTimer)
      socket?.close()
    }
  }, [])

  const value = useMemo(() => {
    // Live receivers (from the backend) only carry vramGb/ramGb as numbers;
    // demo receivers already include formatted vram/ram strings. Normalize
    // so every consumer can rely on both shapes existing either way.
    const raw = connected && liveReceivers ? liveReceivers : getDemoReceivers()
    const receivers = raw.map((r) => ({
      ...r,
      vram: r.vram ?? (r.vramGb != null ? `${r.vramGb} GB` : '—'),
      ram: r.ram ?? (r.ramGb != null ? `${r.ramGb} GB` : '—'),
    }))
    return {
      receivers,
      connected,
      isLive: connected,
      getReceivers: () => receivers,
      getAvailableReceivers: () => receivers.filter((r) => r.status === 'Available'),
      getReceiverById: (id) => receivers.find((r) => r.id === id) || null,
    }
  }, [connected, liveReceivers])

  return <ReceiversContext.Provider value={value}>{children}</ReceiversContext.Provider>
}

export function useReceivers() {
  const context = useContext(ReceiversContext)
  if (!context) {
    throw new Error('useReceivers must be used within a ReceiversProvider.')
  }
  return context
}
