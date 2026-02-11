import type { NextApiRequest, NextApiResponse } from 'next'

interface SourceResult {
  url: string
  title: string
  snippet: string
  domain: string
  quality: 'high' | 'medium' | 'low'
}

function getSourceQuality(domain: string): 'high' | 'medium' | 'low' {
  const highTrust = ['.edu', '.gov', 'pubmed', 'nature.com', 'sciencedirect', 'scholar.google', 'who.int', 'cdc.gov', 'nih.gov', 'nasa.gov', 'britannica.com']
  const mediumTrust = ['wikipedia.org', 'reuters.com', 'apnews.com', 'bbc.com', 'bbc.co.uk', 'npr.org', 'pbs.org', 'nytimes.com', 'washingtonpost.com', 'theguardian.com', 'wsj.com', 'cnn.com', 'cbsnews.com', 'nbcnews.com', 'abcnews.com', 'espn.com', 'forbes.com', 'bloomberg.com']
  
  const domainLower = domain.toLowerCase()
  if (highTrust.some(t => domainLower.includes(t))) return 'high'
  if (mediumTrust.some(t => domainLower.includes(t))) return 'medium'
  return 'low'
}

function sortSourcesByQuality(sources: SourceResult[]): SourceResult[] {
  const order = { high: 0, medium: 1, low: 2 }
  return sources.sort((a, b) => order[a.quality] - order[b.quality])
}

function calculateTrustScore(sources: SourceResult[], agreementCount: number): number {
  if (sources.length === 0) return 0
  
  let score = 50
  const highQualitySources = sources.filter(s => s.quality === 'high').length
  const mediumQualitySources = sources.filter(s => s.quality === 'medium').length
  
  score += highQualitySources * 15
  score += mediumQualitySources * 8
  
  if (agreementCount >= 3) score += 20
  else if (agreementCount >= 2) score += 10
  
  if (highQualitySources === 0 && mediumQualitySources === 0) score -= 20
  
  return Math.max(0, Math.min(100, score))
}

function generateWarnings(sources: SourceResult[], answer: string): string[] {
  const warnings: string[] = []
  const highQualitySources = sources.filter(s => s.quality === 'high').length
  
  if (highQualitySources === 0) {
    warnings.push('No high-trust sources (.edu, .gov, peer-reviewed) found. Consider verifying with additional sources.')
  }
  
  if (sources.length < 2) {
    warnings.push('Limited sources available. Cross-reference with additional searches.')
  }
  
  const hedgingWords = ['may', 'might', 'could', 'possibly', 'reportedly', 'allegedly']
  if (hedgingWords.some(w => answer.toLowerCase().includes(w))) {
    warnings.push('This topic contains uncertainty. Multiple perspectives may exist.')
  }
  
  return warnings
}

async function searchWithClaude(query: string, apiKey: string): Promise<{answer: string, sources: SourceResult[], agreementCount: number}> {
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
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{
        role: 'user',
        content: `Search for accurate, factual information about: "${query}"

INSTRUCTIONS:
1. Search multiple sources to find the most accurate answer
2. Prioritize .edu, .gov, and peer-reviewed sources over Wikipedia
3. Note if sources agree or disagree
4. Be factual and clear

After searching, respond with ONLY this JSON:
{
  "answer": "Your answer based on sources. Use professional language (no contractions like don't, you're). Be clear and helpful.",
  "sources": [
    {"url": "URL", "title": "Title", "snippet": "Relevant quote", "domain": "domain.com"}
  ],
  "agreementCount": number
}

Return ONLY valid JSON.`
      }]
    })
  })

  if (!response.ok) {
    throw new Error('Search API request failed')
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
  
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      
      const sourcesWithQuality = (parsed.sources || []).map((s: any) => ({
        ...s,
        quality: getSourceQuality(s.domain || s.url || '')
      }))
      
      return {
        answer: parsed.answer || 'Unable to find a clear answer.',
        sources: sourcesWithQuality,
        agreementCount: parsed.agreementCount || sourcesWithQuality.length
      }
    }
  } catch (e) {
    console.error('Failed to parse search response:', e)
  }
  
  return {
    answer: text || 'Unable to process search. Please try again.',
    sources: [],
    agreementCount: 0
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { query } = req.body
  if (!query || !query.trim()) {
    return res.status(400).json({ error: 'No search query provided' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' })
  }

  try {
    const { answer, sources, agreementCount } = await searchWithClaude(query, apiKey)
    const sortedSources = sortSourcesByQuality(sources)
    const trustScore = calculateTrustScore(sources, agreementCount)
    const warnings = generateWarnings(sources, answer)
    
    return res.status(200).json({
      query,
      answer,
      trustScore,
      sources: sortedSources.slice(0, 5),
      sourceAgreement: agreementCount,
      warnings
    })
  } catch (error: any) {
    console.error('Search error:', error)
    return res.status(500).json({ error: error.message || 'Search failed' })
  }
}

export const config = { api: { responseLimit: false } }
