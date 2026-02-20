/**
 * Hybrid Retrieval Engine
 * Combines structured data queries (Sheets) with semantic search (Docs)
 * Provides context-aware retrieval based on user role and query type
 */

import { supabase } from './supabaseClient'
import { searchSimilar } from './vectorStore'
import { getEmbedding } from './embeddings'
import { escapeFilterValue } from './apiUtils'

/**
 * Detect query intent and type
 * Returns: { type: 'structured' | 'semantic' | 'hybrid', context: {...} }
 */
export function analyzeQuery(query, userContext = {}) {
  const lowerQuery = query.toLowerCase()

  // Keywords that indicate structured data queries
  const structuredKeywords = [
    'forecast', 'pipeline', 'sku', 'asin', 'week', 'wo', 'inventory',
    'units', 'quantity', 'sales', 'orders', 'inbound', 'eta', 'tracking',
    'cpfr', 'costco', 'amazon', 'walmart', 'target', 'category', 'product'
  ]

  // Keywords that indicate semantic/document queries
  const semanticKeywords = [
    'how to', 'what is', 'why', 'explain', 'procedure', 'process',
    'sop', 'guide', 'training', 'policy', 'best practice', 'standard',
    'who', 'when', 'where', 'meeting', 'notes', 'comment', 'summary'
  ]

  // Check for structured query signals
  const hasStructuredSignals = structuredKeywords.some(kw => lowerQuery.includes(kw))
  
  // Check for semantic query signals
  const hasSemanticSignals = semanticKeywords.some(kw => lowerQuery.includes(kw))

  // Detect specific patterns
  const patterns = {
    weekOverWeek: /week.{0,5}week|wo.?w|delta|change/i.test(query),
    skuLookup: /sku|asin|b0[0-9a-z]+/i.test(query),
    forecastQuery: /forecast|demand|projection/i.test(query),
    sopQuery: /sop|procedure|how to|guide/i.test(query),
    pipelineQuery: /pipeline|status|tracking|inbound/i.test(query)
  }

  // Determine query type
  let type = 'hybrid'
  if (hasStructuredSignals && !hasSemanticSignals) {
    type = 'structured'
  } else if (hasSemanticSignals && !hasStructuredSignals) {
    type = 'semantic'
  }

  return {
    type,
    patterns,
    userRole: userContext.role || 'general',
    teamContext: userContext.team || 'general'
  }
}

/**
 * Search structured data (Sheets content)
 * Queries the structured_data table for matching rows
 */
export async function searchStructuredData(query, context = {}) {
  const { teamContext, limit = 20, filters = {} } = context

  try {
    // Build query
    let dbQuery = supabase
      .from('structured_data')
      .select('*')

    // Apply team context filter if present
    if (teamContext && teamContext !== 'general') {
      dbQuery = dbQuery.eq('team_context', teamContext)
    }

    // Apply custom filters
    if (filters.sku) {
      dbQuery = dbQuery.ilike('sku', `%${filters.sku}%`)
    }
    if (filters.category) {
      dbQuery = dbQuery.ilike('category', `%${filters.category}%`)
    }
    if (filters.dateFrom) {
      dbQuery = dbQuery.gte('date', filters.dateFrom)
    }
    if (filters.dateTo) {
      dbQuery = dbQuery.lte('date', filters.dateTo)
    }

    // Text search across key fields — escape user input to prevent filter injection
    if (query && query.length > 2) {
      const safeQuery = escapeFilterValue(query)
      if (safeQuery.length > 0) {
        dbQuery = dbQuery.or(
          `sku.ilike.%${safeQuery}%,category.ilike.%${safeQuery}%,notes.ilike.%${safeQuery}%,sheet_name.ilike.%${safeQuery}%`
        )
      }
    }

    // Order and limit
    dbQuery = dbQuery
      .order('updated_at', { ascending: false })
      .limit(limit)

    const { data, error } = await dbQuery

    if (error) {
      console.error('Error searching structured data:', error)
      return []
    }

    return data.map(row => ({
      type: 'structured',
      source: row.document_title || 'Spreadsheet',
      sourceUrl: row.document_url,
      sheetName: row.sheet_name,
      content: formatStructuredRow(row),
      rawData: row,
      score: 1.0, // Exact matches
      metadata: {
        team: row.team_context,
        updatedAt: row.updated_at,
        type: 'spreadsheet'
      }
    }))
  } catch (error) {
    console.error('Error in searchStructuredData:', error)
    return []
  }
}

/**
 * Format structured row data into readable text
 */
function formatStructuredRow(row) {
  const parts = []
  
  if (row.sku) parts.push(`SKU: ${row.sku}`)
  if (row.category) parts.push(`Category: ${row.category}`)
  if (row.date) parts.push(`Date: ${row.date}`)
  
  // Include any numeric/forecast data
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
 * Search semantic data (Docs content)
 * Uses vector similarity search
 */
export async function searchSemanticData(query, context = {}) {
  const { teamContext, topK = 5, minScore = 0.7 } = context

  try {
    // Get query embedding
    const queryEmbedding = await getEmbedding(query)

    // Search similar chunks
    let results = await searchSimilar(queryEmbedding, { topK: topK * 2, minScore })

    // Filter by team context if provided
    if (teamContext && teamContext !== 'general') {
      results = results.filter(r => 
        !r.metadata?.team_context || r.metadata.team_context === teamContext
      )
    }

    // Take top K after filtering
    results = results.slice(0, topK)

    return results.map(chunk => ({
      type: 'semantic',
      source: chunk.documentTitle || 'Document',
      sourceUrl: chunk.documentUrl,
      content: chunk.text,
      score: chunk.score,
      metadata: {
        ...chunk.metadata,
        type: 'document'
      }
    }))
  } catch (error) {
    console.error('Error in searchSemanticData:', error)
    return []
  }
}

/**
 * Hybrid retrieval - combines structured and semantic search
 */
export async function hybridRetrieval(query, userContext = {}) {
  console.log(`Hybrid retrieval for query: "${query}"`)
  
  // Analyze query intent
  const analysis = analyzeQuery(query, userContext)
  console.log('Query analysis:', analysis)

  const results = {
    structured: [],
    semantic: [],
    queryType: analysis.type,
    patterns: analysis.patterns
  }

  // Execute appropriate searches based on query type
  if (analysis.type === 'structured' || analysis.type === 'hybrid') {
    console.log('Executing structured search...')
    results.structured = await searchStructuredData(query, {
      teamContext: userContext.team,
      limit: 20
    })
    console.log(`Found ${results.structured.length} structured results`)
  }

  if (analysis.type === 'semantic' || analysis.type === 'hybrid') {
    console.log('Executing semantic search...')
    results.semantic = await searchSemanticData(query, {
      teamContext: userContext.team,
      topK: 5,
      minScore: 0.7
    })
    console.log(`Found ${results.semantic.length} semantic results`)
  }

  // Combine and rank results
  const combined = [...results.structured, ...results.semantic]
    .sort((a, b) => b.score - a.score)

  return {
    results: combined,
    structured: results.structured,
    semantic: results.semantic,
    queryType: analysis.type,
    totalResults: combined.length
  }
}

/**
 * Role-specific retrieval filters
 * Adjusts search based on user role
 */
export function getRoleSpecificContext(role) {
  const roleContexts = {
    'demand_planner': {
      team: 'demand',
      keywords: ['forecast', 'cpfr', 'demand', 'sales', 'projection'],
      preferredSources: ['forecast', 'cpfr', 'demand_plan']
    },
    'supply_planner': {
      team: 'supply',
      keywords: ['inventory', 'inbound', 'eta', 'pipeline', 'po'],
      preferredSources: ['pipeline', 'inventory', 'inbound']
    },
    'operations': {
      team: 'ops',
      keywords: ['tracking', 'shipment', 'logistics', 'warehouse'],
      preferredSources: ['tracking', 'logistics', 'warehouse']
    },
    'gtm': {
      team: 'gtm',
      keywords: ['launch', 'marketing', 'campaign', 'retail'],
      preferredSources: ['gtm', 'launch', 'retail_plan']
    },
    'sales': {
      team: 'sales',
      keywords: ['account', 'revenue', 'pipeline', 'forecast'],
      preferredSources: ['sales', 'account', 'revenue']
    },
    'management': {
      team: 'all',
      keywords: ['summary', 'report', 'overview', 'risk'],
      preferredSources: ['report', 'dashboard', 'summary']
    }
  }

  return roleContexts[role] || { team: 'general', keywords: [], preferredSources: [] }
}

/**
 * Extract SKU/ASIN from query
 */
export function extractSKU(query) {
  // Match patterns like B003XXX, SKU-123, etc.
  const patterns = [
    /\b(B0[0-9A-Z]{8})\b/gi,  // Amazon ASIN
    /\b(SKU[-_]?[0-9A-Z]+)\b/gi,  // SKU patterns
    /\b([A-Z]{2,4}[-_][0-9]{3,})\b/g  // Generic product codes
  ]

  for (const pattern of patterns) {
    const matches = query.match(pattern)
    if (matches && matches.length > 0) {
      return matches[0].toUpperCase()
    }
  }

  return null
}

/**
 * Build context-aware prompt for Claude
 */
export function buildContextualPrompt(query, retrievalResults, userContext) {
  const { role, team, name } = userContext

  let systemPrompt = `You are an internal knowledge assistant for a retail supply chain team, spanning roles including demand planners, supply planners, operations, GTM, sales, and management.

You have access to:
- Google Sheets (forecasts, CPFR, pipeline, inbound, tracking)
- Google Docs (SOPs, comments, meeting notes, training guides)
- Planner comments embedded in structured sheets
- Historical files, updated weekly or daily

Your job is to:
1. Answer team-specific questions using structured and unstructured data
2. Detect user context (role/team) from the query
3. Search all relevant documents and sheets
4. Return a clean, concise, human-friendly summary
5. Include planner comments or forecasts where relevant
6. If the answer spans multiple files, summarize across them
7. Always include numbers, weeks, SKUs, or accounts if mentioned
8. Say "No data found" if needed

`

  // Add role-specific context
  if (role && role !== 'general') {
    systemPrompt += `\nUser Role: ${role}\n`
    const roleContext = getRoleSpecificContext(role)
    systemPrompt += `Focus areas: ${roleContext.keywords.join(', ')}\n`
  }

  if (team && team !== 'general') {
    systemPrompt += `Team Context: ${team}\n`
  }

  // Add retrieved context
  const { structured, semantic, queryType } = retrievalResults

  if (structured.length > 0) {
    systemPrompt += `\n## Structured Data (Spreadsheets):\n`
    structured.slice(0, 10).forEach((item, idx) => {
      systemPrompt += `\n[${idx + 1}] ${item.source}${item.sheetName ? ` - ${item.sheetName}` : ''}\n${item.content}\n`
    })
  }

  if (semantic.length > 0) {
    systemPrompt += `\n## Documents & SOPs:\n`
    semantic.forEach((item, idx) => {
      systemPrompt += `\n[${idx + 1}] ${item.source}\n${item.content}\n`
    })
  }

  if (structured.length === 0 && semantic.length === 0) {
    systemPrompt += `\nNo relevant data found in the knowledge base for this query.`
  }

  systemPrompt += `\n\n## User Query:\n${query}\n`

  return systemPrompt
}
