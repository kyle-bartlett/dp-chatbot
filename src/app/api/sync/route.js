/**
 * API Route: /api/sync
 * Handles Google Drive folder synchronization
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  listDriveFiles,
  getFolderMetadata,
  getFolderPath,
  saveSyncConfig,
  getSyncConfigs,
  syncFolder,
  getSyncStats,
  getFilesNeedingProcessing,
  markFileAsProcessed
} from '@/lib/driveSync'
import { fetchSpreadsheet, fetchDocument } from '@/lib/googleApi'
import { addDocument, addChunks } from '@/lib/vectorStore'
import { chunkDocument } from '@/lib/chunker'
import { getEmbeddings } from '@/lib/embeddings'
import { processAndStoreSpreadsheet } from '@/lib/structuredProcessor'
import { v4 as uuidv4 } from 'uuid'

export async function GET(request) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const folderId = searchParams.get('folderId')

    // Get sync configs
    if (action === 'configs') {
      const configs = await getSyncConfigs(session.user.email)
      return NextResponse.json({ configs })
    }

    // Get sync stats
    if (action === 'stats') {
      const stats = await getSyncStats(session.user.email)
      return NextResponse.json({ stats })
    }

    // List files in a folder
    if (action === 'list' && folderId) {
      const files = await listDriveFiles(
        folderId,
        session.accessToken,
        { recursive: false }
      )
      return NextResponse.json({ files })
    }

    // Get folder metadata
    if (action === 'metadata' && folderId) {
      const metadata = await getFolderMetadata(folderId, session.accessToken)
      const path = await getFolderPath(folderId, session.accessToken)
      return NextResponse.json({ metadata, path })
    }

    // Get files needing processing
    if (action === 'pending') {
      const files = await getFilesNeedingProcessing(20)
      return NextResponse.json({ files })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error in sync GET:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to process request' 
    }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, folderId, folderName, teamContext, syncFrequency } = body

    // Save sync configuration
    if (action === 'configure') {
      if (!folderId) {
        return NextResponse.json({ error: 'Folder ID required' }, { status: 400 })
      }

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

      return NextResponse.json({ 
        success: true,
        config,
        message: 'Sync configuration saved' 
      })
    }

    // Sync a folder
    if (action === 'sync') {
      if (!folderId) {
        return NextResponse.json({ error: 'Folder ID required' }, { status: 400 })
      }

      console.log(`Starting sync for folder ${folderId}`)

      const syncResult = await syncFolder(
        folderId,
        session.accessToken,
        session.user.email,
        teamContext || 'general'
      )

      return NextResponse.json({ 
        success: true,
        result: syncResult,
        message: `Synced ${syncResult.new} new files, ${syncResult.updated} updated` 
      })
    }

    // Process pending files (fetch content and embed)
    if (action === 'process') {
      const limit = body.limit || 5
      const pendingFiles = await getFilesNeedingProcessing(limit)

      const results = []

      for (const file of pendingFiles) {
        try {
          console.log(`Processing file: ${file.name} (${file.type})`)

          let documentId = uuidv4()
          let content

          // Fetch content from Google
          if (file.type === 'spreadsheet') {
            content = await fetchSpreadsheet(file.drive_file_id, session.accessToken)
            
            // Add to documents table
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

            // Process structured data
            const structuredResult = await processAndStoreSpreadsheet(content, {
              documentId,
              documentTitle: file.name,
              documentUrl: file.url,
              teamContext: file.team_context
            })

            // Also create text chunks for semantic search
            const textContent = formatSpreadsheetAsText(content)
            const chunks = chunkDocument(textContent, {
              documentId,
              documentTitle: file.name,
              documentUrl: file.url,
              metadata: {
                teamContext: file.team_context,
                type: 'spreadsheet'
              }
            })

            if (chunks.length > 0) {
              const embeddings = await getEmbeddings(chunks.map(c => c.text))
              await addChunks(chunks, embeddings)
            }

            results.push({
              file: file.name,
              success: true,
              structured: structuredResult,
              chunks: chunks.length
            })

          } else if (file.type === 'document') {
            content = await fetchDocument(file.drive_file_id, session.accessToken)
            
            // Add to documents table
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

            // Create chunks and embeddings
            const chunks = chunkDocument(content.content, {
              documentId,
              documentTitle: file.name,
              documentUrl: file.url,
              metadata: {
                teamContext: file.team_context,
                type: 'document'
              }
            })

            if (chunks.length > 0) {
              const embeddings = await getEmbeddings(chunks.map(c => c.text))
              await addChunks(chunks, embeddings)
            }

            results.push({
              file: file.name,
              success: true,
              chunks: chunks.length
            })
          }

          // Mark as processed
          await markFileAsProcessed(file.drive_file_id, documentId)

        } catch (error) {
          console.error(`Error processing file ${file.name}:`, error)
          results.push({
            file: file.name,
            success: false,
            error: error.message
          })
        }
      }

      return NextResponse.json({ 
        success: true,
        processed: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error in sync POST:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to process request' 
    }, { status: 500 })
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

    // Headers
    const headers = rows[0]
    text += headers.join(' | ') + '\n'
    text += '-'.repeat(80) + '\n'

    // Data rows (limit to first 100 to avoid huge chunks)
    for (let i = 1; i < Math.min(rows.length, 100); i++) {
      text += rows[i].join(' | ') + '\n'
    }
  }

  return text
}
