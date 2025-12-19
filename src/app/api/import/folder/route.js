/**
 * Drive folder import
 * POST /api/import/folder
 * Body: { folderUrl?: string, folderId?: string }
 *
 * Imports Google Docs/Sheets from a Drive folder using the signed-in user's OAuth token.
 */

import { auth } from '@/lib/auth'
import { listDriveFolder, fetchSpreadsheet, fetchDocument } from '@/lib/googleApi'
import { addDocument, addChunks, getStats } from '@/lib/vectorStore'
import { processDocument } from '@/lib/chunker'
import { generateEmbeddings } from '@/lib/embeddings'

function extractFolderId(input) {
  if (!input) return null
  // https://drive.google.com/drive/folders/FOLDER_ID
  const match = String(input).match(/\/folders\/([a-zA-Z0-9-_]+)/)
  if (match) return match[1]
  // Allow passing raw id
  if (/^[a-zA-Z0-9-_]{10,}$/.test(input)) return input
  return null
}

function buildDocUrl(file) {
  // Prefer the Drive webViewLink if available
  if (file?.webViewLink) return file.webViewLink
  // Fallback by mimeType
  if (file?.mimeType === 'application/vnd.google-apps.spreadsheet') {
    return `https://docs.google.com/spreadsheets/d/${file.id}/edit`
  }
  if (file?.mimeType === 'application/vnd.google-apps.document') {
    return `https://docs.google.com/document/d/${file.id}/edit`
  }
  return undefined
}

export async function POST(request) {
  try {
    const session = await auth()
    const accessToken = session?.accessToken

    if (!accessToken) {
      return Response.json(
        {
          error: 'Not signed in. Please sign in with Google to import from Drive.',
        },
        { status: 401 }
      )
    }

    const body = await request.json()
    const folderId = extractFolderId(body.folderId || body.folderUrl)
    if (!folderId) {
      return Response.json(
        { error: 'Invalid folder. Provide a Drive folder URL or folderId.' },
        { status: 400 }
      )
    }

    const files = await listDriveFolder(folderId, { accessToken })
    const supported = files.filter(f =>
      f.mimeType === 'application/vnd.google-apps.spreadsheet' ||
      f.mimeType === 'application/vnd.google-apps.document'
    )

    const results = {
      folderId,
      totalFiles: files.length,
      supportedFiles: supported.length,
      imported: 0,
      skipped: 0,
      errors: [],
      embeddingsEnabled: !!process.env.OPENAI_API_KEY,
    }

    for (const file of supported) {
      try {
        const url = buildDocUrl(file)
        const docId = file.id

        let docData
        if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
          docData = await fetchSpreadsheet(docId, { accessToken })
        } else {
          docData = await fetchDocument(docId, { accessToken })
        }

        // Save/update document metadata
        const document = {
          id: docId,
          title: docData.title || file.name,
          type: docData.type,
          url,
          fetchedAt: new Date().toISOString(),
        }
        await addDocument(document)

        // Chunk and store
        let chunks = []
        if (docData.type === 'spreadsheet') {
          for (const [sheetName, rows] of Object.entries(docData.content || {})) {
            const sheetDoc = {
              id: `${docId}-${sheetName}`,
              title: `${document.title} - ${sheetName}`,
              type: 'spreadsheet',
              content: rows,
              url,
            }
            chunks.push(...processDocument(sheetDoc))
          }
        } else {
          chunks = processDocument({
            id: docId,
            title: document.title,
            type: docData.type,
            content: docData.content,
            url,
          })
        }

        if (chunks.length > 0) {
          if (process.env.OPENAI_API_KEY) {
            const texts = chunks.map(c => c.text)
            const embeddings = await generateEmbeddings(texts)
            await addChunks(chunks, embeddings)
          } else {
            await addChunks(chunks, null)
          }
        }

        results.imported++
      } catch (e) {
        results.errors.push({ fileId: file.id, name: file.name, error: e?.message || String(e) })
      }
    }

    const stats = await getStats()

    return Response.json({
      success: true,
      results,
      stats,
    })
  } catch (error) {
    console.error('Folder import error:', error)
    return Response.json(
      { error: error.message || 'Failed to import folder' },
      { status: 500 }
    )
  }
}

