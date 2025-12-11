/**
 * SKU Data Management
 * Handles SKU lookups and inventory/forecast data
 */

import { searchSimilar } from './vectorStore'
import { generateQueryEmbedding } from './embeddings'

/**
 * Search for SKU-related information across documents
 */
export async function searchSKU(sku) {
  // Normalize SKU format
  const normalizedSku = sku.toUpperCase().trim()

  // Create a search query that targets SKU information
  const searchQuery = `SKU ${normalizedSku} product inventory forecast supply demand`

  try {
    const embedding = await generateQueryEmbedding(searchQuery)
    const results = await searchSimilar(embedding, {
      topK: 10,
      minScore: 0.5  // Lower threshold for SKU searches
    })

    // Filter results that actually contain the SKU
    const skuResults = results.filter(r =>
      r.text.toUpperCase().includes(normalizedSku)
    )

    // Also include high-relevance results even without exact SKU match
    const relevantResults = results.filter(r =>
      r.score > 0.75 && !skuResults.includes(r)
    ).slice(0, 3)

    return {
      sku: normalizedSku,
      exactMatches: skuResults,
      relatedInfo: relevantResults,
      totalResults: skuResults.length + relevantResults.length
    }
  } catch (error) {
    console.error('SKU search error:', error)
    return {
      sku: normalizedSku,
      exactMatches: [],
      relatedInfo: [],
      totalResults: 0,
      error: error.message
    }
  }
}

/**
 * Parse SKU from user message
 * Detects common SKU patterns like A1234, B5678-BK, etc.
 */
export function extractSKUs(text) {
  // Common SKU patterns:
  // - Letter followed by numbers: A1234
  // - With color/variant suffix: A1234-BK, A1234_WHT
  // - All caps alphanumeric: ABC123DEF
  const patterns = [
    /\b[A-Z]\d{4,}(?:[-_][A-Z0-9]+)?\b/gi,  // A1234, A1234-BK
    /\b[A-Z]{2,}\d{3,}[A-Z0-9]*\b/gi,        // AB123, ABC1234
    /\bSKU[:\s]*([A-Z0-9-_]+)\b/gi,          // SKU: A1234
  ]

  const skus = new Set()

  patterns.forEach(pattern => {
    const matches = text.match(pattern)
    if (matches) {
      matches.forEach(match => {
        // Clean up the match
        const cleaned = match.replace(/^SKU[:\s]*/i, '').toUpperCase()
        if (cleaned.length >= 4) {
          skus.add(cleaned)
        }
      })
    }
  })

  return Array.from(skus)
}

/**
 * Format SKU search results for display
 */
export function formatSKUResults(results) {
  if (results.totalResults === 0) {
    return `No information found for SKU ${results.sku}. This SKU may not be in the loaded documents yet.`
  }

  let formatted = `## SKU: ${results.sku}\n\n`

  if (results.exactMatches.length > 0) {
    formatted += `### Found in Documents:\n\n`
    results.exactMatches.forEach((match, idx) => {
      formatted += `**${idx + 1}. ${match.documentTitle}**\n`
      formatted += `${match.text.slice(0, 500)}${match.text.length > 500 ? '...' : ''}\n\n`
    })
  }

  if (results.relatedInfo.length > 0) {
    formatted += `### Related Information:\n\n`
    results.relatedInfo.forEach((match, idx) => {
      formatted += `**${match.documentTitle}**\n`
      formatted += `${match.text.slice(0, 300)}${match.text.length > 300 ? '...' : ''}\n\n`
    })
  }

  return formatted
}
