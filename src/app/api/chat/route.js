import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@/lib/auth'
import { hybridRetrieval, buildContextualPrompt } from '@/lib/hybridRetrieval'
import { getStats } from '@/lib/vectorStore'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request) {
  try {
    const { message, history, userContext } = await request.json()

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json(
        { error: 'API key not configured. Please add ANTHROPIC_API_KEY to your .env.local file.' },
        { status: 500 }
      )
    }

    // Get session for user context
    const session = await auth()
    const user = session?.user || {}

    // Build user context
    const context = {
      role: userContext?.role || 'general',
      team: userContext?.team || 'general',
      name: user.name || 'User',
      email: user.email
    }

    console.log('Chat request from:', user.email, 'Role:', context.role, 'Team:', context.team)
    console.log('Query:', message.substring(0, 100))

    // Hybrid RAG: Retrieve relevant context using both structured and semantic search
    let retrievalResults = { results: [], structured: [], semantic: [], queryType: 'hybrid', totalResults: 0 }
    
    const stats = await getStats()
    console.log('Knowledge base stats:', stats)

    if (process.env.OPENAI_API_KEY) {
      try {
        retrievalResults = await hybridRetrieval(message, context)
        console.log(`Hybrid retrieval: ${retrievalResults.structured.length} structured, ${retrievalResults.semantic.length} semantic results`)
      } catch (ragError) {
        console.error('RAG error (continuing without context):', ragError.message)
      }
    } else {
      console.log('OpenAI key not configured, skipping RAG')
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

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages
    })

    const assistantMessage = response.content[0].text

    return Response.json({
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
    })
  } catch (error) {
    console.error('API Error:', error)

    if (error.status === 401) {
      return Response.json(
        { error: 'Invalid API key. Please check your ANTHROPIC_API_KEY.' },
        { status: 401 }
      )
    }

    return Response.json(
      { error: 'Failed to process request. Please try again.' },
      { status: 500 }
    )
  }
}
