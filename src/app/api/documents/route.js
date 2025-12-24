/**
 * Document management API routes
 * GET - List all documents
 * POST - Add a new document from URL or manual text
 */

import { v4 as uuidv4 } from 'uuid'
import { auth } from '@/lib/auth'
import { fetchGoogleContent, extractDocId, detectDocType } from '@/lib/googleApi'
import { processDocument } from '@/lib/chunker'
import { generateEmbeddings } from '@/lib/embeddings'
import { addDocument, addChunks, getDocuments, getStats } from '@/lib/vectorStore'

export async function GET() {
  try {
    const documents = await getDocuments()
    const stats = await getStats()

    return Response.json({
      documents,
      stats
    })
  } catch (error) {
    console.error('Error listing documents:', error)
    return Response.json(
      { error: 'Failed to list documents' },
      { status: 500 }
    )
  }
}

export async function POST(request) {
  try {
    // Get user session for OAuth token
    const session = await auth()

    const body = await request.json()
    const { url, title: customTitle, content: manualContent, type: manualType } = body

    let docData
    let docId

    // Option 1: Fetch from Google URL
    if (url) {
      // Validate it's a Google URL
      if (!url.includes('docs.google.com')) {
        return Response.json(
          { error: 'Only Google Docs and Sheets URLs are supported' },
          { status: 400 }
        )
      }

      // Require authentication for Google URLs
      if (!session?.accessToken) {
        return Response.json(
          { error: 'Please sign in with your Google account to import Google documents' },
          { status: 401 }
        )
      }

      const googleDocId = extractDocId(url)
      if (!googleDocId) {
        return Response.json(
          { error: 'Could not extract document ID from URL' },
          { status: 400 }
        )
      }

      docId = googleDocId
      docData = await fetchGoogleContent(url, session.accessToken)
      docData.url = url
    }
    // Option 2: Manual content
    else if (manualContent) {
      docId = uuidv4()
      docData = {
        title: customTitle || 'Manual Document',
        type: manualType || 'document',
        content: manualContent,
        fetchedAt: new Date().toISOString()
      }
    }
    else {
      return Response.json(
        { error: 'Either url or content is required' },
        { status: 400 }
      )
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
    await addDocument(document)

    // Process into chunks
    let chunks
    if (docData.type === 'spreadsheet') {
      // Process each sheet
      chunks = []
      for (const [sheetName, rows] of Object.entries(docData.content)) {
        const sheetDoc = {
          id: `${docId}-${sheetName}`,
          title: `${docData.title} - ${sheetName}`,
          type: 'spreadsheet',
          content: rows,
          url: docData.url
        }
        const sheetChunks = processDocument(sheetDoc)
        chunks.push(...sheetChunks)
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
      const texts = chunks.map(c => c.text)

      // Check if OpenAI key is configured
      if (!process.env.OPENAI_API_KEY) {
        return Response.json(
          {
            error: 'OpenAI API key not configured. Add OPENAI_API_KEY to your .env.local file for embeddings.',
            document,
            chunks: chunks.length
          },
          { status: 500 }
        )
      }

      const embeddings = await generateEmbeddings(texts)
      await addChunks(chunks, embeddings)
    }

    // Get updated stats
    const stats = await getStats()

    return Response.json({
      success: true,
      document,
      chunksCreated: chunks.length,
      stats
    })
  } catch (error) {
    console.error('Error adding document:', error)
    return Response.json(
      { error: error.message || 'Failed to add document' },
      { status: 500 }
    )
  }
}
