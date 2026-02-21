/**
 * Hierarchical Chunker
 * Replaces fixed-size chunking with content-aware chunking.
 *
 * For spreadsheets: Groups rows by logical column (SKU, category)
 * For documents: Splits by sections (headings, numbered sections)
 *
 * Each chunk has a parent-child relationship for contextual retrieval.
 */

import { randomUUID } from 'crypto'

const MAX_CHUNK_CHARS = 12000
const MIN_CHUNK_CHARS = 100

/**
 * Chunk a spreadsheet by logical groups using LLM analysis.
 *
 * @param {Array<Array>} rows - All sheet rows
 * @param {Object} analysis - LLM analysis from documentAnalyzer
 * @param {Object} metadata - { documentId, documentTitle, documentUrl, sheetName, teamContext }
 * @returns {Array} Chunks with parent-child hierarchy
 */
export function chunkSheetByLogicalGroups(rows, analysis, metadata) {
  if (!rows || rows.length === 0) return []

  const headerRow = analysis?.header_row ?? 0
  const dataStartRow = analysis?.data_start_row ?? (headerRow + 1)
  const groupingCol = analysis?.logical_grouping_column
  const headers = rows[headerRow] || []

  const chunks = []

  // Build header string for context
  const headerStr = headers.filter(h => h).join(' | ')

  // Create parent chunk (sheet summary)
  const parentId = randomUUID()
  const parentChunk = {
    id: `${metadata.documentId}-${metadata.sheetName}-summary`,
    documentId: metadata.documentId,
    documentTitle: metadata.documentTitle,
    documentUrl: metadata.documentUrl,
    text: buildSheetSummaryText(metadata.sheetName, headers, analysis, rows.length - dataStartRow),
    chunkLevel: 'section',
    parentChunkId: null,
    sectionTitle: `${metadata.sheetName} (Summary)`,
    metadata: {
      teamContext: metadata.teamContext,
      type: 'spreadsheet',
      sheetName: metadata.sheetName,
      sheetType: analysis?.sheet_type || 'general'
    }
  }
  chunks.push(parentChunk)

  // If we have a logical grouping column, group rows by that column's values
  if (groupingCol !== null && groupingCol !== undefined && groupingCol < headers.length) {
    const groups = new Map()

    for (let i = dataStartRow; i < rows.length; i++) {
      const row = rows[i]
      if (!row || row.every(cell => !cell || String(cell).trim() === '')) continue

      const groupKey = String(row[groupingCol] || 'Ungrouped').trim()
      if (!groups.has(groupKey)) groups.set(groupKey, [])
      groups.get(groupKey).push({ index: i, data: row })
    }

    // Create a child chunk per group
    for (const [groupKey, groupRows] of groups) {
      let groupText = `[${metadata.sheetName}] ${headers[groupingCol] || 'Group'}: ${groupKey}\n`
      groupText += `Headers: ${headerStr}\n\n`

      for (const { index, data } of groupRows) {
        const rowText = data.map((cell, cidx) => {
          const header = headers[cidx] || `Col${cidx}`
          return `${header}: ${cell ?? '(empty)'}`
        }).join(', ')
        groupText += `Row ${index}: ${rowText}\n`
      }

      // If group exceeds max size, split into sub-chunks
      if (groupText.length > MAX_CHUNK_CHARS) {
        const subChunks = splitLargeGroup(groupText, groupKey, metadata, parentChunk.id)
        chunks.push(...subChunks)
      } else if (groupText.length >= MIN_CHUNK_CHARS) {
        chunks.push({
          id: `${metadata.documentId}-${metadata.sheetName}-${groupKey}`,
          documentId: metadata.documentId,
          documentTitle: metadata.documentTitle,
          documentUrl: metadata.documentUrl,
          text: groupText.trim(),
          chunkLevel: 'group',
          parentChunkId: parentChunk.id,
          sectionTitle: `${metadata.sheetName} > ${groupKey}`,
          metadata: {
            teamContext: metadata.teamContext,
            type: 'spreadsheet',
            sheetName: metadata.sheetName,
            groupKey
          }
        })
      }
    }
  } else {
    // No logical grouping — fall back to fixed-row batching (existing behavior)
    const rowsPerChunk = 10
    for (let i = dataStartRow; i < rows.length; i += rowsPerChunk) {
      let chunkText = `[${metadata.sheetName}]\nHeaders: ${headerStr}\n\n`

      for (let j = i; j < Math.min(i + rowsPerChunk, rows.length); j++) {
        const row = rows[j]
        if (!row || row.every(cell => !cell || String(cell).trim() === '')) continue

        const rowText = row.map((cell, cidx) => {
          const header = headers[cidx] || `Col${cidx}`
          return `${header}: ${cell ?? '(empty)'}`
        }).join(', ')
        chunkText += `Row ${j}: ${rowText}\n`
      }

      if (chunkText.length >= MIN_CHUNK_CHARS) {
        chunks.push({
          id: `${metadata.documentId}-${metadata.sheetName}-rows-${i}`,
          documentId: metadata.documentId,
          documentTitle: metadata.documentTitle,
          documentUrl: metadata.documentUrl,
          text: chunkText.trim(),
          chunkLevel: 'paragraph',
          parentChunkId: parentChunk.id,
          sectionTitle: `${metadata.sheetName} Rows ${i}-${Math.min(i + rowsPerChunk - 1, rows.length - 1)}`,
          metadata: {
            teamContext: metadata.teamContext,
            type: 'spreadsheet',
            sheetName: metadata.sheetName
          }
        })
      }
    }
  }

  return chunks
}

/**
 * Split a large group into sub-chunks
 */
function splitLargeGroup(groupText, groupKey, metadata, parentId) {
  const lines = groupText.split('\n')
  const chunks = []
  let current = ''
  let subIdx = 0

  // Preserve the header lines (group identifier + column headers) for each sub-chunk
  // so every sub-chunk retains context about what the data represents.
  const headerLines = []
  for (const line of lines) {
    if (line.startsWith('Headers:') || line.startsWith('[')) {
      headerLines.push(line)
    } else {
      break
    }
  }
  const headerPrefix = headerLines.length > 0 ? headerLines.join('\n') + '\n\n' : ''

  for (const line of lines) {
    if (current.length + line.length + 1 > MAX_CHUNK_CHARS && current.length >= MIN_CHUNK_CHARS) {
      chunks.push({
        id: `${metadata.documentId}-${metadata.sheetName}-${groupKey}-${subIdx}`,
        documentId: metadata.documentId,
        documentTitle: metadata.documentTitle,
        documentUrl: metadata.documentUrl,
        text: current.trim(),
        chunkLevel: 'paragraph',
        parentChunkId: parentId,
        sectionTitle: `${metadata.sheetName} > ${groupKey} (Part ${subIdx + 1})`,
        metadata: {
          teamContext: metadata.teamContext,
          type: 'spreadsheet',
          sheetName: metadata.sheetName,
          groupKey
        }
      })
      // Start the next sub-chunk with the header context so it's not lost
      current = headerPrefix
      subIdx++
    }
    current += line + '\n'
  }

  if (current.trim().length >= MIN_CHUNK_CHARS) {
    chunks.push({
      id: `${metadata.documentId}-${metadata.sheetName}-${groupKey}-${subIdx}`,
      documentId: metadata.documentId,
      documentTitle: metadata.documentTitle,
      documentUrl: metadata.documentUrl,
      text: current.trim(),
      chunkLevel: 'paragraph',
      parentChunkId: parentId,
      sectionTitle: `${metadata.sheetName} > ${groupKey} (Part ${subIdx + 1})`,
      metadata: {
        teamContext: metadata.teamContext,
        type: 'spreadsheet',
        sheetName: metadata.sheetName,
        groupKey
      }
    })
  }

  return chunks
}

/**
 * Build a summary text for a sheet tab
 */
function buildSheetSummaryText(sheetName, headers, analysis, rowCount) {
  let text = `Sheet: ${sheetName}\n`
  text += `Type: ${analysis?.sheet_type || 'general'}\n`
  text += `Columns: ${headers.filter(h => h).join(', ')}\n`
  text += `Data rows: ${rowCount}\n`

  if (analysis?.summary) {
    text += `Summary: ${analysis.summary}\n`
  }

  if (analysis?.columns?.length > 0) {
    text += `\nColumn details:\n`
    for (const col of analysis.columns) {
      text += `- ${col.original_header || col.normalized_name}: ${col.description || col.data_type}\n`
    }
  }

  return text
}

/**
 * Chunk a document by sections (headings, numbered sections, whitespace gaps).
 *
 * @param {string} text - Document text content
 * @param {Object} metadata - { documentId, documentTitle, documentUrl, teamContext }
 * @returns {Array} Chunks with parent-child hierarchy
 */
export function chunkDocumentBySections(text, metadata) {
  if (!text || text.trim().length === 0) return []

  const cleanText = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  // Detect sections via headings
  const sectionPattern = /^(?:#{1,4}\s+.+|(?:\d+\.)+\s+.+|[A-Z][A-Z\s]{3,}[A-Z](?:\s*$))/gm
  const matches = [...cleanText.matchAll(sectionPattern)]

  const chunks = []

  // Create parent chunk (document summary / table of contents)
  const sectionTitles = matches.map(m => m[0].trim())
  const parentText = `Document: ${metadata.documentTitle}\n` +
    (sectionTitles.length > 0
      ? `Sections:\n${sectionTitles.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n`
      : `Length: ${cleanText.length} characters\n`)

  const parentChunk = {
    id: `${metadata.documentId}-summary`,
    documentId: metadata.documentId,
    documentTitle: metadata.documentTitle,
    documentUrl: metadata.documentUrl,
    text: parentText,
    chunkLevel: 'section',
    parentChunkId: null,
    sectionTitle: `${metadata.documentTitle} (Overview)`,
    metadata: {
      teamContext: metadata.teamContext,
      type: 'document'
    }
  }
  chunks.push(parentChunk)

  if (matches.length === 0) {
    // No sections detected — use paragraph-based chunking
    const paragraphs = cleanText.split('\n\n').filter(p => p.trim().length > 0)
    let currentChunk = ''
    let chunkIdx = 0

    for (const para of paragraphs) {
      if (currentChunk.length + para.length + 2 > MAX_CHUNK_CHARS && currentChunk.length >= MIN_CHUNK_CHARS) {
        chunks.push({
          id: `${metadata.documentId}-chunk-${chunkIdx}`,
          documentId: metadata.documentId,
          documentTitle: metadata.documentTitle,
          documentUrl: metadata.documentUrl,
          text: currentChunk.trim(),
          chunkLevel: 'paragraph',
          parentChunkId: parentChunk.id,
          sectionTitle: null,
          metadata: {
            teamContext: metadata.teamContext,
            type: 'document'
          }
        })
        currentChunk = ''
        chunkIdx++
      }
      currentChunk += para + '\n\n'
    }

    if (currentChunk.trim().length >= MIN_CHUNK_CHARS) {
      chunks.push({
        id: `${metadata.documentId}-chunk-${chunkIdx}`,
        documentId: metadata.documentId,
        documentTitle: metadata.documentTitle,
        documentUrl: metadata.documentUrl,
        text: currentChunk.trim(),
        chunkLevel: 'paragraph',
        parentChunkId: parentChunk.id,
        sectionTitle: null,
        metadata: {
          teamContext: metadata.teamContext,
          type: 'document'
        }
      })
    }

    return chunks
  }

  // Split into sections
  for (let i = 0; i < matches.length; i++) {
    const sectionStart = matches[i].index
    const sectionEnd = i + 1 < matches.length ? matches[i + 1].index : cleanText.length
    const sectionText = cleanText.slice(sectionStart, sectionEnd).trim()
    const sectionTitle = matches[i][0].trim()

    if (sectionText.length < MIN_CHUNK_CHARS) continue

    // If section is too large, split into sub-chunks
    if (sectionText.length > MAX_CHUNK_CHARS) {
      const subParagraphs = sectionText.split('\n\n')
      let subChunk = ''
      let subIdx = 0

      for (const para of subParagraphs) {
        if (subChunk.length + para.length + 2 > MAX_CHUNK_CHARS && subChunk.length >= MIN_CHUNK_CHARS) {
          chunks.push({
            id: `${metadata.documentId}-section-${i}-sub-${subIdx}`,
            documentId: metadata.documentId,
            documentTitle: metadata.documentTitle,
            documentUrl: metadata.documentUrl,
            text: subChunk.trim(),
            chunkLevel: 'paragraph',
            parentChunkId: parentChunk.id,
            sectionTitle: `${sectionTitle} (Part ${subIdx + 1})`,
            metadata: {
              teamContext: metadata.teamContext,
              type: 'document'
            }
          })
          subChunk = ''
          subIdx++
        }
        subChunk += para + '\n\n'
      }

      if (subChunk.trim().length >= MIN_CHUNK_CHARS) {
        chunks.push({
          id: `${metadata.documentId}-section-${i}-sub-${subIdx}`,
          documentId: metadata.documentId,
          documentTitle: metadata.documentTitle,
          documentUrl: metadata.documentUrl,
          text: subChunk.trim(),
          chunkLevel: 'paragraph',
          parentChunkId: parentChunk.id,
          sectionTitle: `${sectionTitle} (Part ${subIdx + 1})`,
          metadata: {
            teamContext: metadata.teamContext,
            type: 'document'
          }
        })
      }
    } else {
      chunks.push({
        id: `${metadata.documentId}-section-${i}`,
        documentId: metadata.documentId,
        documentTitle: metadata.documentTitle,
        documentUrl: metadata.documentUrl,
        text: sectionText,
        chunkLevel: 'paragraph',
        parentChunkId: parentChunk.id,
        sectionTitle,
        metadata: {
          teamContext: metadata.teamContext,
          type: 'document'
        }
      })
    }
  }

  // Handle content before the first section heading
  if (matches.length > 0 && matches[0].index > MIN_CHUNK_CHARS) {
    const preamble = cleanText.slice(0, matches[0].index).trim()
    if (preamble.length >= MIN_CHUNK_CHARS) {
      chunks.splice(1, 0, {
        id: `${metadata.documentId}-preamble`,
        documentId: metadata.documentId,
        documentTitle: metadata.documentTitle,
        documentUrl: metadata.documentUrl,
        text: preamble,
        chunkLevel: 'paragraph',
        parentChunkId: parentChunk.id,
        sectionTitle: 'Introduction',
        metadata: {
          teamContext: metadata.teamContext,
          type: 'document'
        }
      })
    }
  }

  return chunks
}
