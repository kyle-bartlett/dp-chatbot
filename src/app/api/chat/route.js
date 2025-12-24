import Anthropic from '@anthropic-ai/sdk'
import { generateQueryEmbedding } from '@/lib/embeddings'
import { searchSimilar, getStats } from '@/lib/vectorStore'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const BASE_SYSTEM_PROMPT = `You are the Anker Charging Offline Planning Assistant, an AI helper for the Anker Charging planning teams. Your role is to help team members with:

1. **CPFR (Collaborative Planning, Forecasting, and Replenishment)** processes for retailers:
   - Walmart, Target (TGT), Best Buy (BBY), Costco, Apple, Staples
   - Forecast logic, ladder refresh processes, and update procedures

2. **KPIs and Dashboards**:
   - US Anker KPI Dashboard
   - DP OKR Tracker
   - Sellin FC accuracy tracking

3. **Reports and Documents**:
   - Aggregators (Sellin FC, Sellout, History)
   - IOQ FCST Files
   - NPI/EOL Management
   - Weekly Sales Reports

4. **Supply Chain**:
   - Pipeline inventory
   - PSI Ladders
   - Cross-functional documentation

5. **Training Materials**:
   - Offline Planning Training resources
   - Alloy platform guides
   - Forecast evolution documentation

**Guidelines:**
- Be helpful, professional, and concise
- When answering questions, cite the source documents when available
- Use markdown formatting for clarity (bullet points, bold, etc.)
- For complex topics, break down explanations into digestible parts
- Always maintain confidentiality - this is internal information
- If you find relevant information in the provided context, use it. If not, answer based on your general knowledge and note that specific Anker documentation may not be available yet.`

/**
 * Build system prompt with retrieved context
 */
function buildSystemPrompt(context) {
  if (!context || context.length === 0) {
    return BASE_SYSTEM_PROMPT + '\n\n**Note:** No internal documents have been loaded yet. Answers are based on general offline planning knowledge.'
  }

  let contextSection = '\n\n---\n\n**RELEVANT INTERNAL DOCUMENTS:**\n\n'

  context.forEach((chunk, idx) => {
    contextSection += `**[${idx + 1}] ${chunk.documentTitle}**\n`
    if (chunk.documentUrl) {
      contextSection += `Source: ${chunk.documentUrl}\n`
    }
    contextSection += `\n${chunk.text}\n\n---\n\n`
  })

  contextSection += 'Use the above internal documents to answer questions when relevant. Cite sources by document name.'

  return BASE_SYSTEM_PROMPT + contextSection
}

export async function POST(request) {
  try {
    const { message, history } = await request.json()

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json(
        { error: 'API key not configured. Please add ANTHROPIC_API_KEY to your .env.local file.' },
        { status: 500 }
      )
    }

    // RAG: Retrieve relevant context
    let context = []
    const stats = await getStats()

    if (stats.totalChunks > 0 && process.env.OPENAI_API_KEY) {
      try {
        const queryEmbedding = await generateQueryEmbedding(message)
        context = await searchSimilar(queryEmbedding, {
          topK: 5,
          minScore: 0.65
        })
      } catch (ragError) {
        console.error('RAG error (continuing without context):', ragError.message)
      }
    }

    // Build system prompt with context
    const systemPrompt = buildSystemPrompt(context)

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
      sourcesUsed: context.length,
      sources: context.map(c => ({
        title: c.documentTitle,
        url: c.documentUrl,
        score: c.score
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
