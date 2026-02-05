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

const aiRankings: Record<string, { supported: number; contradicted: number; unverified: number; total: number }> = {}

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

// Expanded myths database
const KNOWN_MYTHS: Array<{ pattern: RegExp; truth: string }> = [
  { pattern: /napoleon.*(short|5'2"|5 foot 2|152 cm)/i, truth: 'Napoleon was actually average height (5\'6"-5\'7" or 168-170cm). The "short" myth came from British propaganda and confusion between French and English inches.' },
  { pattern: /humans.*(only|just).*(10|ten)\s*(%|percent).*brain/i, truth: 'This is a complete myth. Humans use virtually all of their brain, and brain scans show activity throughout.' },
  { pattern: /goldfish.*(3|three|short)\s*(second|sec).*memory/i, truth: 'Goldfish actually have memories lasting weeks, months, or even years. This is a myth.' },
  { pattern: /great\s*wall.*china.*(visible|see|seen).*space/i, truth: 'The Great Wall is NOT visible from space with the naked eye. This is a common myth.' },
  { pattern: /einstein.*(failed|flunked).*math/i, truth: 'Einstein did NOT fail math. He excelled at mathematics from a young age.' },
  { pattern: /vikings.*(horned|horn).*helmets/i, truth: 'Vikings did NOT wear horned helmets. This is a 19th-century myth.' },
  { pattern: /lightning.*(never|doesn.t).*strike.*(twice|same)/i, truth: 'Lightning CAN and DOES strike the same place twice. Tall buildings get struck many times.' },
  { pattern: /cracking.*(knuckles|joints).*arthritis/i, truth: 'Cracking knuckles does NOT cause arthritis. Multiple studies have confirmed this.' },
  { pattern: /sugar.*(hyper|hyperactive).*children/i, truth: 'Sugar does NOT cause hyperactivity in children. This is a myth debunked by multiple studies.' },
  { pattern: /shaving.*(thicker|faster|darker).*hair/i, truth: 'Shaving does NOT make hair grow back thicker or darker. This is a myth.' },
  { pattern: /blood.*(blue|color).*vein/i, truth: 'Blood is NEVER blue. It is always red. Veins appear blue due to how light penetrates skin.' },
  { pattern: /bats.*blind/i, truth: 'Bats are NOT blind. Most bats can see quite well and also use echolocation.' },
  { pattern: /bulls.*(hate|angry|charge).*red/i, truth: 'Bulls are colorblind to red. They charge at the movement of the cape, not its color.' },
  { pattern: /tongue.*(taste|map).*zones/i, truth: 'The tongue map is a myth. All taste buds can detect all flavors.' },
  { pattern: /penny.*empire.*state.*kill/i, truth: 'A penny dropped from the Empire State Building would NOT kill someone. Terminal velocity is too low.' },
  { pattern: /dogs.*see.*(only|just).*black.*white/i, truth: 'Dogs can see colors, just not as many as humans. They see blues and yellows well.' },
  { pattern: /we.*swallow.*spiders.*sleep/i, truth: 'The claim that we swallow spiders in our sleep is a myth. Spiders avoid sleeping humans.' },
  { pattern: /hair.*nails.*grow.*after.*death/i, truth: 'Hair and nails do NOT grow after death. The skin dehydrates and retracts, creating the illusion.' },
  { pattern: /thomas.*edison.*invent.*light.*bulb/i, truth: 'Edison did not invent the light bulb. He improved upon designs by many inventors and commercialized it.' },
  { pattern: /columbus.*prove.*earth.*round/i, truth: 'Columbus did NOT prove the Earth was round. Educated people already knew this since ancient Greece.' },
]

function checkKnownMyths(claim: string): { isMyth: boolean; explanation: string } | null {
  for (const myth of KNOWN_MYTHS) {
    if (myth.pattern.test(claim)) {
      return { isMyth: true, explanation: myth.truth }
    }
  }
  return null
}

async function callClaudeBasic(prompt: string, apiKey: string): Promise<string> {
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
      messages: [{ role: 'user', content: prompt }]
    })
  })

  if (!response.ok) {
    throw new Error('API request failed')
  }

  const data = await response.json()
  return data.content?.[0]?.text || ''
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

async function extractClaims(content: string, apiKey: string): Promise<Array<{claim: string; type: string}>> {
  const cleanContent = cleanText(content)
  
  if (cleanContent.length < 20) {
    return []
  }

  try {
    const prompt = `Extract factual claims from this text. Focus on SPECIFIC, VERIFIABLE facts.

RULES:
1. Extract claims with specific details (numbers, dates, names, measurements)
2. Break complex sentences into individual checkable claims
3. Keep claims concise - ONE fact each
4. Maximum 10 claims

CLASSIFICATION:
- "fact" = Verifiable with sources (dates, numbers, names, events, statistics)
- "opinion" = Subjective (words like "best", "should", "beautiful", "I think")
- "prediction" = About the future

Text:
"${cleanContent.slice(0, 4000)}"

Return ONLY valid JSON array:
[{"claim": "exact claim", "type": "fact|opinion|prediction"}]

If no claims found, return: []`

    const text = await callClaudeBasic(prompt, apiKey)
    const jsonMatch = text.match(/\[[\s\S]*?\]/)
    if (!jsonMatch) return []
    
    const parsed = JSON.parse(jsonMatch[0])
    return Array.isArray(parsed) ? parsed.slice(0, 10) : []
  } catch (error) {
    console.error('Claim extraction error:', error)
    return []
  }
}

async function searchAndVerify(claim: string, apiKey: string): Promise<{sources: SourceResult[]; status: string; explanation: string}> {
  // Check known myths first
  const mythCheck = checkKnownMyths(claim)
  if (mythCheck) {
    return {
      sources: [{
        url: 'https://en.wikipedia.org/wiki/List_of_common_misconceptions',
        title: 'List of Common Misconceptions - Wikipedia',
        snippet: mythCheck.explanation,
        domain: 'wikipedia.org'
      }],
      status: 'contradicted',
      explanation: mythCheck.explanation
    }
  }

  try {
    // Improved verification prompt - pushes harder for determination
    const prompt = `VERIFY THIS CLAIM by searching the web:

"${claim}"

INSTRUCTIONS:
1. Search authoritative sources (Wikipedia, news, .gov, .edu, official sites)
2. Check if specific details (numbers, dates, names) are accurate
3. Make a determination - avoid "unverified" unless you truly found NOTHING

DECISION GUIDE:
- "supported" = Sources confirm this is TRUE/ACCURATE
- "contradicted" = Sources show this is FALSE/WRONG/A MYTH
- "unverified" = ONLY if you searched and found NO relevant information

IMPORTANT: Most factual claims about history, science, geography, famous people CAN be verified. Try hard before saying "unverified".

Respond with ONLY this JSON:
{
  "status": "supported|contradicted|unverified",
  "explanation": "2-3 sentences explaining what sources say and why you made this determination",
  "sources": [
    {"url": "URL", "title": "Page Title", "snippet": "Relevant quote", "domain": "domain.com"}
  ]
}

Include at least 1 source for "supported" or "contradicted" status.`

    const text = await callClaudeWithSearch(prompt, apiKey)
    
    let sources: SourceResult[] = []
    let status = 'unverified'
    let explanation = 'We searched but could not find reliable sources for this specific claim.'

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0])
        
        if (parsed.status && ['supported', 'contradicted', 'unverified'].includes(parsed.status)) {
          status = parsed.status
        }
        
        if (parsed.explanation && parsed.explanation.length > 10) {
          explanation = parsed.explanation
        }
        
        if (Array.isArray(parsed.sources)) {
          sources = parsed.sources
            .filter((s: { url?: string; title?: string }) => s && (s.url || s.title))
            .slice(0, 3)
            .map((s: { url?: string; title?: string; snippet?: string; domain?: string }) => {
              let domain = s.domain || 'unknown'
              if (s.url && !s.domain) {
                try { domain = new URL(s.url).hostname.replace('www.', '') } catch (e) {}
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
        // Fallback: try to determine from text
        const lowerText = text.toLowerCase()
        if (lowerText.includes('true') || lowerText.includes('correct') || lowerText.includes('accurate') || lowerText.includes('confirmed')) {
          status = 'supported'
          explanation = 'Sources indicate this claim is accurate.'
        } else if (lowerText.includes('false') || lowerText.includes('incorrect') || lowerText.includes('myth') || lowerText.includes('wrong') || lowerText.includes('inaccurate')) {
          status = 'contradicted'
          explanation = 'Sources indicate this claim is inaccurate.'
        }
      }
    }

    // Better "unverified" explanations
    if (status === 'unverified') {
      if (claim.length < 30) {
        explanation = 'This claim is too brief to verify. Try a more specific statement with details.'
      } else if (claim.includes('?')) {
        explanation = 'This appears to be a question, not a factual claim to verify.'
      } else {
        explanation = 'We could not find authoritative sources that directly address this claim. This doesn\'t mean it\'s false—just that we couldn\'t verify it with confidence.'
      }
    }

    return { sources, status, explanation }
  } catch (error) {
    console.error('Search error:', error)
    return {
      sources: [],
      status: 'unverified',
      explanation: 'An error occurred while searching. Please try again.'
    }
  }
}

function updateRankings(aiSource: string, results: ClaimResult[]): void {
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

export function getRankings(): Array<{name: string; checksCount: number; supportedRate: number; contradictedRate: number; avgScore: number}> {
  return Object.entries(aiRankings)
    .filter(([, stats]) => stats.total > 0)
    .map(([name, stats]) => ({
      name,
      checksCount: stats.total,
      supportedRate: stats.total > 0 ? Math.round((stats.supported / stats.total) * 100) : 0,
      contradictedRate: stats.total > 0 ? Math.round((stats.contradicted / stats.total) * 100) : 0,
      avgScore: stats.total > 0 ? Math.round(((stats.supported - stats.contradicted) / stats.total) * 100) : 0
    }))
    .sort((a, b) => b.avgScore - a.avgScore)
}

// Generate summary text (Alex's feedback: summary first, Madelynn's wording)
function generateSummary(results: ClaimResult[], aiSource: string): string {
  const supported = results.filter(r => r.status === 'supported').length
  const contradicted = results.filter(r => r.status === 'contradicted').length
  const total = results.length

  if (total === 0) return "No claims found to verify."
  
  if (contradicted === 0 && supported > 0) {
    if (supported === total) return `✅ All ${supported} facts from ${aiSource} are verified as true!`
    return `✅ ${supported} verified truth${supported > 1 ? 's' : ''} from ${aiSource}.`
  }
  
  if (contradicted > 0 && supported === 0) {
    return `⚠️ Warning: ${contradicted} claim${contradicted > 1 ? 's' : ''} from ${aiSource} ${contradicted === 1 ? 'is' : 'are'} proven false.`
  }
  
  if (contradicted > 0 && supported > 0) {
    return `Mixed: ${supported} verified true, ${contradicted} proven false. Check details below.`
  }
  
  return `Checked ${total} claims from ${aiSource}.`
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
    const { content, aiSource } = req.body

    if (!content || typeof content !== 'string') {
      res.status(400).json({ error: 'Please paste some text to verify.' })
      return
    }

    const cleanContent = cleanText(content)

    if (cleanContent.length < 20) {
      res.status(400).json({ error: 'Please paste a longer text with complete sentences.' })
      return
    }

    if (cleanContent.length > 15000) {
      res.status(400).json({ error: 'Text is too long. Please paste a shorter section.' })
      return
    }

    if (!aiSource || typeof aiSource !== 'string') {
      res.status(400).json({ error: 'Please select which AI generated this text.' })
      return
    }

    const extractedClaims = await extractClaims(cleanContent, apiKey)
    
    const factClaims = extractedClaims.filter(c => c.type === 'fact')
    const opinionClaims = extractedClaims.filter(c => c.type === 'opinion' || c.type === 'prediction')

    if (factClaims.length === 0 && opinionClaims.length === 0) {
      res.status(200).json({
        claims: [],
        summary: { total: 0, supported: 0, contradicted: 0, unverified: 0, opinions: 0 },
        summaryText: "No specific claims found. Try text with dates, numbers, or events.",
        message: "No specific claims found. Try text with dates, numbers, or events."
      })
      return
    }

    if (factClaims.length === 0 && opinionClaims.length > 0) {
      const opinionResults: ClaimResult[] = opinionClaims.map(c => ({
        claim: c.claim,
        type: 'opinion' as const,
        status: 'opinion' as const,
        sources: [],
        explanation: 'This is an opinion, not a verifiable fact.'
      }))

      res.status(200).json({
        claims: opinionResults,
        summary: { total: opinionClaims.length, supported: 0, contradicted: 0, unverified: 0, opinions: opinionClaims.length },
        summaryText: "This text contains opinions, not verifiable facts.",
        message: "This text contains opinions, not verifiable facts."
      })
      return
    }

    const results: ClaimResult[] = []

    for (const claim of factClaims) {
      const verification = await searchAndVerify(claim.claim, apiKey)
      results.push({
        claim: claim.claim,
        type: 'fact',
        status: verification.status as 'supported' | 'contradicted' | 'unverified',
        sources: verification.sources,
        explanation: verification.explanation
      })
    }

    for (const claim of opinionClaims) {
      results.push({
        claim: claim.claim,
        type: claim.type as 'opinion' | 'prediction',
        status: 'opinion',
        sources: [],
        explanation: 'This is an opinion, not a verifiable fact.'
      })
    }

    updateRankings(aiSource, results)

    const summary = {
      total: results.length,
      supported: results.filter(r => r.status === 'supported').length,
      contradicted: results.filter(r => r.status === 'contradicted').length,
      unverified: results.filter(r => r.status === 'unverified').length,
      opinions: results.filter(r => r.status === 'opinion').length
    }

    const summaryText = generateSummary(results, aiSource)

    res.status(200).json({ claims: results, summary, summaryText })

  } catch (error) {
    console.error('Verification error:', error)
    res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
