export const JOB_STATUS = {
  AWAITING_RECEIVER: 'Waiting for receiver',
  INITIALIZING: 'Initializing',
  PREPARING: 'Preparing',
  DOWNLOADING: 'Downloading Model',
  LOADING_DATASET: 'Loading Dataset',
  STARTING: 'Starting Training',
  RUNNING: 'Running',
  PAUSED: 'Paused',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  CANCELED: 'Canceled',
}

export const ACTIVE_STATUSES = [
  JOB_STATUS.AWAITING_RECEIVER,
  JOB_STATUS.INITIALIZING,
  JOB_STATUS.PREPARING,
  JOB_STATUS.DOWNLOADING,
  JOB_STATUS.LOADING_DATASET,
  JOB_STATUS.STARTING,
  JOB_STATUS.RUNNING,
  JOB_STATUS.PAUSED,
]

export const TERMINAL_STATUSES = [
  JOB_STATUS.COMPLETED,
  JOB_STATUS.FAILED,
  JOB_STATUS.CANCELED,
]

export function isActiveStatus(status) {
  return ACTIVE_STATUSES.includes(status)
}

export function isTerminalStatus(status) {
  return TERMINAL_STATUSES.includes(status)
}
