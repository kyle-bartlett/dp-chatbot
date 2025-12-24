/**
 * Text chunking utilities for document processing
 * Splits documents into smaller, overlapping chunks for better retrieval
 */

const DEFAULT_CHUNK_SIZE = 1000  // characters
const DEFAULT_OVERLAP = 200      // characters
// Embedding models cap input tokens (~8k). Use a conservative char limit for sheets.
const DEFAULT_MAX_CHUNK_CHARS = 12000

/**
 * Split text into overlapping chunks
 */
export function chunkText(text, options = {}) {
  const chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE
  const overlap = options.overlap || DEFAULT_OVERLAP

  if (!text || text.length === 0) {
    return []
  }

  // Clean up the text
  const cleanText = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (cleanText.length <= chunkSize) {
    return [cleanText]
  }

  const chunks = []
  let start = 0

  while (start < cleanText.length) {
    let end = start + chunkSize

    // Try to break at a natural boundary (sentence, paragraph, or word)
    if (end < cleanText.length) {
      // Look for paragraph break
      const paragraphBreak = cleanText.lastIndexOf('\n\n', end)
      if (paragraphBreak > start + chunkSize / 2) {
        end = paragraphBreak
      } else {
        // Look for sentence break
        const sentenceBreak = Math.max(
          cleanText.lastIndexOf('. ', end),
          cleanText.lastIndexOf('! ', end),
          cleanText.lastIndexOf('? ', end)
        )
        if (sentenceBreak > start + chunkSize / 2) {
          end = sentenceBreak + 1
        } else {
          // Look for word break
          const wordBreak = cleanText.lastIndexOf(' ', end)
          if (wordBreak > start + chunkSize / 2) {
            end = wordBreak
          }
        }
      }
    }

    chunks.push(cleanText.slice(start, end).trim())
    start = end - overlap

    // Prevent infinite loop
    if (start <= chunks.length - 1 ? chunks[chunks.length - 1].length : 0) {
      start = end
    }
  }

  return chunks.filter(chunk => chunk.length > 0)
}

/**
 * Chunk a Google Sheet into rows/sections
 */
export function chunkSpreadsheet(data, options = {}) {
  const { sheetName = 'Sheet', includeHeaders = true, maxChunkChars = DEFAULT_MAX_CHUNK_CHARS } = options

  if (!data || data.length === 0) {
    return []
  }

  const chunks = []
  const headers = (data[0] || []).map(h => String(h || '').trim()).filter(h => h.length > 0)

  // Process in groups of rows with a hard size cap
  const rowsPerChunk = 10
  let currentChunk = ''
  let currentRows = 0

  const startChunk = () => {
    let base = `[${sheetName}]\n`
    if (includeHeaders && headers.length > 0) {
      base += `Headers: ${headers.join(' | ')}\n\n`
    }
    currentChunk = base
    currentRows = 0
  }

  startChunk()

  for (let i = 1; i < data.length; i++) {
    const row = data[i]
    if (!row || !Array.isArray(row)) {
      continue // Skip invalid rows
    }

    const rowData = row.map((cell, cellIdx) => {
      const header = headers[cellIdx] || `Column ${cellIdx + 1}`
      // Convert cell to string and handle null/undefined
      const cellValue = cell === null || cell === undefined ? '(empty)' : String(cell).trim()
      return `${header}: ${cellValue || '(empty)'}`
    }).join(', ')
    
    const rowLine = `Row ${i}: ${rowData}\n`

    // If adding this row would exceed the cap or row count, flush current chunk first.
    if (
      currentRows > 0 &&
      (currentChunk.length + rowLine.length > maxChunkChars || currentRows >= rowsPerChunk)
    ) {
      const trimmed = currentChunk.trim()
      if (trimmed.length > 0) {
        chunks.push(trimmed)
      }
      startChunk()
    }

    currentChunk += rowLine
    currentRows += 1
  }

  const finalChunk = currentChunk.trim()
  if (finalChunk.length > 0) {
    chunks.push(finalChunk)
  }

  // Filter out any empty chunks
  return chunks.filter(chunk => chunk && chunk.trim().length > 0)
}

/**
 * Process a document and return chunks with metadata
 */
export function processDocument(doc) {
  const { id, title, type, content, url } = doc
  let chunks = []

  if (type === 'spreadsheet') {
    // Content should be an array of arrays (rows)
    if (Array.isArray(content)) {
      chunks = chunkSpreadsheet(content, { sheetName: title })
    } else {
      console.warn('Spreadsheet content is not an array:', typeof content)
      chunks = []
    }
  } else {
    // Text content (docs, etc.)
    const textContent = typeof content === 'string' 
      ? content 
      : (content ? JSON.stringify(content) : '')
    chunks = chunkText(textContent)
  }

  // Filter out empty chunks and ensure all have valid text
  return chunks
    .filter(text => text && typeof text === 'string' && text.trim().length > 0)
    .map((text, index) => ({
      id: `${id}-chunk-${index}`,
      documentId: id,
      documentTitle: title || 'Untitled',
      documentType: type || 'document',
      documentUrl: url || '',
      chunkIndex: index,
      totalChunks: chunks.length,
      text: text.trim(),
      createdAt: new Date().toISOString()
    }))
}
