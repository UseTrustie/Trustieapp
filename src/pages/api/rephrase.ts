import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { text } = req.body
  
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'No text provided' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' })
  }

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
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Rewrite this text in different words while keeping ALL the same facts. Make it sound natural and original, like a person wrote it fresh. Do NOT change any facts, numbers, dates, or claims - only the wording.

TEXT TO REWRITE:
"${text}"

RULES:
1. Keep ALL facts exactly the same
2. Change the sentence structure and word choices
3. Make it sound natural, not robotic
4. Use professional language (no contractions)
5. Keep approximately the same length

Return ONLY the rewritten text, nothing else.`
        }]
      })
    })

    if (!response.ok) {
      throw new Error('API request failed')
    }

    const data = await response.json()
    
    let rephrased = ''
    if (data.content && Array.isArray(data.content)) {
      for (const block of data.content) {
        if (block && block.type === 'text' && block.text) {
          rephrased += block.text
        }
      }
    }
    
    if (!rephrased) {
      throw new Error('No response generated')
    }

    return res.status(200).json({ rephrased: rephrased.trim() })
  } catch (error: any) {
    console.error('Rephrase error:', error)
    return res.status(500).json({ error: error.message || 'Rephrase failed' })
  }
}
