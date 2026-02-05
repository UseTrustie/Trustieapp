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

const KNOWN_MYTHS: Array<{ pattern: RegExp; truth: string }> = [
  { pattern: /napoleon.*(short|5'2"|5 foot 2|152 cm)/i, truth: 'Napoleon was actually average height (5\'6"-5\'7" or 168-170cm). The "short" myth came from British propaganda and confusion between French and English inches.' },
  { pattern: /humans.*(only|just).*(10|ten)\s*(%|percent).*brain/i, truth: 'This is a complete myth. Humans use virtually all of their brain, and brain scans show activity throughout.' },
  { pattern: /goldfish.*(3|three|short)\s*(second|sec).*memory/i, truth: 'Goldfish actually have memories lasting weeks, months, or even years. This is a myth.' },
  { pattern: /great\s*wall.*china.*(visible|see|seen).*space/i, truth: 'The Great Wall is NOT visible from space with the naked eye. This is a common myth.' },
  { pattern: /einstein.*(failed|flunked).*math/i, truth: 'Einstein did NOT fail math. He excelled at mathematics from a young age.' },
  { pattern: /vikings.*(horned|horn).*helmets/i, truth: 'Vikings did NOT wear horned helmets. This is a 19th-century myth.' },
  { pattern: /lightning.*(never|doesn.t).*strike.*(twice|same)/i, truth: 'Lightning CAN and DOES strike the same place twice.' },
  { pattern: /cracking.*(knuckles|joints).*arthritis/i, truth: 'Cracking knuckles does NOT cause arthritis.' },
  { pattern: /sugar.*(hyper|hyperactive).*children/i, truth: 'Sugar does NOT cause hyperactivity in children.' },
  { pattern: /shaving.*(thicker|faster|darker).*hair/i, truth: 'Shaving does NOT make hair grow back thicker or darker.' },
  { pattern: /blood.*(blue|color).*vein/i, truth: 'Blood is NEVER blue. It is always red. Veins appear blue due to how light penetrates skin.' },
  { pattern: /bats.*blind/i, truth: 'Bats are NOT blind. Most bats can see quite well and also use echolocation.' },
  { pattern: /bulls.*red.*angry/i, truth: 'Bulls are colorblind to red. They charge at the movement of the cape, not its color.' },
  { pattern: /tongue.*taste.*zones|map/i, truth: 'The tongue map is a myth. All taste buds can detect all flavors.' },
  { pattern: /dropping.*penny.*empire.*state.*kill/i, truth: 'A penny dropped from the Empire State Building would NOT kill someone. Terminal velocity is too low.' },
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

IMPORTANT RULES:
1. Extract claims that have specific details (numbers, dates, names, measurements, events)
2. Break complex sentences into individual checkable claims
3. Keep claims concise and focused on ONE fact each

CLASSIFICATION:
- "fact" = Specific verifiable information (dates, numbers, names, events, statistics, measurements)
- "opinion" = Subjective belief, preference, or value judgment (words like "best", "should", "beautiful")
- "prediction" = Statement about the future

Text to analyze:
"${cleanContent.slice(0, 4000)}"

Return ONLY a valid JSON array. Extract up to 10 claims:
[{"claim": "exact claim from text", "type": "fact|opinion|prediction"}]

If no verifiable claims found, return: []`

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
  // First check known myths database
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
    // IMPROVED PROMPT - More aggressive about finding answers
    const prompt = `You MUST search the web and verify this claim. Do NOT say "unverified" unless you truly cannot find ANY relevant information after searching.

CLAIM TO VERIFY: "${claim}"

INSTRUCTIONS:
1. Search for this specific claim using web search
2. Look for authoritative sources: Wikipedia, news sites, government sites, educational institutions
3. Check if the specific details (numbers, dates, names) match what sources say
4. If sources mostly agree with the claim = "supported"
5. If sources contradict the claim or show it's wrong = "contradicted"
6. ONLY use "unverified" if you searched and genuinely found NO relevant information

IMPORTANT:
- Most factual claims CAN be verified - try harder before saying "unverified"
- If you find partial information, make a determination based on what you found
- Common facts about history, science, geography, famous people ARE verifiable
- If the claim contains a specific number/date, check if that number/date is accurate

After searching, respond with ONLY this JSON format:
{
  "status": "supported|contradicted|unverified",
  "explanation": "2-3 sentence explanation of what you found and why you made this determination",
  "sources": [
    {"url": "actual URL", "title": "page title", "snippet": "relevant quote from source", "domain": "domain.com"}
  ]
}

STATUS GUIDE:
- "supported" = Sources confirm this is TRUE or ACCURATE
- "contradicted" = Sources show this is FALSE, WRONG, or a MYTH
- "unverified" = ONLY if you searched and found NO relevant information at all

You MUST include at least 1 source if status is "supported" or "contradicted".
Return ONLY valid JSON, no other text.`

    const text = await callClaudeWithSearch(prompt, apiKey)
    
    let sources: SourceResult[] = []
    let status = 'unverified'
    let explanation = 'We searched but could not find reliable sources that directly address this specific claim.'

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
            .map((s: { url?: string; title?: string; snippet?: string; domain?: string }) => ({
              url: s.url || '#',
              title: s.title || 'Source',
              snippet: s.snippet || '',
              domain: s.domain || new URL(s.url || 'https://unknown.com').hostname.replace('www.', '')
            }))
        }

        // If status is supported/contradicted but no sources, that's suspicious - but keep the determination
        if ((status === 'supported' || status === 'contradicted') && sources.length === 0) {
          // Try to extract domain from explanation if URL mentioned
          const urlMatch = explanation.match(/https?:\/\/[^\s]+/)
          if (urlMatch) {
            try {
              const domain = new URL(urlMatch[0]).hostname.replace('www.', '')
              sources.push({
                url: urlMatch[0],
                title: 'Source',
                snippet: explanation,
                domain: domain
              })
            } catch (e) {
              // URL parsing failed, continue without source
            }
          }
        }
      } catch (e) {
        console.error('JSON parse error:', e)
        // If we can't parse JSON but got a response, try to extract useful info
        if (text.toLowerCase().includes('true') || text.toLowerCase().includes('correct') || text.toLowerCase().includes('accurate')) {
          status = 'supported'
          explanation = 'Sources indicate this claim is accurate.'
        } else if (text.toLowerCase().includes('false') || text.toLowerCase().includes('incorrect') || text.toLowerCase().includes('myth') || text.toLowerCase().includes('wrong')) {
          status = 'contradicted'
          explanation = 'Sources indicate this claim is inaccurate or a common misconception.'
        }
      }
    }

    // Improve "unverified" explanations to be more specific
    if (status === 'unverified' && explanation === 'We searched but could not find reliable sources that directly address this specific claim.') {
      if (claim.length < 30) {
        explanation = 'This claim is too vague or general to verify. Try a more specific statement with dates, numbers, or names.'
      } else if (claim.includes('?')) {
        explanation = 'This appears to be a question rather than a factual claim to verify.'
      } else {
        explanation = 'We could not find authoritative sources that directly confirm or deny this specific claim. This doesn\'t mean it\'s false - just that we couldn\'t verify it.'
      }
    }

    return { sources, status, explanation }
  } catch (error) {
    console.error('Search error:', error)
    return {
      sources: [],
      status: 'unverified',
      explanation: 'We encountered an error while searching. Please try again.'
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

// Generate a summary sentence based on results
function generateSummary(results: ClaimResult[], aiSource: string): string {
  const supported = results.filter(r => r.status === 'supported').length
  const contradicted = results.filter(r => r.status === 'contradicted').length
  const unverified = results.filter(r => r.status === 'unverified').length
  const opinions = results.filter(r => r.status === 'opinion').length
  const total = results.length

  if (total === 0) {
    return "We couldn't find any claims to verify in this text."
  }

  if (contradicted === 0 && supported > 0) {
    if (supported === total) {
      return `✅ Good news! All ${supported} facts from ${aiSource} checked out as accurate.`
    }
    return `✅ The ${supported} verifiable fact${supported > 1 ? 's' : ''} from ${aiSource} appear${supported === 1 ? 's' : ''} to be accurate.`
  }

  if (contradicted > 0 && supported === 0) {
    return `⚠️ Warning: ${contradicted} claim${contradicted > 1 ? 's' : ''} from ${aiSource} appear${contradicted === 1 ? 's' : ''} to be false or misleading.`
  }

  if (contradicted > 0 && supported > 0) {
    return `Mixed results: ${supported} claim${supported > 1 ? 's' : ''} verified as true, but ${contradicted} appear${contradicted === 1 ? 's' : ''} to be false.`
  }

  if (unverified === total) {
    return `We couldn't verify these claims. They may be too specific or recent to find sources for.`
  }

  if (opinions === total) {
    return `This text contains opinions rather than verifiable facts.`
  }

  return `We checked ${total} claims from ${aiSource}.`
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
        summaryText: "We couldn't find specific claims to verify. Try text with dates, numbers, or events.",
        message: "We couldn't find specific claims to verify. Try text with dates, numbers, or events."
      })
      return
    }

    if (factClaims.length === 0 && opinionClaims.length > 0) {
      const opinionResults: ClaimResult[] = opinionClaims.map(c => ({
        claim: c.claim,
        type: 'opinion' as const,
        status: 'opinion' as const,
        sources: [],
        explanation: 'This is an opinion or subjective statement, not a verifiable fact.'
      }))

      res.status(200).json({
        claims: opinionResults,
        summary: { total: opinionClaims.length, supported: 0, contradicted: 0, unverified: 0, opinions: opinionClaims.length },
        summaryText: "This text contains opinions rather than verifiable facts.",
        message: "This text contains opinions rather than verifiable facts."
      })
      return
    }

    const results: ClaimResult[] = []

    // Process fact claims with verification
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

    // Add opinion claims
    for (const claim of opinionClaims) {
      results.push({
        claim: claim.claim,
        type: claim.type as 'opinion' | 'prediction',
        status: 'opinion',
        sources: [],
        explanation: 'This is an opinion or subjective statement, not a verifiable fact.'
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

    // Generate human-readable summary
    const summaryText = generateSummary(results, aiSource)

    res.status(200).json({ claims: results, summary, summaryText })

  } catch (error) {
    console.error('Verification error:', error)
    res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
