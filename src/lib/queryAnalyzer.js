/**
 * LLM-Powered Query Intent Analyzer
 * Called only for ambiguous queries (when keyword classifier returns 'hybrid').
 * Uses Sonnet for fast, accurate intent classification.
 */

import Anthropic from '@anthropic-ai/sdk'
import { models, analysisConfig } from './modelConfig'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

/**
 * Analyze query intent using LLM when the keyword classifier is uncertain.
 *
 * @param {string} query - User's query text
 * @param {Object} userContext - { role, team }
 * @returns {Object} Intent analysis
 */
export async function analyzeQueryIntent(query, userContext = {}) {
  const prompt = `Classify this supply chain query and extract key entities.

Query: "${query}"
User role: ${userContext.role || 'general'}
User team: ${userContext.team || 'general'}

Return ONLY valid JSON (no markdown):
{
  "query_type": "<structured | semantic | hybrid>",
  "entities": {
    "skus": ["<any SKU/ASIN codes mentioned>"],
    "dates": ["<any dates or time periods>"],
    "teams": ["<any team names>"],
    "accounts": ["<any retail account names like Walmart, Amazon>"],
    "metrics": ["<any metrics like forecast, inventory, sales>"]
  },
  "scope": "<narrow | broad>",
  "intent": "<brief description of what the user is looking for>",
  "suggested_sheet_types": ["<forecast, pipeline, inventory, cpfr, psi, sales, sop, general>"]
}`

  try {
    const response = await Promise.race([
      anthropic.messages.create({
        model: models.analysis,
        max_tokens: 1024,
        temperature: 0.1,
        messages: [{ role: 'user', content: prompt }]
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Query analysis timed out')), analysisConfig.timeoutMs)
      )
    ])

    const text = response.content?.[0]?.text || '{}'
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(jsonStr)
  } catch (error) {
    console.error('Query analysis error:', error.message)
    // Return a safe default
    return {
      query_type: 'hybrid',
      entities: { skus: [], dates: [], teams: [], accounts: [], metrics: [] },
      scope: 'broad',
      intent: query,
      suggested_sheet_types: []
    }
  }
}
