/**
 * LLM-Powered Document Analyzer
 * Uses Claude to understand any spreadsheet layout without reformatting.
 * Detects headers, column types, sheet purposes, and cross-tab relationships.
 */

import Anthropic from '@anthropic-ai/sdk'
import { createHash } from 'crypto'
import { supabase } from './supabaseClient'
import { models, analysisConfig } from './modelConfig'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

/**
 * Hash the first N rows of a sheet tab for change detection.
 * Returns the same hash if content hasn't changed, allowing us to skip re-analysis.
 */
export function hashSheetContent(rows, maxRows = 50) {
  const subset = rows.slice(0, maxRows)
  const content = JSON.stringify(subset)
  return createHash('sha256').update(content).digest('hex')
}

/**
 * Analyze a single sheet tab using Claude to understand its structure.
 *
 * @param {Array<Array>} rows - All rows from the sheet tab
 * @param {string} sheetName - Name of the tab
 * @param {string} documentTitle - Title of the parent workbook
 * @param {string[]} allSheetNames - Names of all tabs in the workbook (for context)
 * @returns {Object} Structured analysis of the sheet
 */
export async function analyzeSheetTab(rows, sheetName, documentTitle, allSheetNames = []) {
  if (!rows || rows.length === 0) {
    return {
      header_row: null,
      data_start_row: null,
      sheet_type: 'general',
      columns: [],
      key_columns: [],
      logical_grouping_column: null,
      summary: 'Empty sheet'
    }
  }

  // Send first ~50 rows for analysis (enough to detect patterns without excessive tokens)
  const sampleRows = rows.slice(0, 50)
  const rowsText = sampleRows.map((row, idx) =>
    `Row ${idx}: ${row.map((cell, cidx) => `[${cidx}]${cell ?? ''}`).join(' | ')}`
  ).join('\n')

  const prompt = `Analyze this spreadsheet tab and return a JSON object describing its structure.

**Workbook:** ${documentTitle}
**Tab name:** ${sheetName}
**Other tabs in workbook:** ${allSheetNames.join(', ') || 'none'}

**First ${sampleRows.length} rows:**
${rowsText}

Return ONLY valid JSON (no markdown, no explanation) with this structure:
{
  "header_row": <number or null — which row index (0-based) contains column headers>,
  "data_start_row": <number — which row index the actual data begins>,
  "sheet_type": "<one of: forecast, pipeline, inventory, cpfr, psi, sales, sop, general>",
  "columns": [
    {
      "index": <column index>,
      "original_header": "<exact header text if found>",
      "normalized_name": "<snake_case standard name like 'sku', 'forecast_qty', 'week_ending'>",
      "data_type": "<string, number, date, currency, percentage, boolean>",
      "description": "<what this column represents>"
    }
  ],
  "key_columns": [<indices of columns that are primary identifiers like SKU, date, account>],
  "logical_grouping_column": <index of the best column for grouping rows into chunks, e.g. SKU column or category column, or null>,
  "summary": "<1-2 sentence description of what this tab contains>"
}`

  try {
    const response = await anthropic.messages.create({
      model: models.analysis,
      max_tokens: analysisConfig.maxTokens,
      temperature: analysisConfig.temperature,
      messages: [{ role: 'user', content: prompt }]
    })

    const text = response.content?.[0]?.text || '{}'

    // Parse JSON, handling potential markdown code fences
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(jsonStr)
  } catch (error) {
    console.error(`Error analyzing sheet tab "${sheetName}":`, error.message)
    // Return a minimal fallback analysis
    return {
      header_row: 0,
      data_start_row: 1,
      sheet_type: 'general',
      columns: [],
      key_columns: [],
      logical_grouping_column: null,
      summary: `Could not analyze: ${sheetName}`
    }
  }
}

/**
 * Analyze relationships between all tabs in a workbook.
 *
 * @param {Object} allTabData - Map of sheetName -> rows[]
 * @param {string} documentTitle - Title of the workbook
 * @returns {Array} Relationship descriptions
 */
export async function analyzeWorkbookRelationships(allTabData, documentTitle) {
  const tabNames = Object.keys(allTabData)

  if (tabNames.length < 2) {
    return [] // No relationships possible with a single tab
  }

  // Build a compact summary: tab name + first 5 rows
  const tabSummaries = tabNames.map(name => {
    const rows = allTabData[name] || []
    const preview = rows.slice(0, 5).map((row, idx) =>
      `  Row ${idx}: ${(row || []).join(' | ')}`
    ).join('\n')
    return `**Tab: ${name}**\n${preview}`
  }).join('\n\n')

  const prompt = `Analyze the relationships between tabs in this spreadsheet workbook.

**Workbook:** ${documentTitle}

${tabSummaries}

Return ONLY valid JSON (no markdown, no explanation) as an array of relationships:
[
  {
    "source_sheet": "<tab name that provides/drives data>",
    "target_sheet": "<tab name that consumes/references data>",
    "relationship_type": "<one of: drives, references, summarizes, derives_from, supplements>",
    "description": "<brief explanation of how these tabs relate>",
    "confidence": <0.0 to 1.0>
  }
]

Only include relationships you're confident about. Return [] if no clear relationships exist.`

  try {
    const response = await anthropic.messages.create({
      model: models.analysis,
      max_tokens: analysisConfig.maxTokens,
      temperature: analysisConfig.temperature,
      messages: [{ role: 'user', content: prompt }]
    })

    const text = response.content?.[0]?.text || '[]'
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(jsonStr)
  } catch (error) {
    console.error('Error analyzing workbook relationships:', error.message)
    return []
  }
}

/**
 * Store or update analysis for a sheet tab in the database.
 * Uses content_hash to skip re-analysis if the content hasn't changed.
 *
 * @param {string} documentId - UUID of the parent document
 * @param {string} sheetName - Name of the sheet tab
 * @param {Array<Array>} rows - Sheet rows
 * @param {string} documentTitle - Title of the workbook
 * @param {string[]} allSheetNames - All tab names in the workbook
 * @returns {Object} The analysis (cached or fresh)
 */
export async function getOrCreateAnalysis(documentId, sheetName, rows, documentTitle, allSheetNames) {
  const contentHash = hashSheetContent(rows)

  // Check for existing analysis with matching hash
  const { data: existing } = await supabase
    .from('document_analysis')
    .select('analysis')
    .eq('document_id', documentId)
    .eq('sheet_name', sheetName)
    .eq('content_hash', contentHash)
    .single()

  if (existing?.analysis) {
    console.log(`Using cached analysis for "${sheetName}" (hash match)`)
    return existing.analysis
  }

  // Run fresh analysis
  console.log(`Running LLM analysis for "${sheetName}"...`)
  const analysis = await analyzeSheetTab(rows, sheetName, documentTitle, allSheetNames)

  // Store in database
  const { error } = await supabase
    .from('document_analysis')
    .upsert({
      document_id: documentId,
      sheet_name: sheetName,
      analysis,
      model_used: models.analysis,
      content_hash: contentHash
    }, { onConflict: 'document_id,sheet_name' })

  if (error) {
    console.error('Error storing document analysis:', error)
  }

  return analysis
}

/**
 * Store workbook relationships in the database.
 *
 * @param {string} sourceDocumentId - UUID of the workbook document
 * @param {Array} relationships - Relationship array from analyzeWorkbookRelationships
 * @param {Object} sheetToDocMap - Optional map of sheet names to separate document IDs
 */
export async function storeRelationships(sourceDocumentId, relationships, sheetToDocMap = {}) {
  if (!relationships || relationships.length === 0) return

  for (const rel of relationships) {
    const targetDocId = sheetToDocMap[rel.target_sheet] || sourceDocumentId

    const { error } = await supabase
      .from('document_relationships')
      .upsert({
        source_document_id: sourceDocumentId,
        target_document_id: targetDocId,
        source_sheet_name: rel.source_sheet,
        target_sheet_name: rel.target_sheet,
        relationship_type: rel.relationship_type,
        description: rel.description,
        confidence: rel.confidence || 1.0
      }, {
        onConflict: 'source_document_id,target_document_id,source_sheet_name,target_sheet_name'
      })

    if (error) {
      console.error('Error storing relationship:', error)
    }
  }
}
