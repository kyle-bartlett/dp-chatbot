/**
 * Document management API routes
 * GET - List all documents (requires auth)
 * POST - Add a new document from URL or manual text (requires auth)
 */

import { z } from 'zod'
import { randomUUID } from 'crypto'
import { fetchGoogleContent, extractDocId, detectDocType } from '@/lib/googleApi'
import { processDocument } from '@/lib/chunker'
import { generateEmbeddings } from '@/lib/embeddings'
import { addDocument, addChunks, removeDocument, getDocuments, getStats } from '@/lib/vectorStore'
import {
  ErrorCode,
  apiError,
  apiSuccess,
  requireAuth,
  validateBody,
  generateRequestId,
  sanitizeError,
  safeError
} from '@/lib/apiUtils'

const documentPostSchema = z.object({
  url: z.string().url('Invalid URL format').optional(),
  title: z.string().max(500).optional(),
  content: z.string().max(1_000_000, 'Content exceeds maximum length').optional(),
  type: z.enum(['document', 'spreadsheet', 'text']).optional()
}).refine(data => data.url || data.content, {
  message: 'Either url or content is required'
})

export async function GET() {
  const requestId = generateRequestId()

  // Auth check
  const { session, errorResponse: authError } = await requireAuth()
  if (authError) return authError

  try {
    const documents = await getDocuments()
    const stats = await getStats()

    return apiSuccess({ documents, stats }, requestId)
  } catch (error) {
    console.error('Error listing documents:', error)
    return apiError(
      ErrorCode.INTERNAL_ERROR,
      sanitizeError(error, 'Failed to list documents'),
      500,
      requestId
    )
  }
}

export async function POST(request) {
  const requestId = generateRequestId()

  // Auth check
  const { session, errorResponse: authError } = await requireAuth()
  if (authError) return authError

  // Validate request body
  const { data: body, errorResponse: validationError } = await validateBody(request, documentPostSchema)
  if (validationError) return validationError

  try {
    const { url, title: customTitle, content: manualContent, type: manualType } = body

    let docData
    let docId

    // Option 1: Fetch from Google URL
    if (url) {
      if (!url.includes('docs.google.com')) {
        return apiError(
          ErrorCode.VALIDATION_ERROR,
          'Only Google Docs and Sheets URLs are supported',
          400,
          requestId
        )
      }

      if (!session.accessToken) {
        return apiError(
          ErrorCode.UNAUTHORIZED,
          'Please sign in with your Google account to import Google documents',
          401,
          requestId
        )
      }

      const googleDocId = extractDocId(url)
      if (!googleDocId) {
        return apiError(
          ErrorCode.VALIDATION_ERROR,
          'Could not extract document ID from URL',
          400,
          requestId
        )
      }

      docId = googleDocId
      try {
        docData = await fetchGoogleContent(url, session.accessToken)
        docData.url = url
      } catch (googleError) {
        console.error('Error fetching Google content:', googleError)
        if (googleError.message?.includes('404') || googleError.message?.includes('not found')) {
          return apiError(
            ErrorCode.NOT_FOUND,
            'Document not found. Please check the URL and ensure you have access.',
            404,
            requestId
          )
        }
        if (googleError.message?.includes('403') || googleError.message?.includes('Access denied')) {
          return apiError(
            ErrorCode.FORBIDDEN,
            'Access denied. Please ensure you have permission to view this document.',
            403,
            requestId
          )
        }
        return apiError(
          ErrorCode.EXTERNAL_SERVICE_ERROR,
          sanitizeError(googleError, 'Failed to fetch document from Google'),
          502,
          requestId
        )
      }
    }
    // Option 2: Manual content
    else if (manualContent) {
      docId = randomUUID()
      docData = {
        title: customTitle || 'Manual Document',
        type: manualType || 'document',
        content: manualContent,
        fetchedAt: new Date().toISOString()
      }
    }

    // Override title if provided
    if (customTitle) {
      docData.title = customTitle
    }

    // Save document metadata
    const document = {
      id: docId,
      title: docData.title,
      type: docData.type,
      url: docData.url,
      fetchedAt: docData.fetchedAt
    }

    // Ensure document is saved before processing chunks
    let savedDocument
    try {
      savedDocument = await addDocument(document)
      if (!savedDocument || !savedDocument.id) {
        throw safeError('Failed to save document metadata')
      }
      docId = savedDocument.id
    } catch (docError) {
      console.error('Error saving document:', docError)
      return apiError(
        ErrorCode.INTERNAL_ERROR,
        sanitizeError(docError, 'Failed to save document metadata'),
        500,
        requestId
      )
    }

    // Process into chunks
    let chunks
    if (docData.type === 'spreadsheet') {
      chunks = []
      if (docData.content && typeof docData.content === 'object') {
        for (const [sheetName, rows] of Object.entries(docData.content)) {
          if (!Array.isArray(rows)) continue
          if (rows.length === 0) continue

          const sheetDoc = {
            id: docId,
            title: `${docData.title} - ${sheetName}`,
            type: 'spreadsheet',
            content: rows,
            url: docData.url
          }
          const sheetChunks = processDocument(sheetDoc)
          chunks.push(...sheetChunks)
        }
      }
    } else {
      chunks = processDocument({
        id: docId,
        title: docData.title,
        type: docData.type,
        content: docData.content,
        url: docData.url
      })
    }

    // Generate embeddings
    if (chunks.length > 0) {
      const validChunks = chunks.filter(c =>
        c &&
        c.text &&
        typeof c.text === 'string' &&
        c.text.trim().length > 0
      )

      if (validChunks.length === 0) {
        return apiSuccess({
          success: true,
          document,
          chunksCreated: 0,
          warning: 'Document processed but no valid text content found for embedding',
          stats: await getStats()
        }, requestId)
      }

      const texts = validChunks.map(c => {
        const text = typeof c.text === 'string' ? c.text : String(c.text)
        return text.trim()
      }).filter(text => text.length > 0)

      if (texts.length === 0) {
        return apiSuccess({
          success: true,
          document,
          chunksCreated: 0,
          warning: 'No valid text content found in chunks for embedding',
          stats: await getStats()
        }, requestId)
      }

      if (!process.env.OPENAI_API_KEY) {
        // ROLLBACK: Remove the orphaned document
        try {
          await removeDocument(savedDocument.id || docId)
        } catch (rollbackErr) {
          console.error('Failed to rollback document:', rollbackErr)
        }
        return apiError(
          ErrorCode.SERVICE_UNAVAILABLE,
          'Embedding service is not configured. The document was not saved.',
          503,
          requestId
        )
      }

      const finalDocId = savedDocument.id || docId

      // Fix chunk document IDs if mismatched
      const allChunksHaveCorrectDocId = validChunks.every(chunk => chunk.documentId === finalDocId)
      if (!allChunksHaveCorrectDocId) {
        validChunks.forEach(chunk => {
          chunk.documentId = finalDocId
        })
      }

      let embeddings
      try {
        embeddings = await generateEmbeddings(texts)
      } catch (embeddingError) {
        console.error('Error generating embeddings:', embeddingError)
        try {
          await removeDocument(finalDocId)
        } catch (rollbackErr) {
          console.error('Failed to rollback document:', rollbackErr)
        }
        return apiError(
          ErrorCode.EXTERNAL_SERVICE_ERROR,
          sanitizeError(embeddingError, 'Failed to generate embeddings. The document was not saved.'),
          502,
          requestId
        )
      }

      if (embeddings.length !== validChunks.length) {
        console.error(`Embedding count mismatch: ${embeddings.length} embeddings for ${validChunks.length} chunks`)
        try {
          await removeDocument(finalDocId)
        } catch (rollbackErr) {
          console.error('Failed to rollback document:', rollbackErr)
        }
        return apiError(
          ErrorCode.INTERNAL_ERROR,
          'Failed to generate embeddings for all chunks. The document was not saved.',
          500,
          requestId
        )
      }

      try {
        await addChunks(validChunks, embeddings)
      } catch (chunkError) {
        console.error('Error adding chunks:', chunkError)
        try {
          await removeDocument(finalDocId)
        } catch (rollbackErr) {
          console.error('Failed to rollback document:', rollbackErr)
        }
        return apiError(
          ErrorCode.INTERNAL_ERROR,
          sanitizeError(chunkError, 'Failed to save document chunks. The document was not saved.'),
          500,
          requestId
        )
      }
    }

    const stats = await getStats()

    return apiSuccess({
      success: true,
      document,
      chunksCreated: chunks.length,
      stats
    }, requestId)
  } catch (error) {
    console.error('Error adding document:', error)
    return apiError(
      ErrorCode.INTERNAL_ERROR,
      sanitizeError(error, 'Failed to add document'),
      500,
      requestId
    )
  }
}
