import { COOKIE_NAME } from '../const'

function previewAuthorizationHeader() {
  try {
    const mirroredCookies = sessionStorage.getItem('manus-cookie')
    const prefix = `${COOKIE_NAME}=`
    const match = mirroredCookies?.split(';').find((entry) => entry.trim().startsWith(prefix))
    const token = match?.trim().slice(prefix.length)
    return token ? `Bearer ${token}` : null
  } catch {
    return null
  }
}

export function uploadDatasetToWorkspace(dataset, onProgress) {
  if (!dataset?.file) return Promise.reject(new Error('Choose a dataset file before authorizing the job.'))

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', '/api/datasets/upload')
    request.withCredentials = true
    request.setRequestHeader('Content-Type', 'application/octet-stream')
    request.setRequestHeader('X-Dataset-Name', encodeURIComponent(dataset.file.name))
    const authorization = previewAuthorizationHeader()
    if (authorization) request.setRequestHeader('Authorization', authorization)
    let lastBucket = -1
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      const bucket = Math.min(95, Math.floor((event.loaded / event.total) * 4) * 25)
      if (bucket !== lastBucket) {
        lastBucket = bucket
        onProgress?.(bucket)
      }
    }
    request.onerror = () => reject(new Error('The dataset upload lost its connection. Please try again.'))
    request.onload = () => {
      let payload = {}
      try { payload = JSON.parse(request.responseText || '{}') } catch { /* A non-JSON server response is handled below. */ }
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(100)
        resolve(payload)
      } else if (request.status === 401) {
        reject(new Error('Upload authorization expired. Sign in again, then retry this job.'))
      } else reject(new Error(payload.error || 'The dataset upload could not be completed.'))
    }
    request.send(dataset.file)
  })
}

function filenameFromDisposition(value) {
  const match = /filename="?([^";]+)"?/i.exec(value || '')
  return match?.[1] || 'dataset.json'
}

/**
 * Transfers the protected dataset bytes to the receiver browser. The frontend
 * does not promote any lifecycle state itself: server-side stream completion
 * and subsequent polling remain the authority for queueing and dispatch.
 */
export function downloadReceiverDataset({ jobId, receiverId, onProgress }) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('GET', `/api/receiver-datasets/${encodeURIComponent(jobId)}?receiverId=${encodeURIComponent(receiverId)}`)
    request.withCredentials = true
    request.responseType = 'blob'
    const authorization = previewAuthorizationHeader()
    if (authorization) request.setRequestHeader('Authorization', authorization)
    request.onprogress = (event) => {
      if (!event.lengthComputable) return
      onProgress?.(Math.min(100, Math.round((event.loaded / event.total) * 100)))
    }
    request.onerror = () => reject(new Error('Dataset delivery lost its connection. You can retry while delivery is active.'))
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        const reader = new FileReader()
        reader.onload = () => reject(new Error(String(reader.result || 'Dataset delivery could not be completed.')))
        reader.onerror = () => reject(new Error('Dataset delivery could not be completed.'))
        reader.readAsText(request.response)
        return
      }
      const objectUrl = URL.createObjectURL(request.response)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = filenameFromDisposition(request.getResponseHeader('Content-Disposition'))
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000)
      onProgress?.(100)
      resolve({ filename: anchor.download })
    }
    request.send()
  })
}
