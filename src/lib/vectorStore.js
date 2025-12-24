/**
 * Supabase-based vector store
 * Stores document chunks with embeddings for semantic search in PostgreSQL
 */

import { supabase } from './supabaseClient'

/**
 * Add a document to the store
 */
export async function addDocument(doc) {
  const { id, title, type, url, metadata } = doc
  
  const { data, error } = await supabase
    .from('documents')
    .upsert({
      id,
      title,
      type,
      url,
      metadata,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' })
    .select()
    .single()

  if (error) {
    console.error('Error adding document:', error)
    throw error
  }

  return data
}

/**
 * Remove a document and its chunks from the store
 */
export async function removeDocument(docId) {
  // Cascading delete should handle chunks if foreign key is set up correctly
  // But strictly we delete the document
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', docId)

  if (error) {
    console.error('Error removing document:', error)
    throw error
  }
}

/**
 * Get all documents
 */
export async function getDocuments() {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching documents:', error)
    return []
  }

  return data
}

/**
 * Add chunks with embeddings to the vector store
 */
export async function addChunks(chunks, embeddings) {
  if (!chunks || chunks.length === 0) return

  const docId = chunks[0].documentId

  // First, delete existing chunks for this document to avoid duplicates/stale chunks
  const { error: deleteError } = await supabase
    .from('document_chunks')
    .delete()
    .eq('document_id', docId)

  if (deleteError) {
    console.error('Error clearing old chunks:', deleteError)
    throw deleteError
  }

  // Prepare rows for insertion
  const rows = chunks.map((chunk, index) => ({
    document_id: docId,
    content: chunk.text, // Assuming 'text' is the content field in chunk object
    chunk_index: index,
    embedding: embeddings[index],
    metadata: {
      documentTitle: chunk.documentTitle,
      documentUrl: chunk.documentUrl,
      ...chunk.metadata
    }
  }))

  const { error: insertError } = await supabase
    .from('document_chunks')
    .insert(rows)

  if (insertError) {
    console.error('Error inserting chunks:', insertError)
    throw insertError
  }
}

/**
 * Search for similar chunks using cosine similarity via Supabase RPC
 */
export async function searchSimilar(queryEmbedding, options = {}) {
  const { topK = 5, minScore = 0.7 } = options

  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_threshold: minScore,
    match_count: topK
  })

  if (error) {
    console.error('Error searching similar chunks:', error)
    return []
  }

  // Map results to expected format
  return data.map(match => ({
    text: match.content,
    score: match.similarity,
    documentId: match.document_id,
    documentTitle: match.metadata?.documentTitle,
    documentUrl: match.metadata?.documentUrl,
    metadata: match.metadata
  }))
}

/**
 * Get stats about the vector store
 */
export async function getStats() {
  const { count: docCount, error: docError } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })

  const { count: chunkCount, error: chunkError } = await supabase
    .from('document_chunks')
    .select('*', { count: 'exact', head: true })

  if (docError || chunkError) {
    console.error('Error getting stats:', docError, chunkError)
    return {
      totalDocuments: 0,
      totalChunks: 0
    }
  }

  return {
    totalDocuments: docCount || 0,
    totalChunks: chunkCount || 0
  }
}

/**
 * Clear all data (for testing/reset)
 */
export async function clearAll() {
  await supabase.from('documents').delete().neq('id', '00000000-0000-0000-0000-000000000000') // Delete all
}