/**
 * Dataset validation & inspection (PRD Section 2: Dataset Validation).
 *
 * Validates that an uploaded file is a supported format, within the size
 * limit, readable, and structurally parseable, then reports a record count
 * used later to estimate training steps. Runs entirely in the browser via the
 * File API — no upload leaves the device.
 */

export const SUPPORTED_EXTENSIONS = ['json', 'jsonl', 'csv']
export const MAX_FILE_BYTES = 50 * 1024 * 1024 // 50 MB

function getExtension(name = '') {
  const parts = name.toLowerCase().split('.')
  return parts.length > 1 ? parts.pop() : ''
}

/** Read a File as text, resolving to { text } or rejecting with a message. */
function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('The file could not be read. It may be corrupted.'))
    reader.onabort = () => reject(new Error('Reading the file was interrupted. Please try again.'))
    reader.readAsText(file)
  })
}

/** Count records for a given format; also performs structural validation. */
function inspectContent(text, extension) {
  if (extension === 'json') {
    let parsed
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new Error('Invalid JSON: the file could not be parsed.')
    }
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) throw new Error('The JSON array contains no records.')
      return parsed.length
    }
    if (parsed && typeof parsed === 'object') {
      // Allow a wrapping object with a data/records array.
      const arrayField = parsed.data || parsed.records || parsed.examples
      if (Array.isArray(arrayField)) {
        if (arrayField.length === 0) throw new Error('The dataset contains no records.')
        return arrayField.length
      }
      return 1
    }
    throw new Error('Unsupported JSON structure. Provide an array of records.')
  }

  if (extension === 'jsonl') {
    const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '')
    if (lines.length === 0) throw new Error('The JSONL file contains no records.')
    // Validate every line so malformed records anywhere in the file are caught
    // and the returned record count reflects only valid records.
    lines.forEach((line, index) => {
      try {
        JSON.parse(line)
      } catch {
        throw new Error(`Invalid JSONL: line ${index + 1} is not valid JSON.`)
      }
    })
    return lines.length
  }

  if (extension === 'csv') {
    const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '')
    if (lines.length < 2) throw new Error('The CSV file must include a header row and at least one record.')
    return lines.length - 1 // exclude header
  }

  throw new Error('Unsupported file format.')
}

/**
 * Validate a dataset file end-to-end.
 * @returns Promise resolving to { name, type, sizeBytes, records }
 * @throws Error with a user-friendly message on any validation failure.
 */
export async function validateDatasetFile(file) {
  if (!file) throw new Error('No file selected.')

  const extension = getExtension(file.name)
  if (!SUPPORTED_EXTENSIONS.includes(extension)) {
    throw new Error(`Unsupported format ".${extension || 'unknown'}". Upload a JSON, JSONL or CSV file.`)
  }
  if (file.size === 0) {
    throw new Error('The selected file is empty.')
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('File is too large. The maximum dataset size is 50 MB.')
  }

  const text = await readFileText(file)
  const records = inspectContent(text, extension)

  return {
    name: file.name,
    type: extension.toUpperCase(),
    sizeBytes: file.size,
    records,
  }
}
