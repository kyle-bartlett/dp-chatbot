/**
 * Google Drive Sync Engine
 * Handles live synchronization of Google Sheets and Docs from Drive folders
 * Supports folder traversal, metadata tracking, and background sync
 */

import { drive as driveApi, auth as driveAuth } from '@googleapis/drive'
import { supabase } from './supabaseClient'
import { withTimeout, withRetry } from './apiUtils'

const DRIVE_API_TIMEOUT_MS = 30_000 // 30 seconds per Drive API call
const MAX_FOLDER_PATH_DEPTH = 20    // Max parent traversal depth

/**
 * Create OAuth2 client with user's access token
 */
function createOAuthClient(accessToken) {
  const oauth2Client = new driveAuth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  oauth2Client.setCredentials({ access_token: accessToken })
  return oauth2Client
}

/**
 * List all files in a Drive folder (recursively)
 * @param {string} folderId - Google Drive folder ID (or 'root')
 * @param {string} accessToken - User's OAuth access token
 * @param {Object} options - Filter options
 */
export async function listDriveFiles(folderId = 'root', accessToken, options = {}) {
  const {
    recursive = true,
    fileTypes = ['application/vnd.google-apps.spreadsheet', 'application/vnd.google-apps.document'],
    maxDepth = 10
  } = options

  const auth = createOAuthClient(accessToken)
  const drive = driveApi({ version: 'v3', auth })

  const files = []

  async function traverse(currentFolderId, depth = 0) {
    if (depth > maxDepth) return

    try {
      // Query for files in current folder (paginated to handle >1000 files)
      const query = [`'${currentFolderId}' in parents`, 'trashed = false']
      let pageToken = null

      do {
        const response = await withTimeout(
          drive.files.list({
            q: query.join(' and '),
            fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, createdTime, owners, webViewLink, parents)',
            pageSize: 1000,
            ...(pageToken ? { pageToken } : {})
          }),
          DRIVE_API_TIMEOUT_MS,
          'Drive files list'
        )

        const items = response.data.files || []
        pageToken = response.data.nextPageToken || null

      for (const item of items) {
        if (item.mimeType === 'application/vnd.google-apps.folder') {
          // It's a folder
          if (recursive) {
            await traverse(item.id, depth + 1)
          }
        } else if (fileTypes.includes(item.mimeType)) {
          // It's a file we want
          files.push({
            id: item.id,
            name: item.name,
            type: item.mimeType === 'application/vnd.google-apps.spreadsheet' ? 'spreadsheet' : 'document',
            url: item.webViewLink,
            modifiedTime: item.modifiedTime,
            createdTime: item.createdTime,
            owners: item.owners,
            parents: item.parents,
            folderId: currentFolderId,
            depth
          })
        }
      }
      } while (pageToken)
    } catch (error) {
      console.error(`Error traversing folder ${currentFolderId}:`, error.message)
      throw error
    }
  }

  await traverse(folderId)
  return files
}

/**
 * Get folder metadata and path
 */
export async function getFolderMetadata(folderId, accessToken) {
  const auth = createOAuthClient(accessToken)
  const drive = driveApi({ version: 'v3', auth })

  try {
    const response = await withTimeout(
      drive.files.get({
        fileId: folderId,
        fields: 'id, name, parents, owners, createdTime, modifiedTime'
      }),
      DRIVE_API_TIMEOUT_MS,
      'Drive folder metadata'
    )

    return response.data
  } catch (error) {
    console.error('Error fetching folder metadata:', error.message)
    throw error
  }
}

/**
 * Get folder path (breadcrumb trail)
 */
export async function getFolderPath(folderId, accessToken) {
  if (folderId === 'root') {
    return [{ id: 'root', name: 'My Drive' }]
  }

  const auth = createOAuthClient(accessToken)
  const drive = driveApi({ version: 'v3', auth })
  const path = []

  let currentId = folderId
  let depth = 0

  while (currentId && currentId !== 'root' && depth < MAX_FOLDER_PATH_DEPTH) {
    try {
      const response = await withTimeout(
        drive.files.get({
          fileId: currentId,
          fields: 'id, name, parents'
        }),
        DRIVE_API_TIMEOUT_MS,
        'Drive folder path lookup'
      )

      const folder = response.data
      path.unshift({ id: folder.id, name: folder.name })

      currentId = folder.parents?.[0]
      depth++
    } catch (error) {
      console.error('Error building folder path:', error.message)
      break
    }
  }

  path.unshift({ id: 'root', name: 'My Drive' })
  return path
}

/**
 * Store sync configuration in database
 */
export async function saveSyncConfig(config) {
  const { user_id, folder_id, folder_name, folder_path, team_context, sync_enabled, sync_frequency } = config

  const { data, error } = await supabase
    .from('sync_configs')
    .upsert({
      user_id,
      folder_id,
      folder_name,
      folder_path: folder_path || [],
      team_context: team_context || 'general',
      sync_enabled: sync_enabled !== false,
      sync_frequency: sync_frequency || 'daily',
      last_sync_at: null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'folder_id' })
    .select()
    .single()

  if (error) {
    console.error('Error saving sync config:', error)
    throw error
  }

  return data
}

/**
 * Get all sync configurations for a user
 */
export async function getSyncConfigs(userId) {
  const { data, error } = await supabase
    .from('sync_configs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching sync configs:', error)
    throw new Error('Failed to fetch sync configurations')
  }

  return data || []
}

/**
 * Sync a single folder (fetch all files and update database).
 *
 * Uses a single atomic upsert per file (ON CONFLICT drive_file_id) rather
 * than a read-then-write pattern. This eliminates the TOCTOU race where
 * two concurrent syncs could both see a file as "new" and double-count it.
 *
 * New vs updated classification is derived from the upserted row's timestamps:
 * if created_at and updated_at are within 2 seconds of each other, the row
 * was just created (new). Otherwise it was an update.
 */
export async function syncFolder(folderId, accessToken, userId, teamContext = 'general') {
  console.log(`Starting sync for folder ${folderId}`)

  // List all files in the folder
  const files = await listDriveFiles(folderId, accessToken, { recursive: true })

  console.log(`Found ${files.length} files to sync`)

  const syncResults = {
    total: files.length,
    updated: 0,
    new: 0,
    skipped: 0,
    errors: 0,
    files: []
  }

  for (const file of files) {
    try {
      // Check if file has actually changed by comparing modifiedTime
      const { data: existingFile } = await supabase
        .from('synced_files')
        .select('id, modified_time, sync_status')
        .eq('drive_file_id', file.id)
        .single()

      // Skip if file hasn't been modified since last sync
      // Compare as Date timestamps to handle formatting differences (ms vs s precision, TZ)
      const existingModified = existingFile ? new Date(existingFile.modified_time).getTime() : 0
      const incomingModified = new Date(file.modifiedTime).getTime()
      if (existingFile && existingModified === incomingModified && existingFile.sync_status === 'synced') {
        syncResults.skipped++
        continue
      }

      // Single atomic upsert — the database handles deduplication via the
      // UNIQUE constraint on drive_file_id. No separate read needed.
      const { data: upsertedRow, error: upsertError } = await supabase
        .from('synced_files')
        .upsert({
          drive_file_id: file.id,
          user_id: userId,
          folder_id: folderId,
          name: file.name,
          type: file.type,
          url: file.url,
          team_context: teamContext,
          modified_time: file.modifiedTime,
          created_time: file.createdTime,
          owners: file.owners,
          sync_status: 'pending',
          needs_processing: true,
          updated_at: new Date().toISOString()
        }, { onConflict: 'drive_file_id' })
        .select('id, created_at, updated_at')
        .single()

      if (upsertError) {
        console.error(`Error upserting file ${file.name}:`, upsertError)
        syncResults.errors++
      } else if (upsertedRow) {
        // Determine new vs update by comparing created_at and updated_at.
        // If they're within 2 seconds of each other, this was a fresh insert.
        const created = new Date(upsertedRow.created_at).getTime()
        const updated = new Date(upsertedRow.updated_at).getTime()
        if (Math.abs(updated - created) < 2000) {
          syncResults.new++
        } else {
          syncResults.updated++
        }
        syncResults.files.push(file)
      }
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error)
      syncResults.errors++
    }
  }

  // Update sync config last_sync_at
  await supabase
    .from('sync_configs')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('folder_id', folderId)

  console.log(`Sync complete: ${syncResults.new} new, ${syncResults.updated} updated, ${syncResults.errors} errors`)

  return syncResults
}

/**
 * Get files that need content processing
 */
export async function getFilesNeedingProcessing(limit = 10) {
  const { data, error } = await supabase
    .from('synced_files')
    .select('*')
    .eq('needs_processing', true)
    .order('modified_time', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching files needing processing:', error)
    throw new Error('Failed to fetch files needing processing')
  }

  return data || []
}

/**
 * Mark file as processed
 */
export async function markFileAsProcessed(driveFileId, documentId) {
  const { error } = await supabase
    .from('synced_files')
    .update({
      needs_processing: false,
      sync_status: 'synced',
      document_id: documentId,
      last_processed_at: new Date().toISOString()
    })
    .eq('drive_file_id', driveFileId)

  if (error) {
    console.error('Error marking file as processed:', error)
    throw error
  }
}

/**
 * Get sync stats for a user
 */
export async function getSyncStats(userId) {
  // Count total synced files
  const { count: totalFiles } = await supabase
    .from('synced_files')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  // Count files needing processing
  const { count: pendingFiles } = await supabase
    .from('synced_files')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('needs_processing', true)

  // Get sync configs
  const { count: syncedFolders } = await supabase
    .from('sync_configs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('sync_enabled', true)

  return {
    totalFiles: totalFiles || 0,
    pendingFiles: pendingFiles || 0,
    syncedFolders: syncedFolders || 0
  }
}

/**
 * Atomically claim files for processing.
 *
 * Uses the claim_files_for_processing Postgres function which performs
 * UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED). This ensures
 * that two concurrent workers never claim the same file — if another
 * transaction already holds a lock on a row, it is skipped.
 *
 * Claimed files have their sync_status set to 'processing' and
 * needs_processing set to false, so they won't appear in subsequent claims.
 *
 * @param {number} limit - Maximum number of files to claim (default 5)
 * @returns {Array} The files that were successfully claimed
 *
 * Requires: DATABASE_MIGRATION_001_CONCURRENCY.sql must be applied.
 */
export async function claimFilesForProcessing(limit = 5) {
  const { data, error } = await supabase.rpc('claim_files_for_processing', {
    p_limit: limit
  })

  if (error) {
    console.error('Error claiming files for processing:', error)
    return []
  }

  if (data && data.length > 0) {
    console.log(`Claimed ${data.length} files for processing`)
  } else {
    console.log('No files available for processing')
  }

  return data || []
}

/**
 * Release a previously claimed file back to pending or error state.
 *
 * Called when processing fails for a specific file. Without this, a file
 * stuck in 'processing' status would never be picked up again by any worker.
 *
 * @param {string} driveFileId - The Google Drive file ID to release
 * @param {string|null} errorMessage - If provided, marks the file as 'error'
 *                                     with this message. If null, returns the
 *                                     file to 'pending' state for retry.
 *
 * Requires: DATABASE_MIGRATION_001_CONCURRENCY.sql must be applied.
 */
export async function releaseClaimedFile(driveFileId, errorMessage = null) {
  const { error } = await supabase.rpc('release_claimed_file', {
    p_drive_file_id: driveFileId,
    p_error_message: errorMessage
  })

  if (error) {
    console.error('Error releasing claimed file:', error)
  } else {
    const action = errorMessage ? `marked as error: ${errorMessage}` : 'returned to pending'
    console.log(`Released file ${driveFileId}: ${action}`)
  }
}

/**
 * Acquire a time-limited sync lock on a folder.
 *
 * Used to prevent concurrent or double-fired scheduled syncs from
 * processing the same folder simultaneously. The lock expires after
 * the specified duration, providing automatic recovery if a sync
 * process crashes without releasing the lock.
 *
 * @param {string} folderId - The folder ID to lock
 * @param {number} lockDurationMinutes - How long to hold the lock (default 30)
 * @returns {boolean} True if the lock was acquired, false if already held
 *
 * Requires: DATABASE_MIGRATION_001_CONCURRENCY.sql must be applied.
 */
export async function acquireSyncLock(folderId, lockDurationMinutes = 30) {
  const { data: acquired, error } = await supabase.rpc('acquire_sync_lock', {
    p_folder_id: folderId,
    p_lock_duration_minutes: lockDurationMinutes
  })

  if (error) {
    console.error('Error acquiring sync lock:', error)
    return false
  }

  if (acquired) {
    console.log(`Acquired sync lock on folder ${folderId} for ${lockDurationMinutes} minutes`)
  } else {
    console.log(`Sync lock already held on folder ${folderId}, skipping`)
  }

  return acquired || false
}

/**
 * Release the sync lock on a folder.
 *
 * Should be called in a finally block after sync completes or fails
 * to ensure the lock is always released.
 *
 * @param {string} folderId - The folder ID to unlock
 *
 * Requires: DATABASE_MIGRATION_001_CONCURRENCY.sql must be applied.
 */
export async function releaseSyncLock(folderId) {
  const { error } = await supabase.rpc('release_sync_lock', {
    p_folder_id: folderId
  })

  if (error) {
    console.error('Error releasing sync lock:', error)
  } else {
    console.log(`Released sync lock on folder ${folderId}`)
  }
}
