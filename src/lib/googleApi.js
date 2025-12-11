/**
 * Google API integration for Sheets and Docs
 * Fetches content from Google Sheets and Google Docs
 */

import { google } from 'googleapis'

let authClient = null

/**
 * Get authenticated Google API client
 * Uses service account or API key
 */
function getAuth() {
  if (authClient) return authClient

  // Option 1: API Key (simplest, read-only, public files only)
  if (process.env.GOOGLE_API_KEY) {
    authClient = process.env.GOOGLE_API_KEY
    return authClient
  }

  // Option 2: Service Account (for private files)
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
    authClient = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets.readonly',
        'https://www.googleapis.com/auth/documents.readonly',
        'https://www.googleapis.com/auth/drive.readonly'
      ]
    })
    return authClient
  }

  throw new Error('No Google API credentials configured. Set GOOGLE_API_KEY or GOOGLE_SERVICE_ACCOUNT_KEY')
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
 */
export async function fetchSpreadsheet(spreadsheetId) {
  const auth = getAuth()

  const sheets = google.sheets({
    version: 'v4',
    auth: typeof auth === 'string' ? undefined : auth,
    key: typeof auth === 'string' ? auth : undefined
  })

  try {
    // Get spreadsheet metadata first
    const metadata = await sheets.spreadsheets.get({
      spreadsheetId,
      auth: typeof auth === 'string' ? undefined : auth
    })

    const title = metadata.data.properties?.title || 'Untitled Spreadsheet'
    const sheetNames = metadata.data.sheets?.map(s => s.properties?.title) || ['Sheet1']

    // Fetch all sheets
    const allData = {}
    for (const sheetName of sheetNames) {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: sheetName,
        auth: typeof auth === 'string' ? undefined : auth
      })
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
    throw new Error(`Failed to fetch spreadsheet: ${error.message}`)
  }
}

/**
 * Fetch content from a Google Doc
 */
export async function fetchDocument(documentId) {
  const auth = getAuth()

  const docs = google.docs({
    version: 'v1',
    auth: typeof auth === 'string' ? undefined : auth,
    key: typeof auth === 'string' ? auth : undefined
  })

  try {
    const response = await docs.documents.get({
      documentId,
      auth: typeof auth === 'string' ? undefined : auth
    })

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
    throw new Error(`Failed to fetch document: ${error.message}`)
  }
}

/**
 * Fetch content from any Google URL
 */
export async function fetchGoogleContent(url) {
  const docId = extractDocId(url)
  if (!docId) {
    throw new Error('Invalid Google document URL')
  }

  const docType = detectDocType(url)

  if (docType === 'spreadsheet') {
    return await fetchSpreadsheet(docId)
  } else if (docType === 'document') {
    return await fetchDocument(docId)
  } else {
    throw new Error('Unsupported document type. Only Google Sheets and Docs are supported.')
  }
}
