/**
 * Structured Data Processor
 * Processes Google Sheets into structured database records
 * Handles forecasts, pipeline data, inventory, CPFR, etc.
 */

import { supabase } from './supabaseClient'

/**
 * Detect sheet type based on headers
 */
export function detectSheetType(headers) {
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
 * Map row data to normalized structure
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
 * Process a Google Sheet into structured records
 */
export function processSheet(sheetData, sheetName, documentMetadata) {
  const rows = sheetData[sheetName]
  
  if (!rows || rows.length === 0) {
    return []
  }

  // First row is typically headers
  const headers = rows[0]
  
  // Detect what type of sheet this is
  const sheetType = detectSheetType(headers)

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
 * Store structured records in database
 */
export async function storeStructuredData(records, documentId) {
  if (!records || records.length === 0) {
    return { stored: 0, errors: 0 }
  }

  // First, delete existing records for this document to avoid duplicates
  const { error: deleteError } = await supabase
    .from('structured_data')
    .delete()
    .eq('document_id', documentId)

  if (deleteError) {
    console.error('Error deleting old structured data:', deleteError)
  }

  // Insert new records
  const { data, error } = await supabase
    .from('structured_data')
    .insert(records)

  if (error) {
    console.error('Error inserting structured data:', error)
    return { stored: 0, errors: records.length, error }
  }

  console.log(`Stored ${records.length} structured records for document ${documentId}`)
  
  return { stored: records.length, errors: 0 }
}

/**
 * Process and store a complete spreadsheet
 */
export async function processAndStoreSpreadsheet(spreadsheetContent, documentMetadata) {
  const { content, sheets, title } = spreadsheetContent
  const allRecords = []

  // Process each sheet
  for (const sheetName of sheets) {
    console.log(`Processing sheet: ${sheetName}`)
    
    const records = processSheet(content, sheetName, documentMetadata)
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
