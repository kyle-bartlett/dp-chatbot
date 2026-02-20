/**
 * Single document API routes
 * DELETE - Remove a document and its chunks
 *
 * Uses DELETE ... RETURNING to atomically check existence and delete
 * in a single query, eliminating the TOCTOU race condition where
 * two concurrent deletes could both report success.
 */

import { z } from 'zod'
import { supabase } from '@/lib/supabaseClient'
import { getStats } from '@/lib/vectorStore'
import {
  ErrorCode,
  apiError,
  apiSuccess,
  requireAuth,
  generateRequestId,
  sanitizeError
} from '@/lib/apiUtils'

const documentIdSchema = z.object({
  id: z.string().uuid('Invalid document ID format')
})

export async function DELETE(request, { params }) {
  const requestId = generateRequestId()

  // Auth check
  const { session, errorResponse: authError } = await requireAuth()
  if (authError) return authError

  try {
    const { id } = await params

    // Validate UUID format
    const parseResult = documentIdSchema.safeParse({ id })
    if (!parseResult.success) {
      return apiError(
        ErrorCode.VALIDATION_ERROR,
        'Invalid document ID format',
        400,
        requestId
      )
    }

    // Atomic check-and-delete: DELETE with .select() returns the deleted row.
    // If no row matched, data will be null — meaning the document didn't exist
    // (or was already deleted by a concurrent request).
    // Cascading FK (ON DELETE CASCADE) on document_chunks handles chunk cleanup.
    const { data: deletedDoc, error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id)
      .select('id, title')
      .maybeSingle()

    if (error) {
      console.error('Error deleting document:', error)
      return apiError(
        ErrorCode.INTERNAL_ERROR,
        'Failed to remove document',
        500,
        requestId
      )
    }

    if (!deletedDoc) {
      return apiError(
        ErrorCode.NOT_FOUND,
        'Document not found or already deleted',
        404,
        requestId
      )
    }

    const stats = await getStats()

    return apiSuccess({
      success: true,
      message: `Document "${deletedDoc.title}" removed`,
      stats
    }, requestId)
  } catch (error) {
    console.error('Error removing document:', error)
    return apiError(
      ErrorCode.INTERNAL_ERROR,
      sanitizeError(error, 'Failed to remove document'),
      500,
      requestId
    )
  }
}
