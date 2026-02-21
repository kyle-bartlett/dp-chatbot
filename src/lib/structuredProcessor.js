/**
 * Structured Data Processor
 * Processes Google Sheets into structured database records.
 *
 * Supports two modes:
 * 1. LLM analysis-driven parsing (Phase 2) — uses Claude to detect headers, types, and structure
 * 2. Regex-based fallback — the original detection for when no analysis is available
 */

import { supabase } from './supabaseClient'

/**
 * Detect sheet type based on headers (FALLBACK — used when no LLM analysis available)
 */
export function detectSheetTypeFallback(headers) {
  const headerStr = headers.join('|').toLowerCase()

  if (headerStr.match(/forecast|demand|projection|wo1|wo2|wo3|wo4/)) {
    return 'forecast'
  }
  if (headerStr.match(/pipeline|inbound|eta|arrival|shipment/)) {
    return 'pipeline'
  }
  if (headerStr.match(/inventory|stock|warehouse|units on hand/)) {
    return 'inventory'
  }
  if (headerStr.match(/cpfr|collaborative|planning/)) {
    return 'cpfr'
  }
  if (headerStr.match(/sales|revenue|orders|sell.?through/)) {
    return 'sales'
  }
  if (headerStr.match(/sku|asin|product|item/)) {
    return 'product'
  }

  return 'general'
}

// Keep old name as alias for backward compatibility
export const detectSheetType = detectSheetTypeFallback

/**
 * Normalize header names
 */
function normalizeHeader(header) {
  if (!header) return ''

  return header
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, '_')
}

/**
 * Map row data to normalized structure (FALLBACK — regex-based)
 */
function mapRowToStructure(row, headers, sheetType) {
  const normalized = {}

  // Create header map
  headers.forEach((header, idx) => {
    const normalizedHeader = normalizeHeader(header)
    const value = row[idx]

    if (normalizedHeader && value !== undefined && value !== null && value !== '') {
      normalized[normalizedHeader] = value
    }
  })

  // Extract common fields
  const result = {
    sheet_type: sheetType,
    sku: null,
    category: null,
    date: null,
    week: null,
    raw_data: normalized
  }

  // Try to find SKU/ASIN
  const skuFields = ['sku', 'asin', 'item_code', 'product_id', 'product_code', 'item']
  for (const field of skuFields) {
    if (normalized[field]) {
      result.sku = normalized[field]
      break
    }
  }

  // Try to find category
  const categoryFields = ['category', 'product_category', 'type', 'product_line']
  for (const field of categoryFields) {
    if (normalized[field]) {
      result.category = normalized[field]
      break
    }
  }

  // Try to find date/week
  const dateFields = ['date', 'week', 'week_of', 'period', 'month']
  for (const field of dateFields) {
    if (normalized[field]) {
      if (field.includes('week')) {
        result.week = normalized[field]
      } else {
        result.date = normalized[field]
      }
      break
    }
  }

  // Extract numeric fields based on sheet type
  if (sheetType === 'forecast') {
    const forecastFields = ['forecast', 'demand', 'projection', 'wo1', 'wo2', 'wo3', 'wo4', 'units']
    forecastFields.forEach(field => {
      if (normalized[field]) {
        result[field] = parseFloat(normalized[field]) || normalized[field]
      }
    })
  }

  if (sheetType === 'pipeline') {
    const pipelineFields = ['eta', 'etd', 'quantity', 'units', 'po_number', 'status']
    pipelineFields.forEach(field => {
      if (normalized[field]) {
        result[field] = normalized[field]
      }
    })
  }

  if (sheetType === 'inventory') {
    const inventoryFields = ['units_on_hand', 'available', 'reserved', 'incoming', 'warehouse']
    inventoryFields.forEach(field => {
      if (normalized[field]) {
        result[field] = parseFloat(normalized[field]) || normalized[field]
      }
    })
  }

  // Look for notes/comments
  const noteFields = ['notes', 'comments', 'remarks', 'description']
  for (const field of noteFields) {
    if (normalized[field]) {
      result.notes = normalized[field]
      break
    }
  }

  return result
}

/**
 * Process a sheet using LLM analysis results (Phase 2 — primary path).
 * Uses the analysis to correctly identify headers, data rows, and column semantics
 * regardless of where headers are in the sheet.
 *
 * @param {Array<Array>} rows - All rows from the sheet
 * @param {string} sheetName - Tab name
 * @param {Object} analysis - LLM analysis from documentAnalyzer
 * @param {Object} documentMetadata - Document metadata (id, title, url, teamContext)
 * @returns {Array} Structured records
 */
export function processSheetWithAnalysis(rows, sheetName, analysis, documentMetadata) {
  if (!rows || rows.length === 0 || !analysis) {
    return []
  }

  const headerRow = analysis.header_row ?? 0
  const dataStartRow = analysis.data_start_row ?? (headerRow + 1)
  const sheetType = analysis.sheet_type || 'general'
  const columns = analysis.columns || []

  // Build column mapping from analysis
  const columnMap = {}
  for (const col of columns) {
    columnMap[col.index] = col
  }

  // Get headers from the identified header row
  const headers = rows[headerRow] || []

  const records = []

  for (let i = dataStartRow; i < rows.length; i++) {
    const row = rows[i]

    // Skip empty rows
    if (!row || row.every(cell => !cell || cell.toString().trim() === '')) {
      continue
    }

    // Build normalized data using LLM column analysis
    const normalized = {}
    row.forEach((cell, idx) => {
      const colInfo = columnMap[idx]
      if (colInfo && cell !== undefined && cell !== null && cell !== '') {
        const key = colInfo.normalized_name || normalizeHeader(headers[idx] || `col_${idx}`)
        let value = cell

        // Type coercion based on LLM analysis
        if (colInfo.data_type === 'number' || colInfo.data_type === 'currency') {
          const parsed = parseFloat(String(value).replace(/[$,]/g, ''))
          if (!isNaN(parsed)) value = parsed
        } else if (colInfo.data_type === 'percentage') {
          const parsed = parseFloat(String(value).replace(/%/g, ''))
          if (!isNaN(parsed)) value = parsed
        }

        normalized[key] = value
      } else if (cell !== undefined && cell !== null && cell !== '') {
        // Fallback for columns not in analysis
        const key = normalizeHeader(headers[idx] || `col_${idx}`)
        if (key) normalized[key] = cell
      }
    })

    // Extract key fields using analysis key_columns
    const record = {
      sheet_type: sheetType,
      sku: null,
      category: null,
      date: null,
      week: null,
      raw_data: normalized,
      document_id: documentMetadata.documentId,
      document_title: documentMetadata.documentTitle,
      document_url: documentMetadata.documentUrl,
      sheet_name: sheetName,
      team_context: documentMetadata.teamContext || 'general',
      row_index: i
    }

    // Map key columns from analysis
    for (const keyIdx of (analysis.key_columns || [])) {
      const colInfo = columnMap[keyIdx]
      if (!colInfo) continue
      const value = row[keyIdx]
      if (value === undefined || value === null || value === '') continue

      const name = colInfo.normalized_name || ''
      if (name.includes('sku') || name.includes('asin') || name.includes('item') || name.includes('product')) {
        record.sku = String(value)
      } else if (name.includes('date') || name.includes('period') || name.includes('month')) {
        record.date = String(value)
      } else if (name.includes('week')) {
        record.week = String(value)
      } else if (name.includes('category') || name.includes('type') || name.includes('line')) {
        record.category = String(value)
      }
    }

    // Fallback: try to extract SKU/date from normalized data if not found via key_columns
    if (!record.sku) {
      for (const [key, val] of Object.entries(normalized)) {
        if (key.includes('sku') || key.includes('asin') || key === 'item_code' || key === 'product_id') {
          record.sku = String(val)
          break
        }
      }
    }
    if (!record.date && !record.week) {
      for (const [key, val] of Object.entries(normalized)) {
        if (key.includes('date') || key === 'period' || key === 'month') {
          record.date = String(val)
          break
        }
        if (key.includes('week')) {
          record.week = String(val)
          break
        }
      }
    }

    // Copy type-specific numeric fields into record
    // Guard: never overwrite reserved record fields with spreadsheet data
    const reservedFields = new Set([
      'sku', 'category', 'date', 'week', 'raw_data',
      'document_id', 'document_title', 'document_url',
      'sheet_name', 'team_context', 'row_index', 'sheet_type', 'notes'
    ])
    for (const [key, val] of Object.entries(normalized)) {
      if (typeof val === 'number' && !reservedFields.has(key)) {
        record[key] = val
      }
    }

    // Notes
    for (const [key, val] of Object.entries(normalized)) {
      if (key.includes('note') || key.includes('comment') || key.includes('remark')) {
        record.notes = String(val)
        break
      }
    }

    records.push(record)
  }

  return records
}

/**
 * Process a Google Sheet into structured records (FALLBACK — regex-based)
 */
export function processSheet(sheetData, sheetName, documentMetadata) {
  const rows = sheetData[sheetName]

  if (!rows || rows.length === 0) {
    return []
  }

  // First row is typically headers
  const headers = rows[0]

  // Detect what type of sheet this is
  const sheetType = detectSheetTypeFallback(headers)

  const records = []

  // Process each data row (skip header)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]

    // Skip empty rows
    if (!row || row.every(cell => !cell || cell.toString().trim() === '')) {
      continue
    }

    const record = mapRowToStructure(row, headers, sheetType)

    // Add document metadata
    record.document_id = documentMetadata.documentId
    record.document_title = documentMetadata.documentTitle
    record.document_url = documentMetadata.documentUrl
    record.sheet_name = sheetName
    record.team_context = documentMetadata.teamContext || 'general'
    record.row_index = i

    records.push(record)
  }

  return records
}

/**
 * Store structured records in database (atomic replace).
 */
export async function storeStructuredData(records, documentId) {
  if (!records || records.length === 0) {
    return { stored: 0, errors: 0 }
  }

  console.log(`Atomically replacing ${records.length} structured records for document ${documentId}`)

  const { data: insertedCount, error } = await supabase.rpc('replace_structured_data', {
    p_document_id: documentId,
    p_records: records
  })

  if (error) {
    console.error('Error in atomic structured data replacement:', error)
    return { stored: 0, errors: records.length, error }
  }

  console.log(`Stored ${insertedCount} structured records for document ${documentId}`)
  return { stored: insertedCount, errors: 0 }
}

/**
 * Process and store a complete spreadsheet.
 * Uses LLM analysis when available, falls back to regex-based parsing otherwise.
 *
 * @param {Object} spreadsheetContent - { content, sheets, title }
 * @param {Object} documentMetadata - { documentId, documentTitle, documentUrl, teamContext }
 * @param {Object} analyses - Optional map of sheetName -> LLM analysis objects
 */
export async function processAndStoreSpreadsheet(spreadsheetContent, documentMetadata, analyses = null) {
  const { content, sheets, title } = spreadsheetContent
  const allRecords = []

  // Process each sheet
  for (const sheetName of sheets) {
    console.log(`Processing sheet: ${sheetName}`)

    let records
    const sheetAnalysis = analyses?.[sheetName]

    if (sheetAnalysis) {
      // Use LLM analysis-driven parsing
      console.log(`Using LLM analysis for "${sheetName}" (type: ${sheetAnalysis.sheet_type})`)
      records = processSheetWithAnalysis(
        content[sheetName],
        sheetName,
        sheetAnalysis,
        documentMetadata
      )
    } else {
      // Fallback to regex-based parsing
      console.log(`Using regex fallback for "${sheetName}"`)
      records = processSheet(content, sheetName, documentMetadata)
    }

    allRecords.push(...records)

    console.log(`Extracted ${records.length} records from ${sheetName}`)
  }

  // Store all records
  const result = await storeStructuredData(allRecords, documentMetadata.documentId)

  return {
    totalRecords: allRecords.length,
    stored: result.stored,
    errors: result.errors,
    sheets: sheets.length
  }
}

/**
 * Query structured data with filters
 */
export async function queryStructuredData(filters = {}) {
  let query = supabase
    .from('structured_data')
    .select('*')

  // Apply filters
  if (filters.sku) {
    query = query.eq('sku', filters.sku)
  }
  if (filters.category) {
    query = query.eq('category', filters.category)
  }
  if (filters.sheetType) {
    query = query.eq('sheet_type', filters.sheetType)
  }
  if (filters.teamContext) {
    query = query.eq('team_context', filters.teamContext)
  }
  if (filters.documentId) {
    query = query.eq('document_id', filters.documentId)
  }
  if (filters.dateFrom) {
    query = query.gte('date', filters.dateFrom)
  }
  if (filters.dateTo) {
    query = query.lte('date', filters.dateTo)
  }

  // Sorting
  query = query.order('updated_at', { ascending: false })

  // Limit
  if (filters.limit) {
    query = query.limit(filters.limit)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error querying structured data:', error)
    return []
  }

  return data
}

/**
 * Get structured data stats
 */
export async function getStructuredDataStats(teamContext = null) {
  let query = supabase
    .from('structured_data')
    .select('sheet_type, team_context', { count: 'exact' })

  if (teamContext) {
    query = query.eq('team_context', teamContext)
  }

  const { data, error, count } = await query

  if (error) {
    console.error('Error getting structured data stats:', error)
    return { total: 0, byType: {} }
  }

  // Group by sheet type
  const byType = {}
  if (data) {
    data.forEach(row => {
      const type = row.sheet_type || 'general'
      byType[type] = (byType[type] || 0) + 1
    })
  }

  return {
    total: count || 0,
    byType
  }
}

/**
 * Calculate week-over-week deltas for forecast data
 */
export async function calculateWeekOverWeekDeltas(sku, weeks = 4) {
  const { data, error } = await supabase
    .from('structured_data')
    .select('*')
    .eq('sku', sku)
    .eq('sheet_type', 'forecast')
    .order('date', { ascending: false })
    .limit(weeks)

  if (error || !data || data.length < 2) {
    return null
  }

  const deltas = []
  for (let i = 1; i < data.length; i++) {
    const current = data[i - 1]
    const previous = data[i]

    const delta = {
      sku,
      currentWeek: current.week || current.date,
      previousWeek: previous.week || previous.date,
      changes: {}
    }

    // Calculate deltas for numeric fields
    const numericFields = ['forecast', 'units', 'wo1', 'wo2', 'wo3', 'wo4']
    numericFields.forEach(field => {
      if (current[field] !== undefined && previous[field] !== undefined) {
        const curr = parseFloat(current[field]) || 0
        const prev = parseFloat(previous[field]) || 0
        delta.changes[field] = {
          current: curr,
          previous: prev,
          delta: curr - prev,
          percentChange: prev !== 0 ? ((curr - prev) / prev * 100).toFixed(2) : 'N/A'
        }
      }
    })

    deltas.push(delta)
  }

  return deltas
}
