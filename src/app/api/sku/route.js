/**
 * SKU Lookup API
 * GET /api/sku?q=A1234 - Search for SKU information
 */

import { searchSKU, extractSKUs } from '@/lib/skuLookup'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (!query) {
    return Response.json(
      { error: 'Query parameter "q" is required' },
      { status: 400 }
    )
  }

  // Extract SKUs from the query
  let skus = extractSKUs(query)

  // If no SKU pattern found, treat the whole query as a SKU
  if (skus.length === 0) {
    skus = [query.toUpperCase().trim()]
  }

  try {
    // Search for each SKU
    const results = await Promise.all(
      skus.map(sku => searchSKU(sku))
    )

    return Response.json({
      query,
      skus,
      results,
      totalMatches: results.reduce((sum, r) => sum + r.totalResults, 0)
    })
  } catch (error) {
    console.error('SKU lookup error:', error)
    return Response.json(
      { error: 'Failed to search for SKU' },
      { status: 500 }
    )
  }
}
