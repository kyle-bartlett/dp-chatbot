/**
 * Structured Logger
 *
 * Outputs JSON-formatted logs suitable for log aggregation services
 * (Datadog, CloudWatch, etc.). Sanitizes PII before logging.
 *
 * Usage:
 *   import { createLogger } from '@/lib/logger'
 *   const log = createLogger('api.chat')
 *   log.info('Processing request', { requestId, userId: user.email })
 */

const LOG_LEVEL_VALUES = { debug: 0, info: 1, warn: 2, error: 3 }

const currentLevel = LOG_LEVEL_VALUES[process.env.LOG_LEVEL || 'info'] || 1

// Patterns that indicate PII — values matching these keys get redacted
const PII_KEY_PATTERNS = [
  /token/i, /secret/i, /password/i, /credential/i,
  /authorization/i, /cookie/i, /apikey/i, /api_key/i
]

// Email pattern for redaction in string values
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g

/**
 * Redact PII from a value based on its key name.
 */
function redactValue(key, value) {
  if (typeof value !== 'string') return value

  // Redact entire value if key looks sensitive
  if (PII_KEY_PATTERNS.some(p => p.test(key))) {
    return '[REDACTED]'
  }

  return value
}

/**
 * Sanitize an object by redacting PII fields.
 * Operates on a shallow copy — does not mutate the original.
 */
function sanitizeData(data) {
  if (!data || typeof data !== 'object') return data

  const sanitized = {}
  for (const [key, value] of Object.entries(data)) {
    sanitized[key] = redactValue(key, value)
  }
  return sanitized
}

/**
 * Create a logger scoped to a module/component name.
 *
 * @param {string} scope - Module name (e.g., 'api.chat', 'lib.embeddings')
 * @returns {{ debug, info, warn, error }} Logger methods
 */
export function createLogger(scope) {
  function emit(level, message, data) {
    if (LOG_LEVEL_VALUES[level] < currentLevel) return

    const entry = {
      level,
      scope,
      msg: message,
      ts: new Date().toISOString(),
      ...(data ? sanitizeData(data) : {})
    }

    const json = JSON.stringify(entry)

    switch (level) {
      case 'error':
        console.error(json)
        break
      case 'warn':
        console.warn(json)
        break
      default:
        console.log(json)
    }
  }

  return {
    debug: (msg, data) => emit('debug', msg, data),
    info: (msg, data) => emit('info', msg, data),
    warn: (msg, data) => emit('warn', msg, data),
    error: (msg, data) => emit('error', msg, data)
  }
}
