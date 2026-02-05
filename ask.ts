import type { NextApiRequest, NextApiResponse } from 'next'

interface SourceResult {
  url: string
  title: string
  snippet: string
  domain: string
}

interface AskResponse {
  answer: string
  sources: SourceResult[]
  confidence: 'high' | 'medium' | 'low'
}

function cleanText(text: string): string {
  if (!text || typeof text !== 'string') return ''
  
  return text
    .replace(/[₿€£¥₹₽₩฿]/g, '')
    .replace(/[•◦●○■□▪▫▸▹►▻◆◇★☆✓✔✗✘✦✧]/g, '-')
    .replace(/[–—―‐‑‒]/g, '-')
    .replace(/[\u2018\u2019\u201A\u201B`´]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F„"«»]/g, '"')
    .replace(/[\u2026]/g, '...')
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/[§¶†‡©®™°±²³µ¼½¾]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function callClaudeWithSearch(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: prompt }]
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error('API Error:', errorData)
    throw new Error('API request failed')
  }

  const data = await response.json()
  let result = ''
  for (const block of data.content || []) {
    if (block.type === 'text') {
      result += block.text
    }
  }
  return result
}

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'API key not configured' })
    return
  }

  try {
    const { question } = req.body

    if (!question || typeof question !== 'string') {
      res.status(400).json({ error: 'Please enter a question.' })
      return
    }

    const cleanQuestion = cleanText(question)

    if (cleanQuestion.length < 5) {
      res.status(400).json({ error: 'Please enter a longer question.' })
      return
    }

    if (cleanQuestion.length > 1000) {
      res.status(400).json({ error: 'Question is too long. Please make it shorter.' })
      return
    }

    const prompt = `You are Trustie, an AI assistant that ONLY provides answers backed by verifiable sources.

USER QUESTION: "${cleanQuestion}"

INSTRUCTIONS:
1. Search the web to find the answer to this question
2. Use authoritative sources: Wikipedia, news sites, government sites, educational institutions, official company sites
3. Provide a clear, direct answer based on what you find
4. Include ALL sources you used to form your answer
5. Be honest if you cannot find reliable information

IMPORTANT RULES:
- NEVER make up information. Only state what you can verify from sources.
- If you're unsure, say so clearly
- Keep the answer concise but complete (2-4 sentences for simple questions, more for complex ones)
- Always cite your sources

Respond with ONLY this JSON format:
{
  "answer": "Your clear, direct answer based on sources",
  "confidence": "high|medium|low",
  "sources": [
    {"url": "actual URL", "title": "page title", "snippet": "relevant quote", "domain": "domain.com"}
  ]
}

CONFIDENCE LEVELS:
- "high" = Multiple authoritative sources agree
- "medium" = Some sources found but not definitive
- "low" = Limited or conflicting information

You MUST include at least 1 source. Return ONLY valid JSON.`

    const text = await callClaudeWithSearch(prompt, apiKey)
    
    let answer = "I couldn't find a reliable answer to your question."
    let sources: SourceResult[] = []
    let confidence: 'high' | 'medium' | 'low' = 'low'

    // Try to parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0])
        
        if (parsed.answer && parsed.answer.length > 10) {
          answer = parsed.answer
        }
        
        if (parsed.confidence && ['high', 'medium', 'low'].includes(parsed.confidence)) {
          confidence = parsed.confidence
        }
        
        if (Array.isArray(parsed.sources)) {
          sources = parsed.sources
            .filter((s: { url?: string; title?: string }) => s && (s.url || s.title))
            .slice(0, 5)
            .map((s: { url?: string; title?: string; snippet?: string; domain?: string }) => {
              let domain = s.domain || 'unknown'
              if (s.url && !s.domain) {
                try {
                  domain = new URL(s.url).hostname.replace('www.', '')
                } catch (e) {
                  // Keep default
                }
              }
              return {
                url: s.url || '#',
                title: s.title || 'Source',
                snippet: s.snippet || '',
                domain: domain
              }
            })
        }
      } catch (e) {
        console.error('JSON parse error:', e)
        // If JSON parsing fails, try to extract useful info from raw text
        if (text.length > 50) {
          answer = text.slice(0, 500) + (text.length > 500 ? '...' : '')
          confidence = 'low'
        }
      }
    } else if (text.length > 50) {
      // No JSON found, use raw text
      answer = text.slice(0, 500) + (text.length > 500 ? '...' : '')
      confidence = 'low'
    }

    // Adjust confidence based on sources
    if (sources.length === 0) {
      confidence = 'low'
    } else if (sources.length >= 3 && confidence === 'medium') {
      confidence = 'high'
    }

    const response: AskResponse = {
      answer,
      sources,
      confidence
    }

    res.status(200).json(response)

  } catch (error) {
    console.error('Ask error:', error)
    res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
