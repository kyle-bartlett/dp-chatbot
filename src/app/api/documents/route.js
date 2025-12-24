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
      try {
        docData = await fetchGoogleContent(url, session.accessToken)
        docData.url = url
      } catch (googleError) {
        console.error('Error fetching Google content:', googleError)
        // Re-throw with more context
        if (googleError.message.includes('404') || googleError.message.includes('not found')) {
          return Response.json(
            { 
              error: `Document not found. Please check the URL and ensure you have access to the document.`,
              details: googleError.message
            },
            { status: 404 }
          )
        }
        if (googleError.message.includes('403') || googleError.message.includes('Access denied')) {
          return Response.json(
            { 
              error: `Access denied. Please ensure you have permission to view this document and are signed in with the correct Google account.`,
              details: googleError.message
            },
            { status: 403 }
          )
        }
        throw googleError
      }
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
    
    // Ensure document is saved before processing chunks
    let savedDocument
    try {
      savedDocument = await addDocument(document)
      if (!savedDocument || !savedDocument.id) {
        throw new Error('Failed to save document: no document returned')
      }
      // Use the saved document ID to ensure consistency
      docId = savedDocument.id
      console.log('Document saved successfully:', docId, 'Type:', typeof docId)
    } catch (docError) {
      console.error('Error saving document:', docError)
      return Response.json(
        { 
          error: 'Failed to save document metadata',
          details: docError.message
        },
        { status: 500 }
      )
    }

    // Process into chunks
    let chunks
    if (docData.type === 'spreadsheet') {
      // Process each sheet
      chunks = []
      if (docData.content && typeof docData.content === 'object') {
        for (const [sheetName, rows] of Object.entries(docData.content)) {
          // Validate rows is an array
          if (!Array.isArray(rows)) {
            console.warn(`Skipping sheet "${sheetName}": content is not an array`)
            continue
          }

          // Skip empty sheets
          if (rows.length === 0) {
            console.warn(`Skipping empty sheet "${sheetName}"`)
            continue
          }

          const sheetDoc = {
            id: docId, // Use parent document ID, not sheet-specific ID
            title: `${docData.title} - ${sheetName}`,
            type: 'spreadsheet',
            content: rows,
            url: docData.url
          }
          const sheetChunks = processDocument(sheetDoc)
          chunks.push(...sheetChunks)
        }
      } else {
        console.error('Spreadsheet content is not in expected format:', typeof docData.content)
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
      // Filter out chunks with invalid or empty text
      const validChunks = chunks.filter(c => 
        c && 
        c.text && 
        typeof c.text === 'string' && 
        c.text.trim().length > 0
      )

      if (validChunks.length === 0) {
        console.warn('No valid chunks with text content to embed')
        return Response.json({
          success: true,
          document,
          chunksCreated: 0,
          warning: 'Document processed but no valid text content found for embedding',
          stats: await getStats()
        })
      }

      // Extract texts and validate they're all strings
      const texts = validChunks.map(c => {
        if (!c || !c.text) {
          console.warn('Chunk missing text property:', c)
          return null
        }
        const text = typeof c.text === 'string' ? c.text : String(c.text)
        return text.trim()
      }).filter(text => text !== null && text.length > 0)

      if (texts.length === 0) {
        console.warn('No valid texts extracted from chunks')
        return Response.json({
          success: true,
          document,
          chunksCreated: 0,
          warning: 'No valid text content found in chunks for embedding',
          stats: await getStats()
        })
      }

      // Validate all texts are strings before sending to OpenAI
      const invalidTexts = texts.filter(t => typeof t !== 'string')
      if (invalidTexts.length > 0) {
        console.error('Found non-string texts:', invalidTexts.length)
        console.error('Sample invalid texts:', invalidTexts.slice(0, 3))
        return Response.json(
          {
            error: 'Invalid text format detected in chunks',
            document,
            chunksCreated: validChunks.length
          },
          { status: 500 }
        )
      }

      console.log(`Generating embeddings for ${texts.length} texts`)
      console.log(`First text preview: ${texts[0]?.substring(0, 100)}...`)

      // Check if OpenAI key is configured
      if (!process.env.OPENAI_API_KEY) {
        return Response.json(
          {
            error: 'OpenAI API key not configured. Add OPENAI_API_KEY to your .env.local file for embeddings.',
            document,
            chunks: texts.length
          },
          { status: 500 }
        )
      }

      const embeddings = await generateEmbeddings(texts)
      
      // Ensure embeddings match valid chunks
      if (embeddings.length !== validChunks.length) {
        console.error(`Embedding count mismatch: ${embeddings.length} embeddings for ${validChunks.length} chunks`)
        return Response.json(
          { 
            error: 'Failed to generate embeddings for all chunks',
            document,
            chunksCreated: validChunks.length,
            embeddingsGenerated: embeddings.length
          },
          { status: 500 }
        )
      }

      // Verify all chunks reference the correct document ID
      // Use the exact ID from the saved document to ensure type consistency
      const finalDocId = savedDocument.id || docId
      console.log('Using document ID for chunks:', finalDocId, 'Type:', typeof finalDocId)
      
      const allChunksHaveCorrectDocId = validChunks.every(chunk => chunk.documentId === finalDocId)
      if (!allChunksHaveCorrectDocId) {
        console.warn('Chunk document ID mismatch detected - fixing...')
        console.warn('Expected docId:', finalDocId, 'Type:', typeof finalDocId)
        console.warn('Chunk documentIds (first 5):', validChunks.map(c => ({ id: c.documentId, type: typeof c.documentId })).slice(0, 5))
        // Fix the document IDs to match exactly what's in the database
        validChunks.forEach(chunk => {
          chunk.documentId = finalDocId
        })
        console.log('Fixed all chunk document IDs to:', finalDocId)
      }

      try {
        await addChunks(validChunks, embeddings)
        console.log(`Successfully added ${validChunks.length} chunks for document ${finalDocId}`)
      } catch (chunkError) {
        console.error('Error adding chunks:', chunkError)
        console.error('Document ID that failed:', finalDocId)
        console.error('Document ID type:', typeof finalDocId)
        // If chunks fail, we should still return the document info
        // but indicate the chunks failed
        return Response.json(
          { 
            error: 'Document saved but failed to add chunks',
            details: chunkError.message,
            document,
            documentId: finalDocId,
            chunksCreated: validChunks.length
          },
          { status: 500 }
        )
      }
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
    
    // Handle specific error types
    if (error.message?.includes('OpenAI') || error.message?.includes('embedding')) {
      return Response.json(
        { 
          error: 'Failed to generate embeddings. Please check your OpenAI API key and try again.',
          details: error.message
        },
        { status: 500 }
      )
    }
    
    if (error.message?.includes('Supabase') || error.message?.includes('database')) {
      return Response.json(
        { 
          error: 'Database error. Please check your Supabase configuration.',
          details: error.message
        },
        { status: 500 }
      )
    }

    return Response.json(
      { 
        error: error.message || 'Failed to add document',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
