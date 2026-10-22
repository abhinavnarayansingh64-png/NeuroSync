/**
 * Pure validation helpers. Each returns either an empty string (valid)
 * or a human-readable error message (invalid). Keeping them pure makes
 * them trivial to reuse across forms and to unit test.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateRequired(value, label = 'This field') {
  if (value === null || value === undefined || String(value).trim() === '') {
    return `${label} is required.`
  }
  return ''
}

export function validateEmail(value) {
  const required = validateRequired(value, 'Email')
  if (required) return required
  if (!EMAIL_REGEX.test(String(value).trim())) {
    return 'Enter a valid email address.'
  }
  return ''
}

export function validatePassword(value, min = 6) {
  const required = validateRequired(value, 'Password')
  if (required) return required
  if (String(value).length < min) {
    return `Password must be at least ${min} characters.`
  }
  return ''
}

export function validatePasswordMatch(password, confirm) {
  const required = validateRequired(confirm, 'Confirm Password')
  if (required) return required
  if (password !== confirm) {
    return 'Passwords do not match.'
  }
  return ''
}

/**
 * Validate a numeric field within an inclusive range.
 * Accepts strings (from inputs) and coerces them.
 */
export function validateNumberInRange(value, { min, max, label = 'Value', integer = false } = {}) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return `${label} is required.`
  }
  const num = Number(value)
  if (!Number.isFinite(num)) {
    return `${label} must be a valid number.`
  }
  if (integer && !Number.isInteger(num)) {
    return `${label} must be a whole number.`
  }
  if (min !== undefined && num < min) {
    return `${label} must be at least ${min}.`
  }
  if (max !== undefined && num > max) {
    return `${label} must be at most ${max}.`
  }
  return ''
}

/** Returns true when every value in the errors object is falsy. */
export function isFormValid(errors) {
  return Object.values(errors).every((error) => !error)
}
