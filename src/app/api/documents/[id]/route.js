/**
 * Single document API routes
 * DELETE - Remove a document and its chunks
 */

import { removeDocument, getDocuments, getStats } from '@/lib/vectorStore'

export async function DELETE(request, { params }) {
  try {
    const { id } = await params

    // Check if document exists
    const documents = await getDocuments()
    const doc = documents.find(d => d.id === id)

    if (!doc) {
      return Response.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    await removeDocument(id)

    const stats = await getStats()

    return Response.json({
      success: true,
      message: `Document "${doc.title}" removed`,
      stats
    })
  } catch (error) {
    console.error('Error removing document:', error)
    return Response.json(
      { error: 'Failed to remove document' },
      { status: 500 }
    )
  }
}
