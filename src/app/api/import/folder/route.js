/**
 * API Route: /api/import/folder
 * Imports all supported files from a Google Drive folder.
 *
 * Idempotency: Uses uuid v5 with the Google Drive File ID as input to
 * generate a deterministic document UUID. Re-importing the same folder
 * will update existing documents rather than creating duplicates.
 * The addDocument function uses upsert (ON CONFLICT id), and the
 * addChunks function atomically replaces chunks for the same document.
 */

import { z } from 'zod'
import { auth } from "@/lib/auth"
import { processDocument } from "@/lib/chunker"
import { generateEmbeddings } from "@/lib/embeddings"
import { addDocument, addChunks, removeDocument } from "@/lib/vectorStore"
import { v5 as uuidv5 } from 'uuid'
import {
  ErrorCode,
  apiError,
  apiSuccess,
  requireAuth,
  validateBody,
  generateRequestId,
  sanitizeError
} from '@/lib/apiUtils'

// Stable namespace UUID for generating deterministic document IDs from Drive File IDs.
// This is the RFC 4122 "URL" namespace UUID — a well-known constant.
const DRIVE_ID_NAMESPACE = '6ba7b811-9dad-11d1-80b4-00c04fd430c8'

// Google Drive folder IDs: alphanumeric, hyphens, underscores only
const FOLDER_ID_REGEX = /^[a-zA-Z0-9_-]+$/

const importFolderSchema = z.object({
  folderId: z
    .string()
    .min(1, 'folderId is required')
    .max(200)
    .regex(FOLDER_ID_REGEX, 'Invalid folder ID format')
})

/**
 * Generate a deterministic UUID from a Google Drive File ID.
 * The same Drive File ID always produces the same document UUID,
 * making re-imports idempotent.
 */
function deterministicDocId(driveFileId) {
  return uuidv5(driveFileId, DRIVE_ID_NAMESPACE)
}

export async function POST(req) {
  const requestId = generateRequestId()

  // Auth check — require valid session with OAuth access token
  const { session, errorResponse: authError } = await requireAuth()
  if (authError) return authError

  if (!session.accessToken) {
    return apiError(
      ErrorCode.UNAUTHORIZED,
      'Google OAuth access token required. Please sign in with Google.',
      401,
      requestId
    )
  }

  // Validate request body
  const { data: body, errorResponse: validationError } = await validateBody(req, importFolderSchema)
  if (validationError) return validationError

  const { folderId } = body

  try {
    // Dynamic import to save memory on startup
    const { google } = await import('googleapis')

    const oauth2Client = new google.auth.OAuth2()
    oauth2Client.setCredentials({ access_token: session.accessToken })

    const drive = google.drive({ version: 'v3', auth: oauth2Client })

    // folderId is validated by regex above — safe to interpolate into Drive query
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, webViewLink, modifiedTime)',
      pageSize: 100
    })

    const files = res.data.files
    if (!files || files.length === 0) {
      return apiSuccess({
        message: 'No files found in folder',
        count: 0
      }, requestId)
    }

    let processedCount = 0
    let skippedCount = 0
    let errors = []

    for (const file of files) {
      try {
        let content = ''
        let type = 'text'

        if (file.mimeType === 'application/vnd.google-apps.document') {
          const exportRes = await drive.files.export({
            fileId: file.id,
            mimeType: 'text/plain'
          })
          content = exportRes.data
          type = 'document'
        } else if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
          const exportRes = await drive.files.export({
            fileId: file.id,
            mimeType: 'text/csv'
          })
          content = exportRes.data
          type = 'spreadsheet'
        } else if (file.mimeType === 'application/pdf') {
          skippedCount++
          continue
        } else if (file.mimeType === 'text/plain') {
          const getRes = await drive.files.get({ fileId: file.id, alt: 'media' })
          content = getRes.data
        } else {
          skippedCount++
          continue
        }

        if (!content) {
          skippedCount++
          continue
        }

        // DETERMINISTIC ID: Same Drive File ID always produces same document UUID.
        // This makes re-importing idempotent — addDocument uses upsert (ON CONFLICT id)
        // and addChunks atomically replaces chunks for the same document.
        const docId = deterministicDocId(file.id)

        const docMetadata = {
          id: docId,
          title: file.name,
          type,
          url: file.webViewLink,
          metadata: {
            googleDriveId: file.id,
            lastUpdated: file.modifiedTime,
            source_url: file.webViewLink
          },
          content
        }

        // Upsert document (creates if new, updates if exists)
        await addDocument(docMetadata)

        // Process chunks
        const chunks = processDocument(docMetadata)

        if (chunks.length > 0) {
          const texts = chunks.map(c => c.text)
          const embeddings = await generateEmbeddings(texts)
          // Atomically replace chunks (handles dedup via RPC transaction)
          await addChunks(chunks, embeddings)
        }

        processedCount++

      } catch (err) {
        console.error(`Error processing file ${file.name}:`, err)

        // If document was created but chunks failed, clean up the orphan
        try {
          const failedDocId = deterministicDocId(file.id)
          await removeDocument(failedDocId)
          console.log(`Rolled back orphaned document ${failedDocId} for file ${file.name}`)
        } catch (rollbackErr) {
          console.error(`Failed to rollback document for ${file.name}:`, rollbackErr.message)
        }

        // Sanitize — don't leak raw error to response
        errors.push({ file: file.name, error: sanitizeError(err, 'Processing failed') })
      }
    }

    return apiSuccess({
      success: true,
      processed: processedCount,
      skipped: skippedCount,
      totalFound: files.length,
      errors
    }, requestId)

  } catch (error) {
    console.error("Import error:", error)
    return apiError(
      ErrorCode.INTERNAL_ERROR,
      sanitizeError(error, 'Failed to import folder'),
      500,
      requestId
    )
  }
}
