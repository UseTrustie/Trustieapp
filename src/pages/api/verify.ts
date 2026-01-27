import type { NextApiRequest, NextApiResponse } from 'next'

interface SourceResult {
  url: string
  title: string
  snippet: string
  domain: string
}

interface ClaimResult {
  claim: string
  type: 'fact' | 'opinion' | 'prediction'
  status: 'supported' | 'contradicted' | 'unverified' | 'opinion'
  sources: SourceResult[]
  explanation: string
}

interface VerificationResult {
  claims: ClaimResult[]
  summary: {
    total: number
    supported: number
    contradicted: number
    unverified: number
    opinions: number
  }
}

async function extractClaims(content: string, apiKey: string) {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Extract factual claims from this text. Return JSON array only:
[{"claim": "exact claim", "type": "fact", "searchQuery": "search query"}]

Text: "${content}"

If no factual claims, return: []`
        }]
      })
    })
    const data = await response.json()
    if (!data.content || !data.content[0] || !data.content[0].text) {
      return []
    }
    const text = data.content[0].text.trim()
    const match = text.match(/\[[\s\S]*\]/)
    return match ? JSON.parse(match[0]) : []
  } catch (err) {
    console.error('Extract claims error:', err)
    return []
  }
}

async function searchSources(query: string, apiKey: string): Promise<SourceResult[]> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: `Search for: "${query}". Return top 2-3 credible sources as JSON:
[{"url": "url", "title": "title", "snippet": "relevant text", "domain": "domain"}]`
        }]
      })
    })
    const data = await response.json()
    if (!data.content) return []
    let text = ''
    for (const block of data.content) {
      if (block.type === 'text') text += block.text
    }
    if (!text) return []
    const match = text.match(/\[[\s\S]*\]/)
    return match ? JSON.parse(match[0]).slice(0, 3) : []
  } catch (err) {
    console.error('Search error:', err)
    return []
  }
}

async function evaluateClaim(claim: string, sources: SourceResult[], apiKey: string) {
  if (sources.length === 0) {
    return { status: 'unverified', explanation: 'No relevant sources found.' }
  }
  try {
    const sourcesText = sources.map((s, i) => `Source ${i + 1}: ${s.snippet}`).join('\n')
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Claim: "${claim}"\n\nSources:\n${sourcesText}\n\nReturn JSON: {"status": "supported|contradicted|unverified", "explanation": "brief reason"}`
        }]
      })
    })
    const data = await response.json()
    if (!data.content || !data.content[0] || !data.content[0].text) {
      return { status: 'unverified', explanation: 'Could not evaluate.' }
    }
    const text = data.content[0].text.trim()
    const match = text.match(/\{[\s\S]*\}/)
    return match ? JSON.parse(match[0]) : { status: 'unverified', explanation: 'Could not evaluate.' }
  } catch (err) {
    console.error('Evaluate error:', err)
    return { status: 'unverified', explanation: 'Could not evaluate.' }
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { content, aiSource } = req.body
  if (!content) return res.status(400).json({ error: 'No content provided' })
  if (!aiSource) return res.status(400).json({ error: 'No AI source specified' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' })

  try {
    const claims = await extractClaims(content, apiKey)
    if (!claims || claims.length === 0) {
      return res.status(200).json({
        claims: [],
        summary: { total: 0, supported: 0, contradicted: 0, unverified: 0, opinions: 0 }
      })
    }

    const processed: ClaimResult[] = []
    for (const c of claims.slice(0, 5)) {
      if (c.type === 'opinion') {
        processed.push({ claim: c.claim, type: 'opinion', status: 'opinion', sources: [], explanation: 'Opinion cannot be fact-checked.' })
        continue
      }
      const sources = await searchSources(c.searchQuery, apiKey)
      const evaluation = await evaluateClaim(c.claim, sources, apiKey)
      processed.push({
        claim: c.claim,
        type: c.type || 'fact',
        status: evaluation.status || 'unverified',
        sources,
        explanation: evaluation.explanation || 'Could not verify.'
      })
    }

    const summary = {
      total: processed.length,
      supported: processed.filter(c => c.status === 'supported').length,
      contradicted: processed.filter(c => c.status === 'contradicted').length,
      unverified: processed.filter(c => c.status === 'unverified').length,
      opinions: processed.filter(c => c.status === 'opinion').length
    }

    return res.status(200).json({ claims: processed, summary })
  } catch (error: any) {
    console.error('Handler error:', error)
    return res.status(500).json({ error: error.message || 'Verification failed' })
  }
}

export const config = { api: { responseLimit: false } }
