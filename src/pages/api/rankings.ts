import type { NextApiRequest, NextApiResponse } from 'next'

let rankings: Record<string, {
  name: string
  checksCount: number
  verified: number
  false: number
  unconfirmed: number
  opinions: number
}> = {}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const list = Object.values(rankings)
      .filter((ai) => ai.checksCount > 0)
      .map((ai) => {
        const factualClaims = ai.verified + ai.false + ai.unconfirmed
        const verifiedRate = factualClaims > 0 ? Math.round((ai.verified / factualClaims) * 100) : 0
        const falseRate = factualClaims > 0 ? Math.round((ai.false / factualClaims) * 100) : 0
        const avgScore = verifiedRate - (falseRate * 2)
        
        return {
          name: ai.name,
          checksCount: ai.checksCount,
          verifiedRate,
          falseRate,
          avgScore
        }
      })
      .sort((a, b) => b.avgScore - a.avgScore)

    return res.status(200).json({ rankings: list })
  }

  if (req.method === 'POST') {
    const { aiSource, verified, false: falseCount, unconfirmed, opinions } = req.body
    
    if (!aiSource) {
      return res.status(400).json({ error: 'AI source required' })
    }

    if (!rankings[aiSource]) {
      rankings[aiSource] = {
        name: aiSource,
        checksCount: 0,
        verified: 0,
        false: 0,
        unconfirmed: 0,
        opinions: 0
      }
    }

    rankings[aiSource].checksCount += 1
    rankings[aiSource].verified += verified || 0
    rankings[aiSource].false += falseCount || 0
    rankings[aiSource].unconfirmed += unconfirmed || 0
    rankings[aiSource].opinions += opinions || 0

    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
