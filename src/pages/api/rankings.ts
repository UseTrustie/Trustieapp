import type { NextApiRequest, NextApiResponse } from 'next'

let rankings: Record<string, any> = {}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const list = Object.values(rankings)
      .filter((ai: any) => ai.checksCount > 0)
      .map((ai: any) => {
        const factual = ai.supported + ai.contradicted + ai.unverified
        const supportedRate = factual > 0 ? Math.round((ai.supported / factual) * 100) : 0
        const contradictedRate = factual > 0 ? Math.round((ai.contradicted / factual) * 100) : 0
        return {
          name: ai.name,
          checksCount: ai.checksCount,
          supportedRate,
          contradictedRate,
          avgScore: supportedRate - contradictedRate * 2
        }
      })
      .sort((a, b) => b.avgScore - a.avgScore)

    return res.status(200).json({ rankings: list })
  }

  if (req.method === 'POST') {
    const { aiSource, supported, contradicted, unverified, opinions, total } = req.body
    if (!aiSource) return res.status(400).json({ error: 'AI source required' })

    if (!rankings[aiSource]) {
      rankings[aiSource] = {
        name: aiSource,
        checksCount: 0,
        supported: 0,
        contradicted: 0,
        unverified: 0,
        opinions: 0
      }
    }

    rankings[aiSource].checksCount += 1
    rankings[aiSource].supported += supported || 0
    rankings[aiSource].contradicted += contradicted || 0
    rankings[aiSource].unverified += unverified || 0
    rankings[aiSource].opinions += opinions || 0

    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
