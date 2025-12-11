/**
 * Text chunking utilities for document processing
 * Splits documents into smaller, overlapping chunks for better retrieval
 */

const DEFAULT_CHUNK_SIZE = 1000  // characters
const DEFAULT_OVERLAP = 200      // characters

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
  const { sheetName = 'Sheet', includeHeaders = true } = options

  if (!data || data.length === 0) {
    return []
  }

  const chunks = []
  const headers = data[0] || []

  // Process in groups of rows
  const rowsPerChunk = 10
  for (let i = 1; i < data.length; i += rowsPerChunk) {
    const rowGroup = data.slice(i, i + rowsPerChunk)

    let chunkText = `[${sheetName}]\n`
    if (includeHeaders && headers.length > 0) {
      chunkText += `Headers: ${headers.join(' | ')}\n\n`
    }

    rowGroup.forEach((row, idx) => {
      const rowNum = i + idx
      const rowData = row.map((cell, cellIdx) => {
        const header = headers[cellIdx] || `Column ${cellIdx + 1}`
        return `${header}: ${cell || '(empty)'}`
      }).join(', ')
      chunkText += `Row ${rowNum}: ${rowData}\n`
    })

    chunks.push(chunkText.trim())
  }

  return chunks
}

/**
 * Process a document and return chunks with metadata
 */
export function processDocument(doc) {
  const { id, title, type, content, url } = doc
  let chunks = []

  if (type === 'spreadsheet') {
    // Content should be an array of arrays (rows)
    chunks = chunkSpreadsheet(content, { sheetName: title })
  } else {
    // Text content (docs, etc.)
    chunks = chunkText(typeof content === 'string' ? content : JSON.stringify(content))
  }

  return chunks.map((text, index) => ({
    id: `${id}-chunk-${index}`,
    documentId: id,
    documentTitle: title,
    documentType: type,
    documentUrl: url,
    chunkIndex: index,
    totalChunks: chunks.length,
    text,
    createdAt: new Date().toISOString()
  }))
}
