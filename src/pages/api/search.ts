import type { NextApiRequest, NextApiResponse } from 'next'

interface SourceResult {
  url: string
  title: string
  snippet: string
  domain: string
  quality: 'high' | 'medium' | 'low'
}

interface SearchResponse {
  query: string
  answer: string
  trustScore: number
  sources: SourceResult[]
  sourceAgreement: number
  warnings: string[]
}

function getSourceQuality(domain: string): 'high' | 'medium' | 'low' {
  const highTrust = ['.edu', '.gov', 'wikipedia.org', 'pubmed', 'nature.com', 'sciencedirect', 'scholar.google', 'britannica.com', 'who.int', 'cdc.gov', 'nih.gov']
  const mediumTrust = ['reuters.com', 'apnews.com', 'bbc.com', 'bbc.co.uk', 'npr.org', 'pbs.org', 'nytimes.com', 'washingtonpost.com', 'theguardian.com', 'wsj.com']
  
  const domainLower = domain.toLowerCase()
  
  if (highTrust.some(t => domainLower.includes(t))) return 'high'
  if (mediumTrust.some(t => domainLower.includes(t))) return 'medium'
  return 'low'
}

function calculateTrustScore(sources: SourceResult[], agreementCount: number): number {
  if (sources.length === 0) return 0
  
  let score = 50 // Base score
  
  // Bonus for high-quality sources
  const highQualitySources = sources.filter(s => s.quality === 'high').length
  const mediumQualitySources = sources.filter(s => s.quality === 'medium').length
  
  score += highQualitySources * 15
  score += mediumQualitySources * 8
  
  // Bonus for source agreement
  if (agreementCount >= 3) score += 20
  else if (agreementCount >= 2) score += 10
  
  // Penalty for only low-quality sources
  if (highQualitySources === 0 && mediumQualitySources === 0) score -= 20
  
  // Cap at 0-100
  return Math.max(0, Math.min(100, score))
}

function generateWarnings(sources: SourceResult[], answer: string): string[] {
  const warnings: string[] = []
  
  const highQualitySources = sources.filter(s => s.quality === 'high').length
  
  if (highQualitySources === 0) {
    warnings.push('No high-trust sources (.edu, .gov, Wikipedia) found. Consider verifying with additional sources.')
  }
  
  if (sources.length < 2) {
    warnings.push('Limited sources available. Cross-reference with additional searches.')
  }
  
  // Check for hedging language in answer
  const hedgingWords = ['may', 'might', 'could', 'possibly', 'reportedly', 'allegedly', 'some say']
  if (hedgingWords.some(w => answer.toLowerCase().includes(w))) {
    warnings.push('This topic contains uncertainty. Multiple perspectives may exist.')
  }
  
  return warnings
}

async function searchWithClaude(query: string, apiKey: string): Promise<{answer: string, sources: SourceResult[]}> {
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

IMPORTANT INSTRUCTIONS:
1. Search multiple sources to find the most accurate answer
2. Prioritize .edu, .gov, Wikipedia, and established news sources
3. Note if sources agree or disagree
4. Be clear about what is fact vs opinion vs uncertain

After searching, provide your response in this exact JSON format:
{
  "answer": "Your comprehensive answer based on the sources found. Be factual and cite where information comes from. Use professional language (do not use contractions like you're, don't, etc.).",
  "sources": [
    {
      "url": "full URL",
      "title": "page title",
      "snippet": "relevant quote from the source",
      "domain": "domain name"
    }
  ],
  "agreementCount": number of sources that agree on the main facts
}

Return ONLY the JSON, no other text.`
      }]
    })
  })

  const data = await response.json()
  
  // Extract text from response
  let text = ''
  for (const block of data.content) {
    if (block.type === 'text') text += block.text
  }
  
  // Parse JSON from response
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      
      // Add quality ratings to sources
      const sourcesWithQuality = (parsed.sources || []).map((s: any) => ({
        ...s,
        quality: getSourceQuality(s.domain || s.url || '')
      }))
      
      return {
        answer: parsed.answer || 'Unable to find a clear answer. Please try rephrasing your question.',
        sources: sourcesWithQuality
      }
    }
  } catch (e) {
    console.error('Failed to parse search response:', e)
  }
  
  // Fallback if parsing fails
  return {
    answer: text || 'Unable to process search. Please try again.',
    sources: []
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
    const { answer, sources } = await searchWithClaude(query, apiKey)
    
    // Calculate metrics
    const agreementCount = sources.length >= 2 ? Math.min(sources.length, 5) : sources.length
    const trustScore = calculateTrustScore(sources, agreementCount)
    const warnings = generateWarnings(sources, answer)
    
    const response: SearchResponse = {
      query,
      answer,
      trustScore,
      sources: sources.slice(0, 5), // Limit to 5 sources
      sourceAgreement: agreementCount,
      warnings
    }
    
    return res.status(200).json(response)
  } catch (error: any) {
    console.error('Search error:', error)
    return res.status(500).json({ error: error.message || 'Search failed' })
  }
}

export const config = { api: { responseLimit: false } }
