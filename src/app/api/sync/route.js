/**
 * API Route: /api/sync
 * Handles Google Drive folder synchronization with LLM-powered document analysis
 */

import { z } from 'zod'
import {
  listDriveFiles,
  getFolderMetadata,
  getFolderPath,
  saveSyncConfig,
  getSyncConfigs,
  syncFolder,
  getSyncStats,
  getFilesNeedingProcessing,
  claimFilesForProcessing,
  releaseClaimedFile,
  markFileAsProcessed,
  acquireSyncLock,
  releaseSyncLock
} from '@/lib/driveSync'
import { fetchSpreadsheet, fetchDocument } from '@/lib/googleApi'
import { addDocument, addChunks, removeDocument } from '@/lib/vectorStore'
import { chunkDocument, chunkWithStrategy } from '@/lib/chunker'
import { getEmbeddings } from '@/lib/embeddings'
import { processAndStoreSpreadsheet } from '@/lib/structuredProcessor'
import {
  getOrCreateAnalysis,
  analyzeWorkbookRelationships,
  storeRelationships
} from '@/lib/documentAnalyzer'
import { randomUUID } from 'crypto'
import {
  ErrorCode,
  apiError,
  apiSuccess,
  requireAuth,
  validateBody,
  validateParams,
  generateRequestId,
  sanitizeError
} from '@/lib/apiUtils'

// Google Drive folder IDs: alphanumeric, hyphens, underscores only
const FOLDER_ID_REGEX = /^[a-zA-Z0-9_-]+$/

const syncGetSchema = z.object({
  action: z.enum(['configs', 'stats', 'list', 'metadata', 'pending']),
  folderId: z.string().regex(FOLDER_ID_REGEX, 'Invalid folder ID format').optional()
}).refine(data => {
  if (['list', 'metadata'].includes(data.action) && !data.folderId) {
    return false
  }
  return true
}, { message: 'folderId is required for this action' })

const syncPostSchema = z.object({
  action: z.enum(['configure', 'sync', 'process']),
  folderId: z.string().regex(FOLDER_ID_REGEX, 'Invalid folder ID format').optional(),
  folderName: z.string().max(500).optional(),
  teamContext: z.string().max(100).optional(),
  syncFrequency: z.enum(['hourly', 'daily', 'weekly']).optional(),
  limit: z.number().int().min(1).max(50).optional()
}).refine(data => {
  if (['configure', 'sync'].includes(data.action) && !data.folderId) {
    return false
  }
  return true
}, { message: 'folderId is required for this action' })

export async function GET(request) {
  const requestId = generateRequestId()

  const { session, errorResponse: authError } = await requireAuth()
  if (authError) return authError

  // Validate query params
  const { searchParams } = new URL(request.url)
  const { data: params, errorResponse: validationError } = validateParams(searchParams, syncGetSchema)
  if (validationError) return validationError

  const { action, folderId } = params

  try {
    if (action === 'configs') {
      const configs = await getSyncConfigs(session.user.email)
      return apiSuccess({ configs }, requestId)
    }

    if (action === 'stats') {
      const stats = await getSyncStats(session.user.email)
      return apiSuccess({ stats }, requestId)
    }

    if (action === 'list') {
      const files = await listDriveFiles(
        folderId,
        session.accessToken,
        { recursive: false }
      )
      return apiSuccess({ files }, requestId)
    }

    if (action === 'metadata') {
      const metadata = await getFolderMetadata(folderId, session.accessToken)
      const path = await getFolderPath(folderId, session.accessToken)
      return apiSuccess({ metadata, path }, requestId)
    }

    if (action === 'pending') {
      const files = await getFilesNeedingProcessing(20)
      return apiSuccess({ files }, requestId)
    }

    return apiError(ErrorCode.VALIDATION_ERROR, 'Invalid action', 400, requestId)
  } catch (error) {
    console.error('Error in sync GET:', error)
    return apiError(
      ErrorCode.INTERNAL_ERROR,
      sanitizeError(error, 'Failed to process sync request'),
      500,
      requestId
    )
  }
}

export async function POST(request) {
  const requestId = generateRequestId()

  const { session, errorResponse: authError } = await requireAuth()
  if (authError) return authError

  // Validate request body
  const { data: body, errorResponse: validationError } = await validateBody(request, syncPostSchema)
  if (validationError) return validationError

  const { action, folderId, folderName, teamContext, syncFrequency } = body

  try {
    // Save sync configuration
    if (action === 'configure') {
      const path = await getFolderPath(folderId, session.accessToken)

      const config = await saveSyncConfig({
        user_id: session.user.email,
        folder_id: folderId,
        folder_name: folderName || path[path.length - 1]?.name || 'Unknown Folder',
        folder_path: path,
        team_context: teamContext || 'general',
        sync_enabled: true,
        sync_frequency: syncFrequency || 'daily'
      })

      return apiSuccess({
        success: true,
        config,
        message: 'Sync configuration saved'
      }, requestId)
    }

    // Sync a folder (with concurrency lock)
    if (action === 'sync') {
      const lockAcquired = await acquireSyncLock(folderId)
      if (!lockAcquired) {
        return apiError(
          ErrorCode.CONFLICT,
          'This folder is already being synced. Please wait and try again.',
          409,
          requestId
        )
      }

      try {
        console.log(`Starting sync for folder ${folderId}`)

        const syncResult = await syncFolder(
          folderId,
          session.accessToken,
          session.user.email,
          teamContext || 'general'
        )

        return apiSuccess({
          success: true,
          result: syncResult,
          message: `Synced ${syncResult.new} new files, ${syncResult.updated} updated`
        }, requestId)
      } finally {
        await releaseSyncLock(folderId)
      }
    }

    // Process pending files (fetch content, analyze, and embed)
    if (action === 'process') {
      const limit = body.limit || 5

      // ATOMIC CLAIM: prevents two workers from processing the same files
      const claimedFiles = await claimFilesForProcessing(limit)

      if (claimedFiles.length === 0) {
        return apiSuccess({
          success: true,
          processed: 0,
          failed: 0,
          results: [],
          message: 'No files available for processing'
        }, requestId)
      }

      console.log(`Claimed ${claimedFiles.length} files for processing`)
      const results = []

      for (const file of claimedFiles) {
        let documentId = null

        try {
          console.log(`Processing claimed file: ${file.name} (${file.type})`)

          documentId = randomUUID()
          let content

          if (file.type === 'spreadsheet') {
            content = await fetchSpreadsheet(file.drive_file_id, session.accessToken)

            await addDocument({
              id: documentId,
              title: file.name,
              type: 'spreadsheet',
              url: file.url,
              metadata: {
                driveFileId: file.drive_file_id,
                teamContext: file.team_context,
                owners: file.owners,
                modifiedTime: file.modified_time
              }
            })

            // Phase 2: LLM analysis per tab
            const analyses = {}
            const sheetNames = content.sheets || []

            if (process.env.ANTHROPIC_API_KEY) {
              for (const sheetName of sheetNames) {
                const rows = content.content[sheetName]
                if (rows && rows.length > 0) {
                  try {
                    analyses[sheetName] = await getOrCreateAnalysis(
                      documentId,
                      sheetName,
                      rows,
                      file.name,
                      sheetNames
                    )
                  } catch (analysisError) {
                    console.error(`Analysis failed for tab "${sheetName}":`, analysisError.message)
                    // Continue without analysis for this tab
                  }
                }
              }

              // Analyze workbook relationships (only if multiple tabs)
              if (sheetNames.length >= 2) {
                try {
                  const relationships = await analyzeWorkbookRelationships(content.content, file.name)
                  await storeRelationships(documentId, relationships)
                  console.log(`Stored ${relationships.length} tab relationships for ${file.name}`)
                } catch (relError) {
                  console.error('Relationship analysis failed:', relError.message)
                }
              }
            }

            // Process structured data using LLM analyses (or fallback)
            const structuredResult = await processAndStoreSpreadsheet(content, {
              documentId,
              documentTitle: file.name,
              documentUrl: file.url,
              teamContext: file.team_context
            }, Object.keys(analyses).length > 0 ? analyses : null)

            // Phase 4: Use hierarchical chunking when analysis available, else fixed-size
            let allChunks = []
            const hasAnalysis = Object.keys(analyses).length > 0

            if (hasAnalysis) {
              for (const sheetName of sheetNames) {
                const rows = content.content[sheetName]
                if (!rows || rows.length === 0) continue

                const sheetChunks = chunkWithStrategy('hierarchical', {
                  type: 'spreadsheet',
                  rows,
                  analysis: analyses[sheetName],
                  metadata: {
                    documentId,
                    documentTitle: file.name,
                    documentUrl: file.url,
                    sheetName,
                    teamContext: file.team_context
                  }
                })
                allChunks.push(...sheetChunks)
              }
            } else {
              const textContent = formatSpreadsheetAsText(content)
              allChunks = chunkDocument(textContent, {
                documentId,
                documentTitle: file.name,
                documentUrl: file.url,
                metadata: {
                  teamContext: file.team_context,
                  type: 'spreadsheet'
                }
              })
            }

            if (allChunks.length > 0) {
              const embeddings = await getEmbeddings(allChunks.map(c => c.text))
              await addChunks(allChunks, embeddings)
            }

            results.push({
              file: file.name,
              success: true,
              structured: structuredResult,
              chunks: allChunks.length,
              analysisUsed: hasAnalysis,
              chunkStrategy: hasAnalysis ? 'hierarchical' : 'fixed'
            })

          } else if (file.type === 'document') {
            content = await fetchDocument(file.drive_file_id, session.accessToken)

            await addDocument({
              id: documentId,
              title: file.name,
              type: 'document',
              url: file.url,
              metadata: {
                driveFileId: file.drive_file_id,
                teamContext: file.team_context,
                owners: file.owners,
                modifiedTime: file.modified_time
              }
            })

            // Phase 4: Use section-aware chunking for documents
            const chunks = chunkWithStrategy('hierarchical', {
              type: 'document',
              text: content.content,
              metadata: {
                documentId,
                documentTitle: file.name,
                documentUrl: file.url,
                teamContext: file.team_context
              }
            })

            if (chunks.length > 0) {
              const embeddings = await getEmbeddings(chunks.map(c => c.text))
              await addChunks(chunks, embeddings)
            }

            results.push({
              file: file.name,
              success: true,
              chunks: chunks.length,
              chunkStrategy: 'hierarchical'
            })
          }

          await markFileAsProcessed(file.drive_file_id, documentId)

        } catch (error) {
          console.error(`Error processing file ${file.name}:`, error)

          if (documentId) {
            try {
              await removeDocument(documentId)
              console.log(`Rolled back orphaned document ${documentId} for file ${file.name}`)
            } catch (rollbackErr) {
              console.error(`Failed to rollback document for ${file.name}:`, rollbackErr.message)
            }
          }

          // Release the claimed file back with sanitized error message
          await releaseClaimedFile(file.drive_file_id, sanitizeError(error, 'Processing failed'))

          results.push({
            file: file.name,
            success: false,
            error: sanitizeError(error, 'Processing failed')
          })
        }
      }

      return apiSuccess({
        success: true,
        processed: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      }, requestId)
    }

    return apiError(ErrorCode.VALIDATION_ERROR, 'Invalid action', 400, requestId)
  } catch (error) {
    console.error('Error in sync POST:', error)
    return apiError(
      ErrorCode.INTERNAL_ERROR,
      sanitizeError(error, 'Failed to process sync request'),
      500,
      requestId
    )
  }
}

/**
 * Format spreadsheet content as text for chunking
 */
function formatSpreadsheetAsText(spreadsheetContent) {
  const { title, sheets, content } = spreadsheetContent
  let text = `Document: ${title}\n\n`

  for (const sheetName of sheets) {
    const rows = content[sheetName]
    if (!rows || rows.length === 0) continue

    text += `\n## Sheet: ${sheetName}\n\n`

    const headers = rows[0]
    text += headers.join(' | ') + '\n'
    text += '-'.repeat(80) + '\n'

    for (let i = 1; i < Math.min(rows.length, 100); i++) {
      text += rows[i].join(' | ') + '\n'
    }
  }

  return text
}
