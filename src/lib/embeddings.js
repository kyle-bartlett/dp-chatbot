/**
 * Embedding generation using OpenAI's API
 * Used for converting text chunks into vectors for semantic search
 */

import OpenAI from 'openai'

let openaiClient = null

function getClient() {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required for embeddings')
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  }
  return openaiClient
}

/**
 * Generate embeddings for an array of texts
 * Uses OpenAI's text-embedding-3-small model (cheap and effective)
 */
export async function generateEmbeddings(texts) {
  if (!texts || texts.length === 0) {
    return []
  }

  const client = getClient()

  // OpenAI has a limit of ~8000 tokens per request for embeddings
  // Process in batches to be safe
  const batchSize = 100
  const allEmbeddings = []

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize)

    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: batch,
      encoding_format: 'float'
    })

    const embeddings = response.data.map(item => item.embedding)
    allEmbeddings.push(...embeddings)
  }

  return allEmbeddings
}

/**
 * Generate a single embedding for a query
 */
export async function generateQueryEmbedding(query) {
  const embeddings = await generateEmbeddings([query])
  return embeddings[0]
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) {
    return 0
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  if (normA === 0 || normB === 0) {
    return 0
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}
