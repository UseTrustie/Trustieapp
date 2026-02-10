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

// Common facts that should always be verified as true
const KNOWN_FACTS = [
  { pattern: /earth.*round|earth.*sphere|spherical.*earth/i, status: 'verified', explanation: 'This is an established scientific fact confirmed by centuries of evidence.' },
  { pattern: /water.*h2o|h2o.*water/i, status: 'verified', explanation: 'This is basic chemistry - water is composed of hydrogen and oxygen.' },
  { pattern: /sun.*star|star.*sun/i, status: 'verified', explanation: 'The Sun is classified as a G-type main-sequence star.' },
  { pattern: /moon.*earth.*satellite|earth.*moon.*natural.*satellite/i, status: 'verified', explanation: 'The Moon is Earth\'s only natural satellite.' },
  { pattern: /gravity.*newton|newton.*gravity/i, status: 'verified', explanation: 'Newton\'s law of universal gravitation is well-established physics.' },
  { pattern: /dna.*genetic|genetic.*dna/i, status: 'verified', explanation: 'DNA carries genetic information - this is fundamental biology.' },
  { pattern: /evolution.*darwin|darwin.*evolution/i, status: 'verified', explanation: 'Darwin\'s theory of evolution is supported by extensive scientific evidence.' },
  { pattern: /photosynthesis.*plants|plants.*photosynthesis/i, status: 'verified', explanation: 'Plants convert sunlight to energy through photosynthesis.' },
  { pattern: /humans.*primates|primates.*humans/i, status: 'verified', explanation: 'Humans are classified as primates in biological taxonomy.' },
  { pattern: /atoms.*matter|matter.*atoms/i, status: 'verified', explanation: 'All matter is composed of atoms - fundamental physics.' },
]

function getSourceQuality(domain: string): 'high' | 'medium' | 'low' {
  const highTrust = ['.edu', '.gov', 'wikipedia.org', 'pubmed', 'nature.com', 'sciencedirect', 'scholar.google', 'britannica.com', 'who.int', 'cdc.gov', 'nih.gov', 'nasa.gov']
  const mediumTrust = ['reuters.com', 'apnews.com', 'bbc.com', 'bbc.co.uk', 'npr.org', 'pbs.org', 'nytimes.com', 'washingtonpost.com', 'theguardian.com', 'wsj.com', 'economist.com']
  
  const domainLower = domain.toLowerCase()
  
  if (highTrust.some(t => domainLower.includes(t))) return 'high'
  if (mediumTrust.some(t => domainLower.includes(t))) return 'medium'
  return 'low'
}

function checkKnownFacts(claim: string): { matched: boolean, status?: string, explanation?: string } {
  for (const fact of KNOWN_FACTS) {
    if (fact.pattern.test(claim)) {
      return { matched: true, status: fact.status, explanation: fact.explanation }
    }
  }
  return { matched: false }
}

async function extractClaims(content: string, apiKey: string): Promise<any[]> {
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
        content: `Extract ALL factual claims from this text that can be verified. Be thorough - do not skip any verifiable statements.

TEXT TO ANALYZE:
"${content}"

INSTRUCTIONS:
1. Extract EVERY statement that makes a factual claim (dates, numbers, events, scientific facts, historical facts, etc.)
2. Mark opinions and predictions separately
3. Create a specific search query for each fact
4. Do NOT skip well-known facts - they should still be verified

Return ONLY a JSON array in this exact format:
[
  {
    "claim": "The exact factual claim from the text",
    "type": "fact" | "opinion" | "prediction",
    "searchQuery": "specific search query to verify this claim"
  }
]

If no factual claims exist, return: []
Return ONLY the JSON array, no other text.`
      }]
    })
  })
  
  const data = await response.json()
  const text = data.content[0].text.trim()
  
  try {
    const match = text.match(/\[[\s\S]*\]/)
    return match ? JSON.parse(match[0]) : []
  } catch {
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
          content: `Search for: "${query}"

Find 2-3 credible sources. Prioritize .edu, .gov, Wikipedia, and established news sources.

Return ONLY a JSON array:
[{"url": "full url", "title": "page title", "snippet": "relevant quote that addresses the claim", "domain": "domain name"}]`
        }]
      })
    })
    
    const data = await response.json()
    let text = ''
    for (const block of data.content) {
      if (block.type === 'text') text += block.text
    }
    
    const match = text.match(/\[[\s\S]*\]/)
    if (match) {
      const sources = JSON.parse(match[0]).slice(0, 3)
      return sources.map((s: any) => ({
        ...s,
        quality: getSourceQuality(s.domain || s.url || '')
      }))
    }
    return []
  } catch {
    return []
  }
}

async function evaluateClaim(claim: string, sources: SourceResult[], apiKey: string): Promise<{status: string, explanation: string, sourceAgreement: number}> {
  // First check known facts
  const knownFact = checkKnownFacts(claim)
  if (knownFact.matched) {
    return {
      status: knownFact.status!,
      explanation: knownFact.explanation!,
      sourceAgreement: 5 // High agreement for known facts
    }
  }
  
  if (sources.length === 0) {
    return { 
      status: 'unconfirmed', 
      explanation: 'No relevant sources found to verify this claim. Consider searching manually.',
      sourceAgreement: 0
    }
  }
  
  const sourcesText = sources.map((s, i) => `Source ${i + 1} (${s.quality} trust): ${s.snippet}`).join('\n')
  
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
        content: `Evaluate if this claim is TRUE or FALSE based on the sources provided.

CLAIM: "${claim}"

SOURCES:
${sourcesText}

INSTRUCTIONS:
- If sources clearly SUPPORT the claim → status: "verified"
- If sources clearly CONTRADICT the claim → status: "false"  
- If sources are unclear or insufficient → status: "unconfirmed"
- Count how many sources agree with each other

Return ONLY JSON:
{
  "status": "verified" | "false" | "unconfirmed",
  "explanation": "Brief explanation of why, using professional language (no contractions)",
  "sourceAgreement": number of sources that agree
}`
      }]
    })
  })
  
  const data = await response.json()
  const text = data.content[0].text.trim()
  
  try {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      const result = JSON.parse(match[0])
      return {
        status: result.status || 'unconfirmed',
        explanation: result.explanation || 'Could not determine verification status.',
        sourceAgreement: result.sourceAgreement || sources.length
      }
    }
  } catch {}
  
  return { 
    status: 'unconfirmed', 
    explanation: 'Could not evaluate this claim.',
    sourceAgreement: 0
  }
}

async function logToRankings(aiSource: string, summary: any) {
  try {
    await fetch(`${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/api/rankings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aiSource,
        verified: summary.verified,
        false: summary.false,
        unconfirmed: summary.unconfirmed,
        opinions: summary.opinions,
        total: summary.total
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
  if (!content) return res.status(400).json({ error: 'No content provided' })
  if (!aiSource) return res.status(400).json({ error: 'No AI source specified' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' })

  try {
    // Extract claims
    const claims = await extractClaims(content, apiKey)
    
    if (claims.length === 0) {
      return res.status(200).json({
        claims: [],
        summary: { total: 0, verified: 0, false: 0, unconfirmed: 0, opinions: 0 },
        message: 'No factual claims found to verify. The text may contain only opinions or general statements.'
      })
    }

    // Process each claim (limit to 7 for performance)
    const processed: ClaimResult[] = []
    for (const c of claims.slice(0, 7)) {
      if (c.type === 'opinion') {
        processed.push({
          claim: c.claim,
          type: 'opinion',
          status: 'opinion',
          sources: [],
          explanation: 'This is an opinion or subjective statement that cannot be fact-checked.',
          sourceAgreement: 0
        })
        continue
      }
      
      if (c.type === 'prediction') {
        processed.push({
          claim: c.claim,
          type: 'prediction',
          status: 'opinion',
          sources: [],
          explanation: 'This is a prediction about the future that cannot be verified yet.',
          sourceAgreement: 0
        })
        continue
      }
      
      // Search for sources
      const sources = await searchSources(c.searchQuery, apiKey)
      
      // Evaluate claim
      const evaluation = await evaluateClaim(c.claim, sources, apiKey)
      
      processed.push({
        claim: c.claim,
        type: c.type,
        status: evaluation.status as any,
        sources,
        explanation: evaluation.explanation,
        sourceAgreement: evaluation.sourceAgreement
      })
    }

    // Calculate summary
    const summary = {
      total: processed.length,
      verified: processed.filter(c => c.status === 'verified').length,
      false: processed.filter(c => c.status === 'false').length,
      unconfirmed: processed.filter(c => c.status === 'unconfirmed').length,
      opinions: processed.filter(c => c.status === 'opinion').length
    }

    // Log to rankings
    await logToRankings(aiSource, summary)

    return res.status(200).json({ claims: processed, summary })
  } catch (error: any) {
    console.error('Verification error:', error)
    return res.status(500).json({ error: error.message || 'Verification failed' })
  }
}

export const config = { api: { responseLimit: false } }
