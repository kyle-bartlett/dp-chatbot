/**
 * API Route: /api/context
 * Manages user context, role, and team settings
 */

import { z } from 'zod'
import { supabase } from '@/lib/supabaseClient'
import {
  ErrorCode,
  apiError,
  apiSuccess,
  requireAuth,
  validateBody,
  generateRequestId,
  sanitizeError
} from '@/lib/apiUtils'

const VALID_ROLES = [
  'general',
  'demand_planner',
  'supply_planner',
  'operations',
  'gtm',
  'sales',
  'management'
]

const VALID_TEAMS = [
  'general',
  'demand',
  'supply',
  'ops',
  'gtm',
  'sales',
  'all'
]

const contextPostSchema = z.object({
  role: z.enum(VALID_ROLES).optional().default('general'),
  team: z.enum(VALID_TEAMS).optional().default('general'),
  preferences: z.record(z.unknown()).optional().default({})
})

export async function GET(request) {
  const requestId = generateRequestId()

  const { session, errorResponse: authError } = await requireAuth()
  if (authError) return authError

  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', session.user.email)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching user context:', error)
      return apiError(
        ErrorCode.INTERNAL_ERROR,
        'Failed to fetch context',
        500,
        requestId
      )
    }

    const context = data || {
      user_id: session.user.email,
      role: 'general',
      team: 'general',
      default_team_context: 'general',
      preferences: {}
    }

    return apiSuccess({ context }, requestId)
  } catch (error) {
    console.error('Error in context GET:', error)
    return apiError(
      ErrorCode.INTERNAL_ERROR,
      sanitizeError(error, 'Failed to fetch context'),
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
  const { data: body, errorResponse: validationError } = await validateBody(request, contextPostSchema)
  if (validationError) return validationError

  try {
    const { role, team, preferences } = body

    const { data, error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: session.user.email,
        role,
        team,
        default_team_context: team,
        preferences,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) {
      console.error('Error saving user context:', error)
      return apiError(
        ErrorCode.INTERNAL_ERROR,
        'Failed to save context',
        500,
        requestId
      )
    }

    return apiSuccess({
      success: true,
      context: data,
      message: 'Context updated successfully'
    }, requestId)
  } catch (error) {
    console.error('Error in context POST:', error)
    return apiError(
      ErrorCode.INTERNAL_ERROR,
      sanitizeError(error, 'Failed to save context'),
      500,
      requestId
    )
  }
}

export async function PUT(request) {
  // Alias for POST (update context)
  return POST(request)
}
