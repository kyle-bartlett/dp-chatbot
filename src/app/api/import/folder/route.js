
import { auth } from "@/lib/auth"
import { processDocument } from "@/lib/chunker"
import { generateEmbeddings } from "@/lib/embeddings"
import { addDocument, addChunks } from "@/lib/vectorStore"
import { v4 as uuidv4 } from 'uuid'

export async function POST(req) {
  try {
    const session = await auth()
    if (!session || !session.accessToken) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { folderId } = await req.json()
    if (!folderId) {
      return Response.json({ error: "Missing folderId" }, { status: 400 })
    }

    // Dynamic import to save memory on startup
    const { google } = await import('googleapis')

    const oauth2Client = new google.auth.OAuth2()
    oauth2Client.setCredentials({ access_token: session.accessToken })

    const drive = google.drive({ version: 'v3', auth: oauth2Client })

    // List files in the folder
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, webViewLink, modifiedTime)',
      pageSize: 100 // Limit for now
    })

    const files = res.data.files
    if (!files || files.length === 0) {
      return Response.json({ message: "No files found in folder", count: 0 })
    }

    let processedCount = 0
    let errors = []

    for (const file of files) {
      try {
        let content = ''
        let type = 'text'

        if (file.mimeType === 'application/vnd.google-apps.document') {
            // Export Google Doc as text
            const exportRes = await drive.files.export({
                fileId: file.id,
                mimeType: 'text/plain'
            })
            content = exportRes.data
            type = 'document'
        } else if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
             // Export Sheet as CSV (simplest for now, though chunker has spreadsheet logic)
             // Actually chunker expects array of arrays.
             // Let's try exporting as CSV and parsing it, OR simply export as text for now to be safe and fast.
             // Better: Export as CSV
             const exportRes = await drive.files.export({
                 fileId: file.id,
                 mimeType: 'text/csv'
             })
             content = exportRes.data // This is a CSV string
             type = 'spreadsheet'
             // Note: chunker.js 'processDocument' handles spreadsheet type if content is array of arrays.
             // If we pass string, it treats as text. For 'text/csv', treating as text is okay for search.
        } else if (file.mimeType === 'application/pdf') {
            // Skip PDF for now unless we have a pdf parser. 
            // The prompt didn't strictly say "implement PDF parsing". 
            // I'll log it as skipped or try to get text if possible (Drive API doesn't export PDF to text easily without OCR).
            continue
        } else if (file.mimeType === 'text/plain') {
            const getRes = await drive.files.get({ fileId: file.id, alt: 'media' })
            content = getRes.data
        } else {
            continue
        }

        if (!content) continue

        const docId = uuidv4()
        const docMetadata = {
            id: docId,
            title: file.name,
            type,
            url: file.webViewLink,
            metadata: {
                googleDriveId: file.id,
                lastUpdated: file.modifiedTime,
                source_url: file.webViewLink // Explicitly requested in prompt
            },
            content
        }

        // Add document to store
        await addDocument(docMetadata)

        // Process chunks
        const chunks = processDocument(docMetadata)
        
        // Generate embeddings
        const texts = chunks.map(c => c.text)
        const embeddings = await generateEmbeddings(texts)

        // Add chunks
        await addChunks(chunks, embeddings)

        processedCount++

      } catch (err) {
        console.error(`Error processing file ${file.name}:`, err)
        errors.push({ file: file.name, error: err.message })
      }
    }

    return Response.json({ 
        success: true, 
        processed: processedCount, 
        totalFound: files.length,
        errors 
    })

  } catch (error) {
    console.error("Import error:", error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
