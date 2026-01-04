/**
 * Google Drive Sync Engine
 * Handles live synchronization of Google Sheets and Docs from Drive folders
 * Supports folder traversal, metadata tracking, and background sync
 */

import { google } from 'googleapis'
import { supabase } from './supabaseClient'

/**
 * Create OAuth2 client with user's access token
 */
function createOAuthClient(accessToken) {
  const oauth2Client = new google.auth.OAuth2(
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
  const drive = google.drive({ version: 'v3', auth })

  const files = []

  async function traverse(currentFolderId, depth = 0) {
    if (depth > maxDepth) return

    try {
      // Query for files in current folder
      const query = [`'${currentFolderId}' in parents`, 'trashed = false']
      
      const response = await drive.files.list({
        q: query.join(' and '),
        fields: 'files(id, name, mimeType, modifiedTime, createdTime, owners, webViewLink, parents)',
        pageSize: 1000
      })

      const items = response.data.files || []

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
  const drive = google.drive({ version: 'v3', auth })

  try {
    const response = await drive.files.get({
      fileId: folderId,
      fields: 'id, name, parents, owners, createdTime, modifiedTime'
    })

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
  const drive = google.drive({ version: 'v3', auth })
  const path = []

  let currentId = folderId

  while (currentId && currentId !== 'root') {
    try {
      const response = await drive.files.get({
        fileId: currentId,
        fields: 'id, name, parents'
      })

      const folder = response.data
      path.unshift({ id: folder.id, name: folder.name })

      currentId = folder.parents?.[0]
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
    return []
  }

  return data
}

/**
 * Sync a single folder (fetch all files and update database)
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
    errors: 0,
    files: []
  }

  // Track sync metadata
  for (const file of files) {
    try {
      // Check if file already exists in our database
      const { data: existing } = await supabase
        .from('synced_files')
        .select('id, modified_time')
        .eq('drive_file_id', file.id)
        .single()

      const needsUpdate = !existing || 
        new Date(file.modifiedTime) > new Date(existing.modified_time)

      if (needsUpdate) {
        // Upsert file metadata
        const { error: upsertError } = await supabase
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

        if (upsertError) {
          console.error(`Error upserting file ${file.name}:`, upsertError)
          syncResults.errors++
        } else {
          if (existing) {
            syncResults.updated++
          } else {
            syncResults.new++
          }
          syncResults.files.push(file)
        }
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
    return []
  }

  return data
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
