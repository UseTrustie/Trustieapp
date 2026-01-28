import type { NextApiRequest, NextApiResponse } from 'next'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

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
  message?: string
}

// In-memory rankings storage
const aiRankings: Record<string, { supported: number; contradicted: number; unverified: number; total: number }> = {}

// Comprehensive text cleaning function
function cleanText(text: string): string {
  if (!text || typeof text !== 'string') return ''
  
  return text
    // Currency and math symbols
    .replace(/[₿€£¥₹₽₩฿]/g, '')
    // Bullets and list markers
    .replace(/[•◦●○■□▪▫▸▹►▻◆◇★☆✓✔✗✘✦✧]/g, '-')
    // Dashes and hyphens
    .replace(/[–—―‐‑‒]/g, '-')
    // Quotes
    .replace(/[\u2018\u2019\u201A\u201B`´]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F„"«»]/g, '"')
    // Ellipsis
    .replace(/[\u2026]/g, '...')
    // Spaces
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
    // Line breaks
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    // Emojis (keep some context but remove problematic ones)
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    // Other special characters
    .replace(/[§¶†‡©®™°±²³µ¼½¾]/g, '')
    // Multiple spaces
    .replace(/\s+/g, ' ')
    // Trim
    .trim()
}

// Split long text into chunks for processing
function splitIntoChunks(text: string, maxLength: number = 3000): string[] {
  if (text.length <= maxLength) return [text]
  
  const chunks: string[] = []
  const sentences = text.split(/(?<=[.!?])\s+/)
  let currentChunk = ''
  
  for (const sentence of sentences) {
    if ((currentChunk + ' ' + sentence).length > maxLength) {
      if (currentChunk) chunks.push(currentChunk.trim())
      currentChunk = sentence
    } else {
      currentChunk = currentChunk ? currentChunk + ' ' + sentence : sentence
    }
  }
  
  if (currentChunk) chunks.push(currentChunk.trim())
  return chunks.slice(0, 3) // Max 3 chunks to avoid timeout
}

// Known myths and misconceptions for better detection
const KNOWN_MYTHS = [
  { pattern: /napoleon.*(short|5'2"|5 foot 2|152 cm)/i, truth: 'Napoleon was actually average height (5\'6"-5\'7" or 168-170cm). The "short" myth came from British propaganda and confusion between French and English inches.' },
  { pattern: /humans.*(only|just).*(10|ten)\s*(%|percent).*brain/i, truth: 'This is a complete myth. Humans use virtually all of their brain, and brain scans show activity throughout.' },
  { pattern: /goldfish.*(3|three|short)\s*(second|sec).*memory/i, truth: 'Goldfish actually have memories lasting weeks, months, or even years. This is a myth.' },
  { pattern: /great\s*wall.*china.*(visible|see|seen).*space/i, truth: 'The Great Wall is NOT visible from space with the naked eye. This is a common myth.' },
  { pattern: /einstein.*(failed|flunked).*math/i, truth: 'Einstein did NOT fail math. He excelled at mathematics from a young age.' },
  { pattern: /vikings.*(horned|horn).*helmets/i, truth: 'Vikings did NOT wear horned helmets. This is a 19th-century myth.' },
  { pattern: /lightning.*(never|doesn't).*strike.*(twice|same)/i, truth: 'Lightning CAN and DOES strike the same place twice. Tall buildings are struck repeatedly.' },
  { pattern: /cracking.*(knuckles|joints).*arthritis/i, truth: 'Cracking knuckles does NOT cause arthritis. Studies have found no connection.' },
  { pattern: /sugar.*(hyper|hyperactive).*children/i, truth: 'Sugar does NOT cause hyperactivity in children. Multiple studies have debunked this myth.' },
  { pattern: /shaving.*(thicker|faster|darker).*hair/i, truth: 'Shaving does NOT make hair grow back thicker or darker. This is a myth.' },
  { pattern: /humans.*(swallow|eat).*(8|eight).*spiders.*sleep/i, truth: 'Humans do NOT swallow 8 spiders per year while sleeping. This is a made-up "fact".' },
  { pattern: /blood.*blue.*(vein|inside)/i, truth: 'Blood is NEVER blue. Deoxygenated blood is dark red. Veins appear blue due to light absorption through skin.' },
  { pattern: /bats.*blind/i, truth: 'Bats are NOT blind. Most bats can see quite well, and some have excellent vision.' },
  { pattern: /bulls.*(hate|angry|charge).*red/i, truth: 'Bulls are colorblind to red. They react to the movement of the cape, not its color.' },
]

function checkKnownMyths(claim: string): { isMyth: boolean, explanation: string } | null {
  for (const myth of KNOWN_MYTHS) {
    if (myth.pattern.test(claim)) {
      return { isMyth: true, explanation: myth.truth }
    }
  }
  return null
}

async function extractClaims(content: string): Promise<Array<{claim: string, type: string}>> {
  const cleanContent = cleanText(content)
  
  if (cleanContent.length < 20) {
    return []
  }

  // Process in chunks if too long
  const chunks = splitIntoChunks(cleanContent, 3500)
  const allClaims: Array<{claim: string, type: string}> = []

  for (const chunk of chunks) {
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: `You are a fact-checker. Extract ALL verifiable factual claims from this text.

IMPORTANT INSTRUCTIONS:
1. Extract SPECIFIC claims with dates, numbers, names, events, measurements
2. Break compound sentences into separate claims
3. Include claims about historical facts, scientific facts, statistics
4. Classify each as "fact", "opinion", or "prediction"

CLASSIFICATION RULES:
- "fact" = Specific, verifiable information (dates, numbers, measurements, historical events, scientific claims)
- "opinion" = Subjective belief, value judgment, or preference (contains words like "best", "should", "I think")
- "prediction" = Statement about the future

EXAMPLES:
- "The Earth is 4.5 billion years old" = fact
- "Napoleon was short" = fact (can be verified - and it's actually false!)
- "Bitcoin is the best investment" = opinion
- "AI will replace all jobs by 2030" = prediction

Text to analyze:
"""
${chunk}
"""

Return ONLY a valid JSON array, no other text:
[{"claim": "exact claim from text", "type": "fact|opinion|prediction"}]

If no claims found, return: []`
          }
        ]
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      
      // Try to find JSON array in response
      const jsonMatch = text.match(/\[[\s\S]*?\]/)?.[0]
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch)
          if (Array.isArray(parsed)) {
            allClaims.push(...parsed)
          }
        } catch (e) {
          console.error('JSON parse error:', e)
        }
      }
    } catch (error) {
      console.error('Claim extraction error:', error)
    }
  }

  // Remove duplicates and limit
  const uniqueClaims = allClaims.filter((claim, index, self) =>
    index === self.findIndex(c => c.claim.toLowerCase() === claim.claim.toLowerCase())
  )

  return uniqueClaims.slice(0, 10) // Max 10 claims
}

async function searchAndVerify(claim: string): Promise<{sources: SourceResult[], status: string, explanation: string}> {
  // First check known myths
  const mythCheck = checkKnownMyths(claim)
  if (mythCheck) {
    return {
      sources: [],
      status: 'contradicted',
      explanation: mythCheck.explanation
    }
  }

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      tools: [
        {
          type: 'web_search' as const,
          name: 'web_search',
          max_uses: 3
        }
      ],
      messages: [
        {
          role: 'user',
          content: `You are a professional fact-checker. Search the web to verify if this claim is TRUE or FALSE:

CLAIM: "${claim}"

IMPORTANT VERIFICATION RULES:
1. Search multiple authoritative sources (Wikipedia, academic sites, news outlets, official sources)
2. Pay close attention to SPECIFIC numbers, dates, and measurements
3. Be aware of COMMON MYTHS that sound true but are false:
   - Napoleon was NOT short (he was average height, 5'6"-5'7")
   - Humans do NOT use only 10% of their brains (we use all of it)
   - Goldfish do NOT have 3-second memories (they remember for months)
   - The Great Wall is NOT visible from space
   - Vikings did NOT wear horned helmets
   
4. If the claim contains a number, verify the EXACT number
5. If sources contradict each other, go with the majority of reliable sources

After thorough research, respond with ONLY this JSON:
{
  "status": "supported|contradicted|unverified",
  "explanation": "Clear explanation of what the evidence shows (2-3 sentences)",
  "sources": [
    {"url": "full url", "title": "page title", "snippet": "relevant quote from source", "domain": "domain.com"}
  ]
}

STATUS DEFINITIONS:
- "supported" = Evidence confirms the claim is ACCURATE
- "contradicted" = Evidence shows the claim is WRONG or MISLEADING
- "unverified" = Cannot find enough reliable evidence either way

Return ONLY valid JSON, no other text.`
        }
      ]
    })

    let sources: SourceResult[] = []
    let status = 'unverified'
    let explanation = 'Could not find enough reliable sources to verify this claim.'

    for (const block of response.content) {
      if (block.type === 'text') {
        try {
          // Find JSON object in response
          const jsonMatch = block.text.match(/\{[\s\S]*\}/)?.[0]
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch)
            
            if (parsed.status && ['supported', 'contradicted', 'unverified'].includes(parsed.status)) {
              status = parsed.status
            }
            
            if (parsed.explanation) {
              explanation = parsed.explanation
            }
            
            if (Array.isArray(parsed.sources)) {
              sources = parsed.sources
                .filter((s: any) => s && (s.url || s.title))
                .slice(0, 3)
                .map((s: any) => ({
                  url: s.url || '#',
                  title: s.title || 'Source',
                  snippet: s.snippet || '',
                  domain: s.domain || (s.url ? new URL(s.url).hostname.replace('www.', '') : 'unknown')
                }))
            }
          }
        } catch (e) {
          console.error('JSON parse error in verification:', e)
        }
      }
    }

    return { sources, status, explanation }
  } catch (error) {
    console.error('Search error:', error)
    return {
      sources: [],
      status: 'unverified',
      explanation: 'Could not search for sources at this time. Please try again.'
    }
  }
}

function updateRankings(aiSource: string, results: ClaimResult[]) {
  if (!aiRankings[aiSource]) {
    aiRankings[aiSource] = { supported: 0, contradicted: 0, unverified: 0, total: 0 }
  }
  
  for (const result of results) {
    if (result.type !== 'fact') continue
    
    if (result.status === 'supported') aiRankings[aiSource].supported++
    else if (result.status === 'contradicted') aiRankings[aiSource].contradicted++
    else if (result.status === 'unverified') aiRankings[aiSource].unverified++
    aiRankings[aiSource].total++
  }
}

export function getRankings() {
  return Object.entries(aiRankings)
    .filter(([_, stats]) => stats.total > 0)
    .map(([name, stats]) => ({
      name,
      checksCount: stats.total,
      supportedRate: stats.total > 0 ? Math.round((stats.supported / stats.total) * 100) : 0,
      contradictedRate: stats.total > 0 ? Math.round((stats.contradicted / stats.total) * 100) : 0,
      avgScore: stats.total > 0 ? Math.round(((stats.supported - stats.contradicted) / stats.total) * 100) : 0
    }))
    .sort((a, b) => b.avgScore - a.avgScore)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set timeout handling
  res.setHeader('Connection', 'keep-alive')
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { content, aiSource } = req.body

    // Validate content
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Please paste some text to verify.' })
    }

    const cleanContent = cleanText(content)

    if (cleanContent.length < 20) {
      return res.status(400).json({ error: 'Please paste a longer text with complete sentences to verify.' })
    }

    if (cleanContent.length > 15000) {
      return res.status(400).json({ error: 'Text is too long. Please paste a shorter section (under 15,000 characters).' })
    }

    // Validate AI source
    if (!aiSource || typeof aiSource !== 'string') {
      return res.status(400).json({ error: 'Please select which AI generated this text.' })
    }

    // Extract claims
    const extractedClaims = await extractClaims(cleanContent)
    
    // Separate facts from opinions
    const factClaims = extractedClaims.filter(c => c.type === 'fact')
    const opinionClaims = extractedClaims.filter(c => c.type === 'opinion' || c.type === 'prediction')

    // Handle no claims found
    if (factClaims.length === 0 && opinionClaims.length === 0) {
      return res.status(200).json({
        claims: [],
        summary: { total: 0, supported: 0, contradicted: 0, unverified: 0, opinions: 0 },
        message: "We couldn't find any specific claims to verify. Try pasting text with specific facts like dates, numbers, statistics, names, or events."
      })
    }

    // Handle only opinions
    if (factClaims.length === 0 && opinionClaims.length > 0) {
      const opinionResults: ClaimResult[] = opinionClaims.map(c => ({
        claim: c.claim,
        type: 'opinion' as const,
        status: 'opinion' as const,
        sources: [],
        explanation: 'This is an opinion or prediction, not a verifiable fact. Opinions cannot be proven true or false with sources.'
      }))

      return res.status(200).json({
        claims: opinionResults,
        summary: { total: opinionClaims.length, supported: 0, contradicted: 0, unverified: 0, opinions: opinionClaims.length },
        message: "This text contains opinions and predictions rather than verifiable facts."
      })
    }

    // Verify each fact claim
    const results: ClaimResult[] = []

    for (const claim of factClaims) {
      try {
        const verification = await searchAndVerify(claim.claim)
        results.push({
          claim: claim.claim,
          type: 'fact',
          status: verification.status as 'supported' | 'contradicted' | 'unverified',
          sources: verification.sources,
          explanation: verification.explanation
        })
      } catch (error) {
        console.error('Error verifying claim:', claim.claim, error)
        results.push({
          claim: claim.claim,
          type: 'fact',
          status: 'unverified',
          sources: [],
          explanation: 'Could not verify this claim due to an error.'
        })
      }
    }

    // Add opinion claims to results
    for (const claim of opinionClaims) {
      results.push({
        claim: claim.claim,
        type: claim.type as 'opinion' | 'prediction',
        status: 'opinion',
        sources: [],
        explanation: 'This is an opinion or prediction, not a verifiable fact.'
      })
    }

    // Update AI rankings
    updateRankings(aiSource, results)

    // Calculate summary
    const summary = {
      total: results.length,
      supported: results.filter(r => r.status === 'supported').length,
      contradicted: results.filter(r => r.status === 'contradicted').length,
      unverified: results.filter(r => r.status === 'unverified').length,
      opinions: results.filter(r => r.status === 'opinion').length
    }

    const response: VerificationResult = { claims: results, summary }

    return res.status(200).json(response)

  } catch (error: any) {
    console.error('Verification error:', error)
    
    // Provide helpful error message
    let errorMessage = 'Something went wrong while verifying. Please try again.'
    
    if (error.message?.includes('timeout')) {
      errorMessage = 'The verification took too long. Please try with a shorter text.'
    } else if (error.message?.includes('rate limit')) {
      errorMessage = 'Too many requests. Please wait a moment and try again.'
    } else if (error.message?.includes('invalid')) {
      errorMessage = 'There was an issue processing your text. Try removing special characters or formatting.'
    }
    
    return res.status(500).json({ error: errorMessage })
  }
}
