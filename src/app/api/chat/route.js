/**
 * API Route: /api/chat
 * Handles chat messages with RAG-enhanced responses via Claude API
 */

import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { hybridRetrieval, buildContextualPrompt } from '@/lib/hybridRetrieval'
import { getStats } from '@/lib/vectorStore'
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

const CLAUDE_TIMEOUT_MS = 90_000 // 90 seconds for LLM response

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

export async function POST(request) {
  const requestId = generateRequestId()

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

    console.log('Chat request from:', user.email, 'Role:', context.role, 'Team:', context.team)

    // Hybrid RAG: Retrieve relevant context using both structured and semantic search
    let retrievalResults = { results: [], structured: [], semantic: [], queryType: 'hybrid', totalResults: 0 }

    const stats = await getStats()

    if (process.env.OPENAI_API_KEY) {
      try {
        retrievalResults = await hybridRetrieval(message, context)
        console.log(`Hybrid retrieval: ${retrievalResults.structured.length} structured, ${retrievalResults.semantic.length} semantic results`)
      } catch (ragError) {
        console.error('RAG error (continuing without context):', ragError.message)
      }
    }

    // Build context-aware system prompt
    const systemPrompt = buildContextualPrompt(message, retrievalResults, context)

    // Build messages array from history
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
      content: message
    })

    const response = await withTimeout(
      anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages
      }),
      CLAUDE_TIMEOUT_MS,
      'Claude API response'
    )

    // Safe access with bounds check
    const assistantMessage = response.content?.[0]?.text || 'I was unable to generate a response. Please try again.'

    return apiSuccess({
      response: assistantMessage,
      queryType: retrievalResults.queryType,
      sourcesUsed: retrievalResults.totalResults,
      structuredResults: retrievalResults.structured.length,
      semanticResults: retrievalResults.semantic.length,
      sources: retrievalResults.results.slice(0, 10).map(r => ({
        title: r.source,
        url: r.sourceUrl,
        type: r.type,
        score: r.score
      }))
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
