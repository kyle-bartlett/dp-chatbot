/**
 * API Route: /api/sync/progress
 * Returns sync processing status: files pending, processing, processed, errors.
 */

import { supabase } from '@/lib/supabaseClient'
import {
  ErrorCode,
  apiError,
  apiSuccess,
  requireAuth,
  generateRequestId
} from '@/lib/apiUtils'

export async function GET() {
  const requestId = generateRequestId()

  const { session, errorResponse: authError } = await requireAuth()
  if (authError) return authError

  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    // Count files by status
    const [pending, processing, recentProcessed, errors] = await Promise.all([
      supabase
        .from('synced_files')
        .select('*', { count: 'exact', head: true })
        .eq('needs_processing', true)
        .eq('sync_status', 'pending'),

      supabase
        .from('synced_files')
        .select('*', { count: 'exact', head: true })
        .eq('sync_status', 'processing'),

      supabase
        .from('synced_files')
        .select('*', { count: 'exact', head: true })
        .eq('sync_status', 'synced')
        .gte('last_processed_at', oneHourAgo),

      supabase
        .from('synced_files')
        .select('*', { count: 'exact', head: true })
        .eq('sync_status', 'error')
    ])

    // Get recent errors for display
    const { data: recentErrors } = await supabase
      .from('synced_files')
      .select('name, error_message, updated_at')
      .eq('sync_status', 'error')
      .order('updated_at', { ascending: false })
      .limit(5)

    return apiSuccess({
      pending: pending.count || 0,
      processing: processing.count || 0,
      processedLastHour: recentProcessed.count || 0,
      errors: errors.count || 0,
      recentErrors: recentErrors || []
    }, requestId)
  } catch (error) {
    console.error('Error fetching sync progress:', error)
    return apiError(
      ErrorCode.INTERNAL_ERROR,
      'Failed to fetch sync progress',
      500,
      requestId
    )
  }
}
