/**
 * Shared API utilities for request validation, error handling, and auth enforcement.
 *
 * Every API route should use these utilities to ensure:
 * - Consistent error response format across all endpoints
 * - No raw third-party error messages leaked to clients
 * - Input validated via Zod schemas before processing
 * - Authentication enforced on all non-public endpoints
 * - Request IDs for traceability
 */

import { auth } from '@/lib/auth'
import { randomUUID } from 'crypto'

// ============================================================================
// Error codes — every error returned to the client uses one of these.
// This makes it possible for consumers to programmatically handle errors.
// ============================================================================

export const ErrorCode = {
  // Auth
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_PARAMETER: 'INVALID_PARAMETER',
  MISSING_PARAMETER: 'MISSING_PARAMETER',

  // Resources
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',

  // External services
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',

  // Server
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  PARTIAL_SUCCESS: 'PARTIAL_SUCCESS'
}

// ============================================================================
// sanitizeError — strips internal details from errors before sending to client
// ============================================================================

/**
 * Sanitize an error for client consumption.
 * Never sends raw error.message, error.stack, or third-party error details.
 *
 * @param {Error|object} error - The caught error
 * @param {string} fallbackMessage - Generic message to show the client
 * @returns {string} A safe, user-facing error message
 */
export function sanitizeError(error, fallbackMessage = 'An unexpected error occurred') {
  // If it's a known safe message we've already crafted, use it
  if (error?._safe) {
    return error.message
  }

  // Never expose raw error details
  return fallbackMessage
}

/**
 * Create a safe error that can be sent to clients.
 * The _safe flag tells sanitizeError() to use the message as-is.
 *
 * @param {string} message - A human-friendly error message
 * @returns {Error} An error marked as safe for client consumption
 */
export function safeError(message) {
  const err = new Error(message)
  err._safe = true
  return err
}

// ============================================================================
// apiError / apiSuccess — standardized response builders
// ============================================================================

/**
 * Build a standardized error response.
 *
 * Format: { error: { code: string, message: string }, requestId: string }
 *
 * @param {string} code - Error code from ErrorCode enum
 * @param {string} message - Human-readable error message (already sanitized)
 * @param {number} status - HTTP status code
 * @param {string} [requestId] - Request ID for traceability
 * @returns {Response}
 */
export function apiError(code, message, status, requestId) {
  return Response.json(
    {
      error: { code, message },
      requestId: requestId || undefined
    },
    { status }
  )
}

/**
 * Build a standardized success response.
 *
 * @param {object} data - Response payload
 * @param {string} [requestId] - Request ID for traceability
 * @returns {Response}
 */
export function apiSuccess(data, requestId) {
  return Response.json(
    {
      ...data,
      requestId: requestId || undefined
    },
    { status: 200 }
  )
}

// ============================================================================
// requireAuth — authentication enforcement
// ============================================================================

/**
 * Enforce authentication on an API route.
 * Returns the session if authenticated, or null + an error response.
 *
 * @returns {Promise<{ session: object|null, errorResponse: Response|null }>}
 */
export async function requireAuth() {
  const session = await auth()

  if (!session?.user) {
    return {
      session: null,
      errorResponse: apiError(
        ErrorCode.UNAUTHORIZED,
        'Authentication required. Please sign in.',
        401
      )
    }
  }

  return { session, errorResponse: null }
}

// ============================================================================
// validateBody / validateParams — Zod schema validation wrappers
// ============================================================================

/**
 * Validate a request body against a Zod schema.
 *
 * @param {Request} request - The incoming request
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @returns {Promise<{ data: object|null, errorResponse: Response|null }>}
 */
export async function validateBody(request, schema) {
  let body
  try {
    body = await request.json()
  } catch {
    return {
      data: null,
      errorResponse: apiError(
        ErrorCode.VALIDATION_ERROR,
        'Request body must be valid JSON',
        400
      )
    }
  }

  const result = schema.safeParse(body)

  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
    return {
      data: null,
      errorResponse: apiError(
        ErrorCode.VALIDATION_ERROR,
        `Invalid request: ${issues}`,
        400
      )
    }
  }

  return { data: result.data, errorResponse: null }
}

/**
 * Validate query parameters against a Zod schema.
 *
 * @param {URL|URLSearchParams} searchParams - URL search params
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @returns {{ data: object|null, errorResponse: Response|null }}
 */
export function validateParams(searchParams, schema) {
  // Convert URLSearchParams to plain object
  const params = {}
  const sp = searchParams instanceof URL ? searchParams.searchParams : searchParams
  for (const [key, value] of sp.entries()) {
    params[key] = value
  }

  const result = schema.safeParse(params)

  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
    return {
      data: null,
      errorResponse: apiError(
        ErrorCode.VALIDATION_ERROR,
        `Invalid parameters: ${issues}`,
        400
      )
    }
  }

  return { data: result.data, errorResponse: null }
}

// ============================================================================
// generateRequestId — unique ID for request tracing
// ============================================================================

/**
 * Generate a unique request ID for tracing.
 * @returns {string}
 */
export function generateRequestId() {
  return randomUUID()
}

// ============================================================================
// escapeFilterValue — sanitize user input for Supabase filter DSL
// ============================================================================

/**
 * Escape special characters in user input before interpolating into
 * Supabase PostgREST filter strings (used in .or(), .filter(), etc.).
 *
 * PostgREST filter syntax uses . , ( ) as delimiters.
 * We escape these to prevent filter injection.
 *
 * @param {string} value - Raw user input
 * @returns {string} Escaped value safe for filter interpolation
 */
export function escapeFilterValue(value) {
  if (!value || typeof value !== 'string') return ''
  // Remove characters that are syntactically meaningful in PostgREST filters
  return value.replace(/[.,()]/g, ' ').trim()
}

// ============================================================================
// Retry with exponential backoff
// ============================================================================

/**
 * Execute an async function with retry and exponential backoff.
 *
 * @param {Function} fn - Async function to execute
 * @param {object} options - Retry options
 * @param {number} [options.maxRetries=3] - Maximum number of retries
 * @param {number} [options.baseDelayMs=1000] - Base delay in milliseconds
 * @param {Function} [options.shouldRetry] - Function that receives the error and returns boolean
 * @returns {Promise<*>} Result of fn()
 */
export async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    shouldRetry = defaultShouldRetry
  } = options

  let lastError
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt < maxRetries && shouldRetry(error)) {
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500
        await new Promise(resolve => setTimeout(resolve, delay))
      } else {
        throw error
      }
    }
  }
  throw lastError
}

/**
 * Default retry predicate: retry on 429 (rate limit) and 503 (service unavailable).
 * @param {Error} error
 * @returns {boolean}
 */
function defaultShouldRetry(error) {
  const status = error?.status || error?.code || error?.response?.status
  return status === 429 || status === 503 || status === 'ECONNRESET' || status === 'ETIMEDOUT'
}

// ============================================================================
// withTimeout — wrap a promise with a timeout
// ============================================================================

/**
 * Wrap a promise with a timeout. Rejects with a timeout error if the
 * promise does not resolve within the specified duration.
 *
 * @param {Promise} promise - The promise to wrap
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} [label='Operation'] - Label for the timeout error message
 * @returns {Promise<*>}
 */
export function withTimeout(promise, timeoutMs, label = 'Operation') {
  let timeoutId
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`))
    }, timeoutMs)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId)
  })
}

// ============================================================================
// Rate limiter — simple in-memory token bucket per key
// ============================================================================

/**
 * Simple in-memory rate limiter using token bucket algorithm.
 * Suitable for single-instance deployments. For multi-instance,
 * replace with Redis-backed implementation.
 */
export class RateLimiter {
  /**
   * @param {object} options
   * @param {number} options.maxRequests - Max requests per window
   * @param {number} options.windowMs - Time window in milliseconds
   */
  constructor({ maxRequests, windowMs }) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
    this.buckets = new Map()

    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      const now = Date.now()
      for (const [key, bucket] of this.buckets) {
        if (now - bucket.windowStart > this.windowMs * 2) {
          this.buckets.delete(key)
        }
      }
    }, 60000)
  }

  /**
   * Check if a request is allowed for the given key.
   *
   * @param {string} key - Rate limit key (e.g., user email)
   * @returns {{ allowed: boolean, remaining: number, resetMs: number }}
   */
  check(key) {
    const now = Date.now()
    let bucket = this.buckets.get(key)

    if (!bucket || now - bucket.windowStart > this.windowMs) {
      bucket = { count: 0, windowStart: now }
      this.buckets.set(key, bucket)
    }

    bucket.count++

    if (bucket.count > this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetMs: bucket.windowStart + this.windowMs - now
      }
    }

    return {
      allowed: true,
      remaining: this.maxRequests - bucket.count,
      resetMs: bucket.windowStart + this.windowMs - now
    }
  }
}

// Singleton rate limiter for chat: 20 requests per minute per user
export const chatRateLimiter = new RateLimiter({ maxRequests: 20, windowMs: 60000 })
