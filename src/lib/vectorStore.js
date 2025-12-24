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
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  if (normA === 0 || normB === 0) return 0
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Search for similar chunks using cosine similarity
 * Uses client-side calculation as fallback when embeddings are stored as JSON strings
 */
export async function searchSimilar(queryEmbedding, options = {}) {
  const { topK = 5, minScore = 0.7 } = options

  // First try the RPC function (for when vector column is properly configured)
  const { data: rpcData, error: rpcError } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_threshold: minScore,
    match_count: topK
  })

  if (!rpcError && rpcData && rpcData.length > 0) {
    // RPC worked, use those results
    return rpcData.map(match => ({
      text: match.content,
      score: match.similarity,
      documentId: match.document_id,
      documentTitle: match.metadata?.documentTitle,
      documentUrl: match.metadata?.documentUrl,
      metadata: match.metadata
    }))
  }

  // Fallback: fetch all chunks and calculate similarity client-side
  // This is less efficient but works when embeddings are stored as JSON strings
  console.log('RPC failed or returned empty, using client-side similarity search')
  if (rpcError) {
    console.log('RPC error:', rpcError.message)
  }

  const { data: chunks, error: fetchError } = await supabase
    .from('document_chunks')
    .select('id, document_id, content, embedding, metadata')

  if (fetchError || !chunks) {
    console.error('Error fetching chunks for similarity search:', fetchError)
    return []
  }

  console.log(`Fetched ${chunks.length} chunks for client-side similarity search`)

  // Calculate similarity for each chunk
  const results = chunks
    .map(chunk => {
      // Parse embedding if it's a string (JSON array)
      let embedding = chunk.embedding
      if (typeof embedding === 'string') {
        try {
          embedding = JSON.parse(embedding)
        } catch (e) {
          console.error('Failed to parse embedding for chunk', chunk.id)
          return null
        }
      }

      const score = cosineSimilarity(queryEmbedding, embedding)
      return {
        text: chunk.content,
        score,
        documentId: chunk.document_id,
        documentTitle: chunk.metadata?.documentTitle,
        documentUrl: chunk.metadata?.documentUrl,
        metadata: chunk.metadata
      }
    })
    .filter(r => r !== null && r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)

  console.log(`Found ${results.length} matching chunks with minScore >= ${minScore}`)
  if (results.length > 0) {
    console.log(`Top match score: ${results[0].score.toFixed(4)}, title: ${results[0].documentTitle}`)
  }

  return results
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