import type { NextApiRequest, NextApiResponse } from 'next'

interface SourceResult {
  url: string
  title: string
  snippet: string
  domain: string
  quality?: 'high' | 'medium' | 'low'
}

interface ClaimResult {
  claim: string
  type: 'fact' | 'opinion' | 'prediction'
  status: 'verified' | 'false' | 'unconfirmed' | 'opinion'
  sources: SourceResult[]
  explanation: string
  sourceAgreement?: number
}

function getSourceQuality(domain: string): 'high' | 'medium' | 'low' {
  const highTrust = ['.edu', '.gov', 'pubmed', 'nature.com', 'sciencedirect', 'who.int', 'cdc.gov', 'nih.gov', 'nasa.gov', 'britannica.com']
  const mediumTrust = ['wikipedia.org', 'reuters.com', 'apnews.com', 'bbc.com', 'bbc.co.uk', 'npr.org', 'pbs.org', 'nytimes.com', 'washingtonpost.com', 'espn.com', 'cnn.com', 'cbsnews.com']
  
  const domainLower = domain.toLowerCase()
  if (highTrust.some(t => domainLower.includes(t))) return 'high'
  if (mediumTrust.some(t => domainLower.includes(t))) return 'medium'
  return 'low'
}

async function verifyWithClaude(content: string, aiSource: string, apiKey: string): Promise<{claims: ClaimResult[], summary: any}> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{
        role: 'user',
        content: `You are a fact-checker. Analyze this text from ${aiSource} and verify each factual claim against real sources.

TEXT TO VERIFY:
"${content}"

INSTRUCTIONS:
1. Extract each factual claim (ignore opinions and predictions)
2. Search for evidence to verify or refute each claim
3. Be thorough - check multiple sources
4. For each claim, determine: verified (true), false, or unconfirmed

After searching and verifying, respond with ONLY this JSON format:
{
  "claims": [
    {
      "claim": "The exact claim from the text",
      "type": "fact",
      "status": "verified" | "false" | "unconfirmed",
      "explanation": "Why this is true/false/unconfirmed based on sources. Use professional language.",
      "sources": [
        {
          "url": "source URL",
          "title": "source title",
          "snippet": "relevant quote",
          "domain": "domain.com"
        }
      ],
      "sourceAgreement": 1
    }
  ],
  "summary": {
    "total": 0,
    "verified": 0,
    "false": 0,
    "unconfirmed": 0,
    "opinions": 0
  }
}

If the text contains only opinions or no verifiable facts, return:
{
  "claims": [],
  "summary": {"total": 0, "verified": 0, "false": 0, "unconfirmed": 0, "opinions": 0},
  "message": "No factual claims found to verify."
}

Return ONLY valid JSON, no other text.`
      }]
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error?.message || 'API request failed')
  }

  const data = await response.json()
  
  let text = ''
  if (data.content && Array.isArray(data.content)) {
    for (const block of data.content) {
      if (block && block.type === 'text' && block.text) {
        text += block.text
      }
    }
  }
  
  if (!text) {
    return {
      claims: [],
      summary: { total: 0, verified: 0, false: 0, unconfirmed: 0, opinions: 0 }
    }
  }
  
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      
      if (parsed.claims && Array.isArray(parsed.claims)) {
        parsed.claims = parsed.claims.map((claim: any) => ({
          ...claim,
          sources: (claim.sources || []).map((s: any) => ({
            ...s,
            quality: getSourceQuality(s.domain || s.url || '')
          }))
        }))
      }
      
      if (!parsed.summary) {
        const claims = parsed.claims || []
        parsed.summary = {
          total: claims.length,
          verified: claims.filter((c: any) => c.status === 'verified').length,
          false: claims.filter((c: any) => c.status === 'false').length,
          unconfirmed: claims.filter((c: any) => c.status === 'unconfirmed').length,
          opinions: claims.filter((c: any) => c.status === 'opinion').length
        }
      }
      
      return {
        claims: parsed.claims || [],
        summary: parsed.summary
      }
    }
  } catch (e) {
    console.error('Failed to parse response:', e)
  }
  
  return {
    claims: [],
    summary: { total: 0, verified: 0, false: 0, unconfirmed: 0, opinions: 0 }
  }
}

async function logToRankings(aiSource: string, summary: any) {
  try {
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000'
    
    await fetch(`${baseUrl}/api/rankings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aiSource,
        verified: summary.verified || 0,
        false: summary.false || 0,
        unconfirmed: summary.unconfirmed || 0,
        opinions: summary.opinions || 0,
        total: summary.total || 0
      })
    })
  } catch (e) {
    console.error('Failed to log to rankings:', e)
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { content, aiSource } = req.body
  
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'No content provided' })
  }
  
  if (!aiSource) {
    return res.status(400).json({ error: 'No AI source specified' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' })
  }

  try {
    const { claims, summary } = await verifyWithClaude(content, aiSource, apiKey)
    
    if (summary.total > 0) {
      await logToRankings(aiSource, summary)
    }

    return res.status(200).json({ 
      claims, 
      summary,
      message: claims.length === 0 ? 'No factual claims found to verify.' : undefined
    })
  } catch (error: any) {
    console.error('Verification error:', error)
    return res.status(500).json({ error: error.message || 'Verification failed. Please try again.' })
  }
}

export const config = { 
  api: { 
    responseLimit: false,
    bodyParser: {
      sizeLimit: '10mb'
    }
  } 
}
