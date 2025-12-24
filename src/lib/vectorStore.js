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
  
  console.log('Adding document with ID:', id, 'Type:', typeof id)
  
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
    console.error('Document ID:', id)
    console.error('Document ID type:', typeof id)
    throw error
  }

  if (!data) {
    console.error('No data returned from upsert')
    throw new Error('Failed to save document: no data returned')
  }

  console.log('Document saved successfully:', data.id)
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

  // Verify the document exists before inserting chunks
  const { data: existingDoc, error: checkError } = await supabase
    .from('documents')
    .select('id')
    .eq('id', docId)
    .single()

  if (checkError || !existingDoc) {
    console.error('Document not found in database:', docId)
    console.error('Check error:', checkError)
    throw new Error(`Document with ID "${docId}" does not exist in the database. Please save the document first.`)
  }

  console.log(`Verified document exists: ${docId}`)

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

  console.log(`Inserting ${rows.length} chunks for document ${docId}`)
  console.log(`First chunk document_id: ${rows[0]?.document_id}`)
  console.log(`Document ID type: ${typeof docId}, value: ${docId}`)

  const { error: insertError } = await supabase
    .from('document_chunks')
    .insert(rows)

  if (insertError) {
    console.error('Error inserting chunks:', insertError)
    console.error('Document ID used:', docId)
    console.error('Document ID type:', typeof docId)
    console.error('First row document_id:', rows[0]?.document_id)
    throw insertError
  }

  console.log(`Successfully inserted ${rows.length} chunks`)
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