/**
 * SKU Lookup API
 * GET /api/sku?q=A1234 - Search for SKU information
 */

import { z } from 'zod'
import { searchSKU, extractSKUs } from '@/lib/skuLookup'
import {
  ErrorCode,
  apiError,
  apiSuccess,
  requireAuth,
  validateParams,
  generateRequestId,
  sanitizeError
} from '@/lib/apiUtils'

const skuQuerySchema = z.object({
  q: z.string().min(1, 'Query parameter "q" is required').max(200)
})

export async function GET(request) {
  const requestId = generateRequestId()

  // Auth check
  const { session, errorResponse: authError } = await requireAuth()
  if (authError) return authError

  // Validate query params
  const { searchParams } = new URL(request.url)
  const { data: params, errorResponse: validationError } = validateParams(searchParams, skuQuerySchema)
  if (validationError) return validationError

  const query = params.q

  // Extract SKUs from the query
  let skus = extractSKUs(query)

  // If no SKU pattern found, treat the whole query as a SKU
  if (skus.length === 0) {
    skus = [query.toUpperCase().trim()]
  }

  try {
    const results = await Promise.all(
      skus.map(sku => searchSKU(sku))
    )

    return apiSuccess({
      query,
      skus,
      results,
      totalMatches: results.reduce((sum, r) => sum + r.totalResults, 0)
    }, requestId)
  } catch (error) {
    console.error('SKU lookup error:', error)
    return apiError(
      ErrorCode.INTERNAL_ERROR,
      sanitizeError(error, 'Failed to search for SKU'),
      500,
      requestId
    )
  }
}
