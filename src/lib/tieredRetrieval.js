/**
 * Tiered "Netflix Model" Retrieval Engine
 *
 * Three-tier architecture wrapping the existing hybrid retrieval:
 * - Tier 1 (Hot): Recently updated docs, user's team data, frequently accessed
 * - Tier 2 (Warm): All indexed docs via existing hybrid retrieval
 * - Tier 3 (Cold): Broader search with lower similarity threshold, cross-team
 *
 * After retrieval, expands results with related documents from document_relationships.
 */

import { supabase } from './supabaseClient'
import {
  analyzeQuery,
  searchStructuredData,
  searchSemanticData,
  buildContextualPrompt,
  getRoleSpecificContext,
  extractSKU
} from './hybridRetrieval'
import { getEmbedding } from './embeddings'
import { searchSimilar } from './vectorStore'
import { analyzeQueryIntent } from './queryAnalyzer'

const HOT_WINDOW_DAYS = 7
const MIN_RESULTS_PER_TIER = 3

/**
 * Tier 1 (Hot): Search recently updated and frequently accessed documents.
 */
async function searchTier1(query, userContext, queryAnalysis) {
  const results = { structured: [], semantic: [] }
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - HOT_WINDOW_DAYS)

  // Search structured data filtered to recent documents
  if (queryAnalysis.type === 'structured' || queryAnalysis.type === 'hybrid') {
    try {
      const { data: recentDocs } = await supabase
        .from('documents')
        .select('id')
        .gte('updated_at', cutoffDate.toISOString())
        .limit(50)

      if (recentDocs && recentDocs.length > 0) {
        const recentIds = recentDocs.map(d => d.id)

        const { data: structuredData } = await supabase
          .from('structured_data')
          .select('*')
          .in('document_id', recentIds)
          .order('updated_at', { ascending: false })
          .limit(20)

        if (structuredData) {
          // Filter by query relevance using simple text matching
          const lowerQuery = query.toLowerCase()
          results.structured = structuredData
            .filter(row => {
              const rowText = JSON.stringify(row).toLowerCase()
              return lowerQuery.split(/\s+/).some(word => word.length > 2 && rowText.includes(word))
            })
            .map(row => ({
              type: 'structured',
              source: row.document_title || 'Spreadsheet',
              sourceUrl: row.document_url,
              sheetName: row.sheet_name,
              content: formatStructuredRow(row),
              rawData: row,
              score: 1.1, // Tier 1 boost
              tier: 1,
              metadata: {
                team: row.team_context,
                updatedAt: row.updated_at,
                type: 'spreadsheet'
              }
            }))
        }
      }
    } catch (error) {
      console.error('Tier 1 structured search error:', error.message)
    }
  }

  // Search semantic data from recent docs (higher similarity threshold)
  if (queryAnalysis.type === 'semantic' || queryAnalysis.type === 'hybrid') {
    try {
      const queryEmbedding = await getEmbedding(query)
      const semanticResults = await searchSimilar(queryEmbedding, { topK: 5, minScore: 0.75 })

      // Filter to recent documents
      const recentSemantic = semanticResults.filter(r => {
        const updatedAt = r.metadata?.modifiedTime || r.metadata?.updatedAt
        if (!updatedAt) return false
        return new Date(updatedAt) >= cutoffDate
      })

      results.semantic = recentSemantic.map(chunk => ({
        type: 'semantic',
        source: chunk.documentTitle || 'Document',
        sourceUrl: chunk.documentUrl,
        content: chunk.text,
        score: chunk.score * 1.1, // Tier 1 boost
        tier: 1,
        metadata: {
          ...chunk.metadata,
          type: 'document'
        }
      }))
    } catch (error) {
      console.error('Tier 1 semantic search error:', error.message)
    }
  }

  return results
}

/**
 * Tier 2 (Warm): Standard hybrid retrieval (existing behavior).
 */
async function searchTier2(query, userContext, queryAnalysis) {
  const results = { structured: [], semantic: [] }

  if (queryAnalysis.type === 'structured' || queryAnalysis.type === 'hybrid') {
    results.structured = await searchStructuredData(query, {
      teamContext: userContext.team,
      limit: 20
    })
    results.structured = results.structured.map(r => ({ ...r, tier: 2 }))
  }

  if (queryAnalysis.type === 'semantic' || queryAnalysis.type === 'hybrid') {
    results.semantic = await searchSemanticData(query, {
      teamContext: userContext.team,
      topK: 5,
      minScore: 0.7
    })
    results.semantic = results.semantic.map(r => ({ ...r, tier: 2 }))
  }

  return results
}

/**
 * Tier 3 (Cold): Broader search with lower thresholds, cross-team.
 */
async function searchTier3(query, userContext) {
  const results = { structured: [], semantic: [] }

  // Broader structured search (no team filter)
  try {
    results.structured = await searchStructuredData(query, {
      teamContext: null, // Cross-team
      limit: 10
    })
    results.structured = results.structured.map(r => ({ ...r, tier: 3, score: r.score * 0.8 }))
  } catch (error) {
    console.error('Tier 3 structured search error:', error.message)
  }

  // Broader semantic search (lower threshold)
  try {
    results.semantic = await searchSemanticData(query, {
      teamContext: null, // Cross-team
      topK: 5,
      minScore: 0.4 // Lower threshold for broader matches
    })
    results.semantic = results.semantic.map(r => ({ ...r, tier: 3, score: r.score * 0.8 }))
  } catch (error) {
    console.error('Tier 3 semantic search error:', error.message)
  }

  return results
}

/**
 * Expand results with related documents from document_relationships.
 * If a CPFR result is returned, also pull the related PSI and forecast tabs.
 */
async function expandWithRelatedDocuments(results) {
  const documentIds = new Set()
  for (const r of results) {
    const docId = r.rawData?.document_id || r.metadata?.documentId
    if (docId) documentIds.add(docId)
  }

  if (documentIds.size === 0) return []

  try {
    const { data: relationships } = await supabase
      .from('document_relationships')
      .select('*, source_doc:source_document_id(title, url), target_doc:target_document_id(title, url)')
      .or(
        [...documentIds].map(id => `source_document_id.eq.${id},target_document_id.eq.${id}`).join(',')
      )
      .limit(10)

    if (!relationships || relationships.length === 0) return []

    // Fetch related document chunks
    const relatedDocIds = new Set()
    for (const rel of relationships) {
      if (!documentIds.has(rel.source_document_id)) relatedDocIds.add(rel.source_document_id)
      if (!documentIds.has(rel.target_document_id)) relatedDocIds.add(rel.target_document_id)
    }

    if (relatedDocIds.size === 0) return []

    // Get a sample of structured data from related documents
    const { data: relatedData } = await supabase
      .from('structured_data')
      .select('*')
      .in('document_id', [...relatedDocIds])
      .order('updated_at', { ascending: false })
      .limit(10)

    if (!relatedData) return []

    return relatedData.map(row => {
      // Find the relationship description
      const rel = relationships.find(r =>
        r.source_document_id === row.document_id || r.target_document_id === row.document_id
      )

      return {
        type: 'related',
        source: row.document_title || 'Related Document',
        sourceUrl: row.document_url,
        sheetName: row.sheet_name,
        content: formatStructuredRow(row),
        rawData: row,
        score: (row.score || 0.5) * 0.5, // Related docs at reduced relevance
        tier: 'related',
        relationship: rel?.relationship_type,
        relationshipDescription: rel?.description,
        metadata: {
          team: row.team_context,
          updatedAt: row.updated_at,
          type: 'spreadsheet'
        }
      }
    })
  } catch (error) {
    console.error('Error expanding with related documents:', error.message)
    return []
  }
}

/**
 * Log document access for tiered retrieval optimization.
 */
async function logAccess(results, userId) {
  const entries = []
  const seen = new Set()

  for (const r of results) {
    const docId = r.rawData?.document_id || r.metadata?.documentId
    if (!docId || seen.has(docId)) continue
    seen.add(docId)

    entries.push({
      document_id: docId,
      user_id: userId,
      access_type: r.type === 'related' ? 'related' : 'retrieval'
    })
  }

  if (entries.length > 0) {
    const { error } = await supabase.from('document_access_log').insert(entries)
    if (error) console.error('Error logging document access:', error.message)
  }
}

/**
 * Format structured row data into readable text (same as hybridRetrieval)
 */
function formatStructuredRow(row) {
  const parts = []

  if (row.sku) parts.push(`SKU: ${row.sku}`)
  if (row.category) parts.push(`Category: ${row.category}`)
  if (row.date) parts.push(`Date: ${row.date}`)

  const dataFields = ['forecast', 'units', 'quantity', 'sales', 'inventory', 'wo1', 'wo2', 'wo3', 'wo4']
  for (const field of dataFields) {
    if (row[field] !== null && row[field] !== undefined) {
      parts.push(`${field}: ${row[field]}`)
    }
  }

  if (row.notes) parts.push(`Notes: ${row.notes}`)
  if (row.sheet_name) parts.push(`Sheet: ${row.sheet_name}`)

  return parts.join('\n')
}

/**
 * Deduplicate results by content, keeping the highest-scored version.
 */
function deduplicateResults(results) {
  const seen = new Map()

  for (const r of results) {
    // Key by document + sheet + row_index for structured, or content hash for semantic
    const key = r.rawData?.document_id && r.rawData?.row_index != null
      ? `${r.rawData.document_id}:${r.rawData.sheet_name}:${r.rawData.row_index}`
      : r.content?.substring(0, 100)

    if (!key) continue

    const existing = seen.get(key)
    if (!existing || r.score > existing.score) {
      seen.set(key, r)
    }
  }

  return [...seen.values()]
}

/**
 * Main tiered retrieval function.
 * Replaces hybridRetrieval as the primary search interface.
 */
export async function tieredRetrieval(query, userContext = {}) {
  console.log(`Tiered retrieval for query: "${query}"`)

  // Analyze query intent using keyword classifier
  const queryAnalysis = analyzeQuery(query, userContext)
  console.log('Query analysis:', queryAnalysis)

  // For ambiguous queries, optionally use LLM for better intent detection
  let llmAnalysis = null
  if (queryAnalysis.type === 'hybrid' && process.env.ANTHROPIC_API_KEY) {
    try {
      llmAnalysis = await analyzeQueryIntent(query, userContext)
      console.log('LLM query analysis:', llmAnalysis)
      // Override query type if LLM is more specific
      if (llmAnalysis.query_type !== 'hybrid') {
        queryAnalysis.type = llmAnalysis.query_type
      }
    } catch (error) {
      console.error('LLM query analysis failed, using keyword classifier:', error.message)
    }
  }

  const tiersUsed = []
  let allStructured = []
  let allSemantic = []
  let relatedResults = []

  // Tier 1: Hot data
  const tier1 = await searchTier1(query, userContext, queryAnalysis)
  allStructured.push(...tier1.structured)
  allSemantic.push(...tier1.semantic)
  if (tier1.structured.length > 0 || tier1.semantic.length > 0) {
    tiersUsed.push(1)
  }

  const tier1Total = tier1.structured.length + tier1.semantic.length

  // Tier 2: Warm data (if Tier 1 didn't return enough)
  if (tier1Total < MIN_RESULTS_PER_TIER) {
    const tier2 = await searchTier2(query, userContext, queryAnalysis)
    allStructured.push(...tier2.structured)
    allSemantic.push(...tier2.semantic)
    if (tier2.structured.length > 0 || tier2.semantic.length > 0) {
      tiersUsed.push(2)
    }

    const totalSoFar = allStructured.length + allSemantic.length

    // Tier 3: Cold data (if Tier 1+2 still not enough)
    if (totalSoFar < MIN_RESULTS_PER_TIER) {
      const tier3 = await searchTier3(query, userContext)
      allStructured.push(...tier3.structured)
      allSemantic.push(...tier3.semantic)
      if (tier3.structured.length > 0 || tier3.semantic.length > 0) {
        tiersUsed.push(3)
      }
    }
  }

  // Combine and deduplicate
  const combined = deduplicateResults([...allStructured, ...allSemantic])

  // Expand with related documents
  if (combined.length > 0) {
    relatedResults = await expandWithRelatedDocuments(combined)
  }

  // Final combined results: primary + related
  const allResults = [...combined, ...relatedResults].sort((a, b) => b.score - a.score)

  // Log access asynchronously (fire-and-forget)
  if (userContext.email) {
    logAccess(allResults, userContext.email).catch(() => {})
  }

  console.log(`Tiered retrieval complete: ${allStructured.length} structured, ${allSemantic.length} semantic, ${relatedResults.length} related, tiers: [${tiersUsed.join(',')}]`)

  return {
    results: allResults,
    structured: allStructured,
    semantic: allSemantic,
    related: relatedResults,
    queryType: queryAnalysis.type,
    totalResults: allResults.length,
    tiersUsed,
    llmAnalysis
  }
}

// Re-export buildContextualPrompt so chat route can use it from either import
export { buildContextualPrompt } from './hybridRetrieval'
