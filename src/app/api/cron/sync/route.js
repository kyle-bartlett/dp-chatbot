/**
 * Cron Route: /api/cron/sync
 * Runs every 4 hours via Vercel Cron.
 * Iterates enabled sync_configs, acquires lock, syncs changed files.
 * Uses stored refresh tokens for headless auth (no user session needed).
 */

import { auth as driveAuth } from '@googleapis/drive'
import { supabase } from '@/lib/supabaseClient'
import {
  syncFolder,
  acquireSyncLock,
  releaseSyncLock
} from '@/lib/driveSync'

export const maxDuration = 60 // Vercel Pro: up to 60s function timeout

/**
 * Refresh the access token using a stored refresh token.
 */
async function getAccessTokenFromRefresh(refreshToken) {
  const oauth2Client = new driveAuth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  oauth2Client.setCredentials({ refresh_token: refreshToken })

  const { credentials } = await oauth2Client.refreshAccessToken()
  return credentials.access_token
}

export async function GET(request) {
  // Validate cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  console.log('Cron sync started')

  const results = {
    synced: 0,
    skipped: 0,
    errors: 0,
    details: []
  }

  try {
    // Get all enabled sync configs that have stored refresh tokens
    const { data: configs, error } = await supabase
      .from('sync_configs')
      .select('*')
      .eq('sync_enabled', true)
      .not('refresh_token', 'is', null)

    if (error) {
      console.error('Error fetching sync configs:', error)
      return Response.json({ error: 'Failed to fetch configs' }, { status: 500 })
    }

    if (!configs || configs.length === 0) {
      console.log('No enabled sync configs with refresh tokens found')
      return Response.json({ message: 'No configs to sync', ...results })
    }

    console.log(`Found ${configs.length} sync configs to process`)

    for (const config of configs) {
      const lockAcquired = await acquireSyncLock(config.folder_id)
      if (!lockAcquired) {
        console.log(`Skipping folder ${config.folder_id}: lock already held`)
        results.skipped++
        results.details.push({ folder: config.folder_name, status: 'skipped (locked)' })
        continue
      }

      try {
        // Get fresh access token from refresh token
        const accessToken = await getAccessTokenFromRefresh(config.refresh_token)

        const syncResult = await syncFolder(
          config.folder_id,
          accessToken,
          config.user_id,
          config.team_context || 'general'
        )

        results.synced++
        results.details.push({
          folder: config.folder_name,
          status: 'synced',
          new: syncResult.new,
          updated: syncResult.updated
        })

        console.log(`Synced folder ${config.folder_name}: ${syncResult.new} new, ${syncResult.updated} updated`)
      } catch (error) {
        console.error(`Error syncing folder ${config.folder_name}:`, error.message)
        results.errors++
        results.details.push({
          folder: config.folder_name,
          status: 'error',
          error: error.message
        })
      } finally {
        await releaseSyncLock(config.folder_id)
      }
    }
  } catch (error) {
    console.error('Cron sync error:', error)
    return Response.json({ error: 'Cron sync failed' }, { status: 500 })
  }

  console.log(`Cron sync complete: ${results.synced} synced, ${results.skipped} skipped, ${results.errors} errors`)
  return Response.json(results)
}
