/**
 * Simple file-based vector store
 * Stores document chunks with embeddings for semantic search
 * Can be upgraded to Pinecone/Supabase later for production
 */

import fs from 'fs/promises'
import path from 'path'
import { cosineSimilarity } from './embeddings'

const DATA_DIR = path.join(process.cwd(), 'data')
const VECTORS_FILE = path.join(DATA_DIR, 'vectors.json')
const DOCUMENTS_FILE = path.join(DATA_DIR, 'documents.json')

// In-memory cache
let vectorsCache = null
let documentsCache = null

/**
 * Ensure data directory exists
 */
async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR)
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true })
  }
}

/**
 * Load vectors from file
 */
async function loadVectors() {
  if (vectorsCache) return vectorsCache

  try {
    await ensureDataDir()
    const data = await fs.readFile(VECTORS_FILE, 'utf-8')
    vectorsCache = JSON.parse(data)
  } catch {
    vectorsCache = { chunks: [] }
  }

  return vectorsCache
}

/**
 * Save vectors to file
 */
async function saveVectors(vectors) {
  await ensureDataDir()
  vectorsCache = vectors
  await fs.writeFile(VECTORS_FILE, JSON.stringify(vectors, null, 2))
}

/**
 * Load documents metadata from file
 */
export async function loadDocuments() {
  if (documentsCache) return documentsCache

  try {
    await ensureDataDir()
    const data = await fs.readFile(DOCUMENTS_FILE, 'utf-8')
    documentsCache = JSON.parse(data)
  } catch {
    documentsCache = { documents: [] }
  }

  return documentsCache
}

/**
 * Save documents metadata to file
 */
async function saveDocuments(docs) {
  await ensureDataDir()
  documentsCache = docs
  await fs.writeFile(DOCUMENTS_FILE, JSON.stringify(docs, null, 2))
}

/**
 * Add a document to the store
 */
export async function addDocument(doc) {
  const docs = await loadDocuments()

  // Check if document already exists
  const existingIndex = docs.documents.findIndex(d => d.id === doc.id)
  if (existingIndex >= 0) {
    docs.documents[existingIndex] = {
      ...docs.documents[existingIndex],
      ...doc,
      updatedAt: new Date().toISOString()
    }
  } else {
    docs.documents.push({
      ...doc,
      createdAt: new Date().toISOString()
    })
  }

  await saveDocuments(docs)
  return doc
}

/**
 * Remove a document and its chunks from the store
 */
export async function removeDocument(docId) {
  const docs = await loadDocuments()
  docs.documents = docs.documents.filter(d => d.id !== docId)
  await saveDocuments(docs)

  // Remove associated chunks
  const vectors = await loadVectors()
  vectors.chunks = vectors.chunks.filter(c => {
    if (c.documentId === docId) return false
    // Spreadsheet chunks are stored with `${docId}-${sheetName}` ids
    if (typeof c.documentId === 'string' && c.documentId.startsWith(docId + '-')) return false
    return true
  })
  await saveVectors(vectors)

  // Clear cache
  documentsCache = null
  vectorsCache = null
}

/**
 * Get all documents
 */
export async function getDocuments() {
  const docs = await loadDocuments()
  return docs.documents
}

/**
 * Add chunks with embeddings to the vector store
 */
export async function addChunks(chunks, embeddings) {
  const vectors = await loadVectors()

  // Remove existing chunks for any incoming documentId(s)
  if (chunks.length > 0) {
    const docIds = new Set(chunks.map(c => c.documentId).filter(Boolean))
    vectors.chunks = vectors.chunks.filter(c => !docIds.has(c.documentId))
  }

  // Add new chunks with embeddings
  const hasEmbeddings = Array.isArray(embeddings) && embeddings.length === chunks.length
  chunks.forEach((chunk, index) => {
    const record = { ...chunk }
    if (hasEmbeddings) {
      record.embedding = embeddings[index]
    }
    vectors.chunks.push(record)
  })

  await saveVectors(vectors)
}

/**
 * Search for similar chunks using cosine similarity
 */
export async function searchSimilar(queryEmbedding, options = {}) {
  const { topK = 5, minScore = 0.7 } = options

  const vectors = await loadVectors()

  if (vectors.chunks.length === 0) {
    return []
  }

  // Calculate similarity scores
  const scored = vectors.chunks.map(chunk => ({
    ...chunk,
    score: chunk.embedding ? cosineSimilarity(queryEmbedding, chunk.embedding) : 0
  }))

  // Sort by score and filter
  const results = scored
    .filter(item => item.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ embedding, ...rest }) => rest) // Remove embedding from results

  return results
}

/**
 * Simple keyword retrieval fallback (no embeddings required).
 * Scores chunks by term matches; suitable for small/medium corpora.
 */
export async function searchKeyword(query, options = {}) {
  const { topK = 5 } = options
  const vectors = await loadVectors()

  if (!query || vectors.chunks.length === 0) {
    return []
  }

  const terms = Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .map(t => t.trim())
        .filter(t => t.length >= 3)
    )
  )

  // If query is too short, just return empty (avoid garbage matches)
  if (terms.length === 0) {
    return []
  }

  const scored = vectors.chunks.map(chunk => {
    const haystack = `${chunk.documentTitle || ''}\n${chunk.text || ''}`.toLowerCase()
    let hits = 0
    for (const term of terms) {
      if (haystack.includes(term)) hits++
    }
    const score = hits / terms.length
    return { ...chunk, score }
  })

  return scored
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ embedding, ...rest }) => rest)
}

/**
 * Get stats about the vector store
 */
export async function getStats() {
  const vectors = await loadVectors()
  const docs = await loadDocuments()

  const docStats = {}
  let totalEmbeddedChunks = 0
  vectors.chunks.forEach(chunk => {
    if (!docStats[chunk.documentId]) {
      docStats[chunk.documentId] = 0
    }
    docStats[chunk.documentId]++
    if (chunk.embedding) totalEmbeddedChunks++
  })

  return {
    totalDocuments: docs.documents.length,
    totalChunks: vectors.chunks.length,
    totalEmbeddedChunks,
    documentsWithChunks: Object.keys(docStats).length,
    chunksPerDocument: docStats
  }
}

/**
 * Clear all data (for testing/reset)
 */
export async function clearAll() {
  await saveVectors({ chunks: [] })
  await saveDocuments({ documents: [] })
  vectorsCache = null
  documentsCache = null
}
