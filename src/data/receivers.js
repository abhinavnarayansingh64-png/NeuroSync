/**
 * Mock receiver registry.
 *
 * In production these come from the FastAPI backend over a WebSocket
 * (PRD Section 3: Receiver Registry / Heartbeat). Receiver identity is
 * intentionally anonymous — no location, IP address, or host name — as
 * required by the security rules. The `getReceivers()` accessor returns a
 * fresh copy so callers cannot mutate the source catalog.
 */

const RECEIVERS = [
  {
    id: 'Receiver-001',
    status: 'Available',
    activity: 'Idle',
    gpu: 'RTX 4090',
    vram: '24 GB',
    vramGb: 24,
    cpu: 'Ryzen 9 7950X',
    ram: '64 GB',
  },
  {
    id: 'Receiver-002',
    status: 'Available',
    activity: 'Idle',
    gpu: 'RTX 4080',
    vram: '16 GB',
    vramGb: 16,
    cpu: 'Intel Core i9-13900K',
    ram: '32 GB',
  },
  {
    id: 'Receiver-003',
    status: 'Available',
    activity: 'Idle',
    gpu: 'A100',
    vram: '40 GB',
    vramGb: 40,
    cpu: 'AMD EPYC 7543',
    ram: '128 GB',
  },
  {
    id: 'Receiver-004',
    status: 'Busy',
    activity: 'Running a training job',
    gpu: 'RTX 3090',
    vram: '24 GB',
    vramGb: 24,
    cpu: 'Ryzen 7 5800X',
    ram: '32 GB',
  },
  {
    id: 'Receiver-005',
    status: 'Offline',
    activity: 'Disconnected',
    gpu: 'RTX 4070 Ti',
    vram: '12 GB',
    vramGb: 12,
    cpu: 'Intel Core i7-13700K',
    ram: '32 GB',
  },
]

/** Return a shallow copy of all receivers. */
export function getReceivers() {
  return RECEIVERS.map((receiver) => ({ ...receiver }))
}

/** Return only receivers currently able to accept a job. */
export function getAvailableReceivers() {
  return getReceivers().filter((receiver) => receiver.status === 'Available')
}

/** Look up a receiver by id. Returns null when not found. */
export function getReceiverById(id) {
  const found = RECEIVERS.find((receiver) => receiver.id === id)
  return found ? { ...found } : null
}
