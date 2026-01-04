/**
 * API Route: /api/context
 * Manages user context, role, and team settings
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { supabase } from '@/lib/supabaseClient'

export async function GET(request) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's saved context/preferences
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', session.user.email)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching user context:', error)
      return NextResponse.json({ error: 'Failed to fetch context' }, { status: 500 })
    }

    // Return default context if none saved
    const context = data || {
      user_id: session.user.email,
      role: 'general',
      team: 'general',
      default_team_context: 'general',
      preferences: {}
    }

    return NextResponse.json({ context })
  } catch (error) {
    console.error('Error in context GET:', error)
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
    const { role, team, preferences } = body

    // Validate role
    const validRoles = [
      'general',
      'demand_planner',
      'supply_planner',
      'operations',
      'gtm',
      'sales',
      'management'
    ]

    const validTeams = [
      'general',
      'demand',
      'supply',
      'ops',
      'gtm',
      'sales',
      'all'
    ]

    if (role && !validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    if (team && !validTeams.includes(team)) {
      return NextResponse.json({ error: 'Invalid team' }, { status: 400 })
    }

    // Update user preferences
    const { data, error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: session.user.email,
        role: role || 'general',
        team: team || 'general',
        default_team_context: team || 'general',
        preferences: preferences || {},
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) {
      console.error('Error saving user context:', error)
      return NextResponse.json({ error: 'Failed to save context' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      context: data,
      message: 'Context updated successfully' 
    })
  } catch (error) {
    console.error('Error in context POST:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to process request' 
    }, { status: 500 })
  }
}

export async function PUT(request) {
  // Alias for POST (update context)
  return POST(request)
}
