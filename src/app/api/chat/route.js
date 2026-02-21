/**
 * API Route: /api/chat
 * Handles chat messages with RAG-enhanced responses via Claude API
 * Supports both streaming (SSE) and non-streaming responses
 */

import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { tieredRetrieval, buildContextualPrompt } from '@/lib/tieredRetrieval'
import { models, chatConfig } from '@/lib/modelConfig'
import {
  ErrorCode,
  apiError,
  apiSuccess,
  requireAuth,
  validateBody,
  generateRequestId,
  sanitizeError,
  chatRateLimiter,
  withTimeout
} from '@/lib/apiUtils'

const MAX_MESSAGE_LENGTH = 10_000
const MAX_HISTORY_ENTRIES = 50
const MAX_HISTORY_CONTENT_LENGTH = 10_000

const chatPostSchema = z.object({
  message: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(MAX_MESSAGE_LENGTH, `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(MAX_HISTORY_CONTENT_LENGTH)
      })
    )
    .max(MAX_HISTORY_ENTRIES, `History cannot exceed ${MAX_HISTORY_ENTRIES} messages`)
    .optional()
    .default([]),
  userContext: z
    .object({
      role: z.string().max(50).optional(),
      team: z.string().max(50).optional()
    })
    .optional()
})

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

/**
 * Build the messages array from chat history
 */
function buildMessages(history, currentMessage) {
  const messages = []

  // Add previous messages (skip the welcome message)
  if (history && history.length > 1) {
    for (let i = 1; i < history.length; i++) {
      messages.push({
        role: history[i].role,
        content: history[i].content
      })
    }
  }

  // Add current message
  messages.push({
    role: 'user',
    content: currentMessage
  })

  return messages
}

/**
 * Perform RAG retrieval for the query
 */
async function performRetrieval(message, context) {
  let retrievalResults = { results: [], structured: [], semantic: [], related: [], queryType: 'hybrid', totalResults: 0, tiersUsed: [] }

  if (process.env.OPENAI_API_KEY) {
    try {
      retrievalResults = await tieredRetrieval(message, context)
      console.log(`Tiered retrieval: ${retrievalResults.structured.length} structured, ${retrievalResults.semantic.length} semantic, ${retrievalResults.related?.length || 0} related, tiers: [${retrievalResults.tiersUsed?.join(',')}]`)
    } catch (ragError) {
      console.error('RAG error (continuing without context):', ragError.message)
    }
  }

  return retrievalResults
}

/**
 * Build source metadata from retrieval results
 */
function buildSourceMetadata(retrievalResults) {
  return {
    queryType: retrievalResults.queryType,
    sourcesUsed: retrievalResults.totalResults,
    structuredResults: retrievalResults.structured.length,
    semanticResults: retrievalResults.semantic.length,
    relatedResults: retrievalResults.related?.length || 0,
    tiersUsed: retrievalResults.tiersUsed || [],
    sources: retrievalResults.results.slice(0, 10).map(r => ({
      title: r.source,
      url: r.sourceUrl,
      type: r.type,
      score: r.score,
      tier: r.tier
    }))
  }
}

/**
 * Handle streaming response via SSE
 */
async function handleStreamingResponse(systemPrompt, messages, retrievalResults) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false

      function safeEnqueue(data) {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(data))
        } catch {
          closed = true
        }
      }

      function safeClose() {
        if (closed) return
        closed = true
        try {
          controller.close()
        } catch {
          // Already closed
        }
      }

      // Timeout guard: abort if streaming takes too long
      const timeoutId = setTimeout(() => {
        console.error('Streaming timeout reached')
        safeEnqueue(`data: ${JSON.stringify({ type: 'error', error: 'Response timed out' })}\n\n`)
        safeClose()
      }, chatConfig.timeoutMs)

      try {
        const messageStream = anthropic.messages.stream({
          model: models.chat,
          max_tokens: chatConfig.maxTokens,
          temperature: chatConfig.temperature,
          system: systemPrompt,
          messages: messages
        })

        messageStream.on('text', (text) => {
          safeEnqueue(`data: ${JSON.stringify({ type: 'text', text })}\n\n`)
        })

        messageStream.on('error', (error) => {
          console.error('Stream error:', error)
          safeEnqueue(`data: ${JSON.stringify({ type: 'error', error: 'Stream error occurred' })}\n\n`)
          safeClose()
        })

        // Wait for the stream to complete
        const finalMessage = await messageStream.finalMessage()

        // Send metadata event with sources
        const metadata = {
          type: 'metadata',
          ...buildSourceMetadata(retrievalResults),
          usage: {
            inputTokens: finalMessage.usage?.input_tokens,
            outputTokens: finalMessage.usage?.output_tokens
          }
        }
        safeEnqueue(`data: ${JSON.stringify(metadata)}\n\n`)
        safeEnqueue('data: [DONE]\n\n')
        safeClose()
      } catch (error) {
        console.error('Streaming error:', error)
        safeEnqueue(`data: ${JSON.stringify({ type: 'error', error: 'Failed to generate response' })}\n\n`)
        safeClose()
      } finally {
        clearTimeout(timeoutId)
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    }
  })
}

export async function POST(request) {
  const requestId = generateRequestId()
  const { searchParams } = new URL(request.url)
  const useStreaming = searchParams.get('stream') === 'true'

  // Auth check
  const { session, errorResponse: authError } = await requireAuth()
  if (authError) return authError

  // Rate limiting
  const rateLimitKey = session.user.email
  const rateCheck = chatRateLimiter.check(rateLimitKey)
  if (!rateCheck.allowed) {
    return apiError(
      ErrorCode.SERVICE_UNAVAILABLE,
      `Rate limit exceeded. Please wait ${Math.ceil(rateCheck.resetMs / 1000)} seconds.`,
      429,
      requestId
    )
  }

  // Validate request body
  const { data: body, errorResponse: validationError } = await validateBody(request, chatPostSchema)
  if (validationError) return validationError

  const { message, history, userContext } = body

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return apiError(
        ErrorCode.SERVICE_UNAVAILABLE,
        'Chat service is not configured. Please contact an administrator.',
        503,
        requestId
      )
    }

    const user = session.user

    // Build user context
    const context = {
      role: userContext?.role || 'general',
      team: userContext?.team || 'general',
      name: user.name || 'User',
      email: user.email
    }

    console.log('Chat request from:', user.email, 'Role:', context.role, 'Team:', context.team, 'Streaming:', useStreaming)

    // Hybrid RAG retrieval
    const retrievalResults = await performRetrieval(message, context)

    // Build context-aware system prompt
    const systemPrompt = buildContextualPrompt(message, retrievalResults, context)

    // Build messages array from history
    const messages = buildMessages(history, message)

    // Streaming path
    if (useStreaming) {
      return handleStreamingResponse(systemPrompt, messages, retrievalResults)
    }

    // Non-streaming path (fallback)
    const response = await withTimeout(
      anthropic.messages.create({
        model: models.chat,
        max_tokens: chatConfig.maxTokens,
        temperature: chatConfig.temperature,
        system: systemPrompt,
        messages: messages
      }),
      chatConfig.timeoutMs,
      'Claude API response'
    )

    // Safe access with bounds check
    const assistantMessage = response.content?.[0]?.text || 'I was unable to generate a response. Please try again.'

    return apiSuccess({
      response: assistantMessage,
      ...buildSourceMetadata(retrievalResults)
    }, requestId)
  } catch (error) {
    console.error('Chat API error:', error)

    if (error.status === 401) {
      return apiError(
        ErrorCode.SERVICE_UNAVAILABLE,
        'Chat service authentication failed. Please contact an administrator.',
        503,
        requestId
      )
    }

    return apiError(
      ErrorCode.INTERNAL_ERROR,
      sanitizeError(error, 'Failed to process chat request. Please try again.'),
      500,
      requestId
    )
  }
}
