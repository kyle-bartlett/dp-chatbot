/**
 * Embedding generation using OpenAI's API
 * Used for converting text chunks into vectors for semantic search
 */

import OpenAI from 'openai'
import { withTimeout, withRetry } from './apiUtils'
import { models, embeddingConfig } from './modelConfig'

const OPENAI_TIMEOUT_MS = embeddingConfig.timeoutMs

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
  // Initial validation
  if (!texts) {
    console.warn('generateEmbeddings called with null/undefined texts')
    return []
  }

  if (!Array.isArray(texts)) {
    console.error('generateEmbeddings called with non-array:', typeof texts, texts)
    throw new Error('generateEmbeddings expects an array of strings')
  }

  if (texts.length === 0) {
    console.warn('generateEmbeddings called with empty array')
    return []
  }

  console.log(`generateEmbeddings called with ${texts.length} items`)
  console.log(`Input types: ${texts.map(t => typeof t).slice(0, 5).join(', ')}`)

  // Validate and filter texts - OpenAI requires non-empty strings
  const validTexts = texts
    .map((text, index) => {
      // Convert to string if not already
      if (text === null || text === undefined) {
        return null
      }
      const str = String(text).trim()
      return str.length > 0 ? str : null
    })
    .filter(text => text !== null)

  if (validTexts.length === 0) {
    console.warn('No valid texts to embed after filtering')
    return []
  }

  const client = getClient()

  // OpenAI has a limit of ~8000 tokens per request for embeddings
  // Process in batches to be safe
  const batchSize = embeddingConfig.batchSize
  const allEmbeddings = []

  for (let i = 0; i < validTexts.length; i += batchSize) {
    const batch = validTexts.slice(i, i + batchSize)

    // Double-check batch is valid before sending
    if (!batch || batch.length === 0) {
      continue
    }

    // Ensure all items in batch are non-empty strings
    // Also check for maximum length (OpenAI has token limits)
    const validBatch = batch
      .map(text => {
        // Convert to string if needed
        if (text === null || text === undefined) {
          return null
        }
        if (typeof text !== 'string') {
          console.warn('Non-string value found in batch, converting:', typeof text)
          const converted = String(text).trim()
          return converted.length > 0 ? converted : null
        }
        const trimmed = text.trim()
        return trimmed.length > 0 ? trimmed : null
      })
      .filter(text => text !== null && text.length > 0)
      .map(text => {
        // OpenAI embeddings have a max input length of ~8000 tokens
        // Roughly 1 token = 4 characters, so limit to ~30000 characters to be safe
        if (text.length > 30000) {
          console.warn(`Text too long (${text.length} chars), truncating to 30000 chars`)
          return text.substring(0, 30000)
        }
        return text
      })

    if (validBatch.length === 0) {
      console.warn(`Skipping empty batch at index ${i}`)
      continue
    }

    // Final validation: ensure it's an array of strings
    if (!Array.isArray(validBatch)) {
      console.error('validBatch is not an array:', typeof validBatch, validBatch)
      throw new Error('Invalid batch format: expected array of strings')
    }

    // Log batch info for debugging
    console.log(`Processing batch ${i / batchSize + 1}: ${validBatch.length} texts`)
    if (validBatch.length > 0) {
      console.log(`First text preview: ${validBatch[0]?.substring(0, 100)}...`)
      console.log(`First text type: ${typeof validBatch[0]}, length: ${validBatch[0]?.length}`)
    }
    console.log(`Batch types: ${validBatch.map(t => typeof t).join(', ')}`)

    // Final validation: OpenAI requires input to be string or array of strings
    // Always pass as array for consistency
    if (!Array.isArray(validBatch)) {
      console.error('validBatch is not an array:', typeof validBatch, validBatch)
      throw new Error('Invalid batch format: must be an array')
    }

    // Validate all items are non-empty strings
    const hasInvalidItems = validBatch.some(item => typeof item !== 'string' || item.length === 0)
    if (hasInvalidItems) {
      const invalidItems = validBatch.filter(item => typeof item !== 'string' || item.length === 0)
      console.error('Invalid items in batch array:', invalidItems.length)
      console.error('Sample invalid items:', invalidItems.slice(0, 3))
      throw new Error('Batch contains invalid items: all must be non-empty strings')
    }

    // Final safety check: ensure we have at least one valid string
    if (validBatch.length === 0) {
      console.warn('Skipping batch with no valid texts')
      continue
    }

    // Serialize and validate the input one more time
    const inputToSend = validBatch
    console.log(`Sending to OpenAI: ${inputToSend.length} texts`)
    console.log(`Input type: ${Array.isArray(inputToSend) ? 'array' : typeof inputToSend}`)
    console.log(`Input JSON preview: ${JSON.stringify(inputToSend.slice(0, 1)).substring(0, 200)}`)

    try {
      // Create a clean copy to ensure no hidden properties
      const cleanInput = JSON.parse(JSON.stringify(inputToSend))

      const response = await withRetry(
        () => withTimeout(
          client.embeddings.create({
            model: models.embedding,
            input: cleanInput,
            encoding_format: 'float'
          }),
          OPENAI_TIMEOUT_MS,
          'OpenAI embedding generation'
        ),
        { maxRetries: 3, baseDelayMs: 1000 }
      )

      const embeddings = response.data.map(item => item.embedding)
      allEmbeddings.push(...embeddings)
      console.log(`Successfully generated ${embeddings.length} embeddings`)
    } catch (error) {
      console.error('Error generating embeddings for batch:', error)
      console.error('Batch size:', validBatch.length)
      console.error('Batch is array?', Array.isArray(validBatch))
      if (validBatch.length > 0) {
        console.error('First item type:', typeof validBatch[0])
        console.error('First item value:', validBatch[0])
        console.error('First item preview:', String(validBatch[0]).substring(0, 200))
        console.error('First item JSON:', JSON.stringify(validBatch[0]).substring(0, 200))
      }
      console.error('Full batch JSON (first 1000 chars):', JSON.stringify(validBatch).substring(0, 1000))
      throw error
    }
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

/**
 * Export aliases for backward compatibility.
 * - getEmbeddings: used by src/app/api/sync/route.js
 * - getEmbedding: used by src/lib/hybridRetrieval.js
 */
export const getEmbeddings = generateEmbeddings
export const getEmbedding = generateQueryEmbedding
