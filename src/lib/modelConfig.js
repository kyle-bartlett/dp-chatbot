/**
 * Centralized Model Configuration
 * Single source of truth for all AI model IDs and settings
 */

export const models = {
  // Primary chat model — best reasoning for complex supply chain questions
  chat: 'claude-opus-4-6',
  // Batch analysis model — faster/cheaper for document analysis
  analysis: 'claude-sonnet-4-6',
  // Embedding model — OpenAI for vector embeddings
  embedding: 'text-embedding-3-small',
}

export const chatConfig = {
  maxTokens: 4096,
  temperature: 0.3,
  timeoutMs: 90_000,
}

export const analysisConfig = {
  maxTokens: 4096,
  temperature: 0.1,
  timeoutMs: 60_000,
}

export const embeddingConfig = {
  batchSize: 100,
  maxInputChars: 30_000,
  timeoutMs: 60_000,
}
