/**
 * Google API integration for Sheets and Docs
 * Fetches content from Google Sheets and Google Docs
 * Supports OAuth tokens from authenticated users
 */

import { sheets as sheetsApi, auth as sheetsAuth } from '@googleapis/sheets'
import { docs as docsApi } from '@googleapis/docs'
import { withTimeout, withRetry } from './apiUtils'

const GOOGLE_API_TIMEOUT_MS = 30_000 // 30 seconds per Google API call

/**
 * Create OAuth2 client with user's access token
 * @param {string} accessToken - User's OAuth access token from session
 */
function createOAuthClient(accessToken) {
  const oauth2Client = new sheetsAuth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  oauth2Client.setCredentials({ access_token: accessToken })
  return oauth2Client
}

/**
 * Extract Google document ID from URL
 */
export function extractDocId(url) {
  // Sheets: https://docs.google.com/spreadsheets/d/DOC_ID/edit
  // Docs: https://docs.google.com/document/d/DOC_ID/edit
  const patterns = [
    /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
    /\/document\/d\/([a-zA-Z0-9-_]+)/,
    /\/d\/([a-zA-Z0-9-_]+)/
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }

  return null
}

/**
 * Detect document type from URL
 */
export function detectDocType(url) {
  if (url.includes('/spreadsheets/')) return 'spreadsheet'
  if (url.includes('/document/')) return 'document'
  if (url.includes('docs.google.com')) return 'document'
  return 'unknown'
}

/**
 * Fetch content from a Google Sheet
 * @param {string} spreadsheetId - Google Sheet ID
 * @param {string} accessToken - User's OAuth access token
 */
export async function fetchSpreadsheet(spreadsheetId, accessToken) {
  if (!accessToken) {
    throw new Error('Authentication required. Please sign in with your Google account.')
  }

  const auth = createOAuthClient(accessToken)

  const sheetsClient = sheetsApi({
    version: 'v4',
    auth
  })

  try {
    // Get spreadsheet metadata first (with timeout + retry)
    const metadata = await withRetry(
      () => withTimeout(
        sheetsClient.spreadsheets.get({ spreadsheetId }),
        GOOGLE_API_TIMEOUT_MS,
        'Sheets metadata fetch'
      ),
      { maxRetries: 2, baseDelayMs: 1000 }
    )

    const title = metadata.data.properties?.title || 'Untitled Spreadsheet'
    const sheetNames = metadata.data.sheets?.map(s => s.properties?.title) || ['Sheet1']

    // Fetch all sheets
    const allData = {}
    for (const sheetName of sheetNames) {
      const response = await withRetry(
        () => withTimeout(
          sheetsClient.spreadsheets.values.get({ spreadsheetId, range: sheetName }),
          GOOGLE_API_TIMEOUT_MS,
          `Sheets data fetch (${sheetName})`
        ),
        { maxRetries: 2, baseDelayMs: 1000 }
      )
      allData[sheetName] = response.data.values || []
    }

    return {
      title,
      type: 'spreadsheet',
      sheets: sheetNames,
      content: allData,
      fetchedAt: new Date().toISOString()
    }
  } catch (error) {
    console.error('Error fetching spreadsheet:', error.message)
    if (error.code === 403) {
      throw new Error('Access denied. Make sure you have permission to view this spreadsheet.')
    }
    if (error.code === 404) {
      throw new Error('Spreadsheet not found. Check the URL and try again.')
    }
    throw new Error(`Failed to fetch spreadsheet: ${error.message}`)
  }
}

/**
 * Fetch content from a Google Doc
 * @param {string} documentId - Google Doc ID
 * @param {string} accessToken - User's OAuth access token
 */
export async function fetchDocument(documentId, accessToken) {
  if (!accessToken) {
    throw new Error('Authentication required. Please sign in with your Google account.')
  }

  const auth = createOAuthClient(accessToken)

  const docsClient = docsApi({
    version: 'v1',
    auth
  })

  try {
    const response = await withRetry(
      () => withTimeout(
        docsClient.documents.get({ documentId }),
        GOOGLE_API_TIMEOUT_MS,
        'Docs content fetch'
      ),
      { maxRetries: 2, baseDelayMs: 1000 }
    )

    const doc = response.data
    const title = doc.title || 'Untitled Document'

    // Extract text content from the document
    let textContent = ''

    function extractText(element) {
      if (element.paragraph) {
        element.paragraph.elements?.forEach(el => {
          if (el.textRun) {
            textContent += el.textRun.content
          }
        })
      }
      if (element.table) {
        element.table.tableRows?.forEach(row => {
          row.tableCells?.forEach(cell => {
            cell.content?.forEach(extractText)
          })
          textContent += '\n'
        })
      }
    }

    doc.body?.content?.forEach(extractText)

    return {
      title,
      type: 'document',
      content: textContent,
      fetchedAt: new Date().toISOString()
    }
  } catch (error) {
    console.error('Error fetching document:', error.message)
    if (error.code === 403) {
      throw new Error('Access denied. Make sure you have permission to view this document.')
    }
    if (error.code === 404) {
      throw new Error('Document not found. Check the URL and try again.')
    }
    throw new Error(`Failed to fetch document: ${error.message}`)
  }
}

/**
 * Fetch content from any Google URL
 * @param {string} url - Google Sheets or Docs URL
 * @param {string} accessToken - User's OAuth access token
 */
export async function fetchGoogleContent(url, accessToken) {
  const docId = extractDocId(url)
  if (!docId) {
    throw new Error('Invalid Google document URL')
  }

  const docType = detectDocType(url)

  if (docType === 'spreadsheet') {
    return await fetchSpreadsheet(docId, accessToken)
  } else if (docType === 'document') {
    return await fetchDocument(docId, accessToken)
  } else {
    throw new Error('Unsupported document type. Only Google Sheets and Docs are supported.')
  }
}
