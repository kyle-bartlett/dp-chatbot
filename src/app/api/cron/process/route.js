/**
 * Cron Route: /api/cron/process
 * Runs every 15 minutes via Vercel Cron.
 * Claims up to 10 pending files, processes with LLM analysis + hierarchical chunking.
 */

import { auth as driveAuth } from '@googleapis/drive'
import { supabase } from '@/lib/supabaseClient'
import {
  claimFilesForProcessing,
  releaseClaimedFile,
  markFileAsProcessed
} from '@/lib/driveSync'
import { fetchSpreadsheet, fetchDocument } from '@/lib/googleApi'
import { addDocument, addChunks, removeDocument } from '@/lib/vectorStore'
import { chunkWithStrategy, chunkDocument } from '@/lib/chunker'
import { getEmbeddings } from '@/lib/embeddings'
import { processAndStoreSpreadsheet } from '@/lib/structuredProcessor'
import {
  getOrCreateAnalysis,
  analyzeWorkbookRelationships,
  storeRelationships
} from '@/lib/documentAnalyzer'
import { randomUUID } from 'crypto'

export const maxDuration = 60 // Vercel Pro: up to 60s function timeout

const BATCH_SIZE = 10

/**
 * Get an access token from a stored refresh token for the file's user.
 */
async function getAccessTokenForFile(file) {
  // Look up the sync config for this file's folder to get the refresh token
  const { data: config } = await supabase
    .from('sync_configs')
    .select('refresh_token')
    .eq('folder_id', file.folder_id)
    .not('refresh_token', 'is', null)
    .single()

  if (!config?.refresh_token) {
    throw new Error('No refresh token available for this file')
  }

  const oauth2Client = new driveAuth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  oauth2Client.setCredentials({ refresh_token: config.refresh_token })

  const { credentials } = await oauth2Client.refreshAccessToken()
  return credentials.access_token
}

export async function GET(request) {
  // Validate cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  console.log('Cron process started')

  const results = {
    processed: 0,
    failed: 0,
    details: []
  }

  try {
    const claimedFiles = await claimFilesForProcessing(BATCH_SIZE)

    if (claimedFiles.length === 0) {
      console.log('No files pending processing')
      return Response.json({ message: 'No files to process', ...results })
    }

    console.log(`Claimed ${claimedFiles.length} files for processing`)

    for (const file of claimedFiles) {
      let documentId = null

      try {
        const accessToken = await getAccessTokenForFile(file)
        documentId = randomUUID()

        if (file.type === 'spreadsheet') {
          const content = await fetchSpreadsheet(file.drive_file_id, accessToken)

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

          // LLM analysis per tab
          const analyses = {}
          const sheetNames = content.sheets || []

          if (process.env.ANTHROPIC_API_KEY) {
            for (const sheetName of sheetNames) {
              const rows = content.content[sheetName]
              if (rows && rows.length > 0) {
                try {
                  analyses[sheetName] = await getOrCreateAnalysis(
                    documentId, sheetName, rows, file.name, sheetNames
                  )
                } catch (e) {
                  console.error(`Analysis failed for "${sheetName}":`, e.message)
                }
              }
            }

            if (sheetNames.length >= 2) {
              try {
                const rels = await analyzeWorkbookRelationships(content.content, file.name)
                await storeRelationships(documentId, rels)
              } catch (e) {
                console.error('Relationship analysis failed:', e.message)
              }
            }
          }

          // Structured data
          const hasAnalysis = Object.keys(analyses).length > 0
          await processAndStoreSpreadsheet(content, {
            documentId,
            documentTitle: file.name,
            documentUrl: file.url,
            teamContext: file.team_context
          }, hasAnalysis ? analyses : null)

          // Chunking
          let chunks = []
          if (hasAnalysis) {
            for (const sheetName of sheetNames) {
              const rows = content.content[sheetName]
              if (!rows || rows.length === 0) continue
              chunks.push(...chunkWithStrategy('hierarchical', {
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
              }))
            }
          } else {
            const textContent = formatSpreadsheetAsText(content)
            chunks = chunkDocument(textContent, {
              documentId,
              documentTitle: file.name,
              documentUrl: file.url,
              metadata: { teamContext: file.team_context, type: 'spreadsheet' }
            })
          }

          if (chunks.length > 0) {
            const embeddings = await getEmbeddings(chunks.map(c => c.text))
            await addChunks(chunks, embeddings)
          }

          results.details.push({ file: file.name, status: 'processed', chunks: chunks.length })

        } else if (file.type === 'document') {
          const content = await fetchDocument(file.drive_file_id, accessToken)

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

          results.details.push({ file: file.name, status: 'processed', chunks: chunks.length })
        }

        await markFileAsProcessed(file.drive_file_id, documentId)
        results.processed++

      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error.message)

        if (documentId) {
          try {
            await removeDocument(documentId)
          } catch (e) {
            console.error(`Rollback failed for ${file.name}:`, e.message)
          }
        }

        await releaseClaimedFile(file.drive_file_id, error.message)
        results.failed++
        results.details.push({ file: file.name, status: 'failed', error: error.message })
      }
    }
  } catch (error) {
    console.error('Cron process error:', error)
    return Response.json({ error: 'Cron process failed' }, { status: 500 })
  }

  console.log(`Cron process complete: ${results.processed} processed, ${results.failed} failed`)
  return Response.json(results)
}

/**
 * Format spreadsheet content as text for chunking (fallback)
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
