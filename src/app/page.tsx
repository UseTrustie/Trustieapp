'use client'

import React, { useState, useEffect } from 'react'

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
}

interface AIRanking {
  name: string
  checksCount: number
  supportedRate: number
  contradictedRate: number
  avgScore: number
}

const POPULAR_AIS = [
  'ChatGPT',
  'Claude',
  'Gemini',
  'Perplexity',
  'Copilot',
  'Grok',
  'Llama',
  'Mistral',
  'Pi',
  'Other'
]

export default function Home() {
  const [aiOutput, setAiOutput] = useState('')
  const [aiSource, setAiSource] = useState('')
  const [customAiSource, setCustomAiSource] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState<string>('')
  const [rankings, setRankings] = useState<AIRanking[]>([])
  const [showRankings, setShowRankings] = useState(false)

  useEffect(() => {
    fetchRankings()
  }, [])

  const fetchRankings = async () => {
    try {
      const res = await fetch('/api/rankings')
      if (res.ok) {
        const data = await res.json()
        setRankings(data.rankings || [])
      }
    } catch (err) {
      console.error('Failed to load rankings')
    }
  }

  const getEffectiveAiSource = () => {
    if (aiSource === 'Other' && customAiSource.trim()) {
      return customAiSource.trim()
    }
    return aiSource
  }

  const verifyContent = async () => {
    const effectiveSource = getEffectiveAiSource()
    
    if (!aiOutput.trim()) {
      setError('Please paste some AI output to verify.')
      return
    }

    if (!effectiveSource) {
      setError('Please select which AI generated this output.')
      return
    }

    setIsVerifying(true)
    setError(null)
    setResult(null)
    setCurrentStep('Extracting claims...')

    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content: aiOutput,
          aiSource: effectiveSource
        })
      })

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.error || 'Verification failed')
      }
      
      setCurrentStep('Searching sources...')
      const data = await response.json()
      setResult(data)
      
      fetchRankings()
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please try again.')
    } finally {
      setIsVerifying(false)
      setCurrentStep('')
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'supported':
        return <span className="text-emerald-600 text-lg">✓</span>
      case 'contradicted':
        return <span className="text-red-600 text-lg">✗</span>
      case 'unverified':
        return <span className="text-amber-600 text-lg">?</span>
      case 'opinion':
        return <span className="text-stone-400 text-lg">○</span>
      default:
        return null
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'supported':
        return <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide">Supported</span>
      case 'contradicted':
        return <span className="text-red-700 bg-red-50 px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide">Contradicted</span>
      case 'unverified':
        return <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide">Unverified</span>
      case 'opinion':
        return <span className="text-stone-500 bg-stone-100 px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide">Opinion</span>
      default:
        return null
    }
  }

  const getStatusBorder = (status: string) => {
    switch (status) {
      case 'supported':
        return 'border-l-emerald-500'
      case 'contradicted':
        return 'border-l-red-500'
      case 'unverified':
        return 'border-l-amber-500'
      case 'opinion':
        return 'border-l-stone-300'
      default:
        return 'border-l-stone-200'
    }
  }

  return (
    <div className="min-h-screen">
      <div className="relative max-w-3xl mx-auto px-5 py-10 md:py-16">
        <header className="mb-10 md:mb-14">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-stone-900 rounded-lg flex items-center justify-center shadow-sm">
                <svg className="w-6 h-6 text-stone-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Trust Check</h1>
            </div>
            <button
              onClick={() => setShowRankings(!showRankings)}
              className="text-sm text-stone-500 hover:text-stone-900 transition-colors flex items-center gap-1.5"
            >
              AI Rankings
            </button>
          </div>
          <p className="text-stone-600 text-lg md:text-xl leading-relaxed max-w-xl">
            Verify AI claims against real sources. Not AI opinion — actual links you can check yourself.
          </p>
        </header>

        <main className="space-y-6">
          {showRankings && (
            <div className="p-5 bg-white border border-stone-200 rounded-lg shadow-sm">
              <h2 className="text-sm font-semibold text-stone-900 uppercase tracking-wide mb-4">AI Reliability Rankings</h2>
              {rankings.length === 0 ? (
                <p className="text-stone-500 text-sm">No data yet. Be the first to verify an AI output!</p>
              ) : (
                <div className="space-y-3">
                  {rankings.slice(0, 10).map((ai, index) => (
                    <div key={ai.name} className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-stone-100 text-stone-500">{index + 1}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-stone-800">{ai.name}</span>
                          <span className="text-sm text-stone-500">{ai.checksCount} checks</span>
                        </div>
                        <div className="flex gap-3 mt-1 text-xs">
                          <span className="text-emerald-600">{ai.supportedRate}% supported</span>
                          <span className="text-red-600">{ai.contradictedRate}% contradicted</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs text-stone-500 mb-2.5 uppercase tracking-widest font-medium">Which AI generated this?</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {POPULAR_AIS.map((ai) => (
                <button
                  key={ai}
                  onClick={() => {
                    setAiSource(ai)
                    if (ai !== 'Other') setCustomAiSource('')
                  }}
                  className={`px-3 py-1.5 rounded text-sm transition-all ${
                    aiSource === ai ? 'bg-stone-900 text-stone-50' : 'bg-white border border-stone-200 text-stone-600 hover:border-stone-400'
                  }`}
                >
                  {ai}
                </button>
              ))}
            </div>
            {aiSource === 'Other' && (
              <input
                type="text"
                value={customAiSource}
                onChange={(e) => setCustomAiSource(e.target.value)}
                placeholder="Enter AI name"
                className="w-full p-3 bg-white border border-stone-200 rounded-lg text-sm"
              />
            )}
          </div>

          <div>
            <label className="block text-xs text-stone-500 mb-2.5 uppercase tracking-widest font-medium">Paste AI output to verify</label>
            <textarea
              value={aiOutput}
              onChange={(e) => setAiOutput(e.target.value)}
              placeholder="Paste the AI response you want to fact-check..."
              className="w-full h-48 p-4 bg-white border border-stone-200 rounded-lg text-sm"
              disabled={isVerifying}
            />
          </div>

          <button
            onClick={verifyContent}
            disabled={isVerifying || !aiOutput.trim() || !getEffectiveAiSource()}
            className={`w-full py-4 rounded-lg text-sm uppercase tracking-widest font-semibold transition-all ${
              isVerifying || !aiOutput.trim() || !getEffectiveAiSource()
                ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                : 'bg-stone-900 text-stone-50 hover:bg-stone-800'
            }`}
          >
            {isVerifying ? currentStep || 'Verifying...' : 'Verify Against Sources'}
          </button>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          {result && (
            <div className="mt-10 space-y-6">
              <div className="p-5 bg-white border border-stone-200 rounded-lg shadow-sm">
                <div className="text-xs text-stone-500 uppercase tracking-widest mb-4 font-medium">Verification Summary</div>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-600 font-semibold text-xl">{result.summary.supported}</span>
                    <span className="text-stone-500 text-sm">Supported</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-red-600 font-semibold text-xl">{result.summary.contradicted}</span>
                    <span className="text-stone-500 text-sm">Contradicted</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-amber-600 font-semibold text-xl">{result.summary.unverified}</span>
                    <span className="text-stone-500 text-sm">Unverified</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {result.claims.map((claim, index) => (
                  <div key={index} className={`p-5 bg-white border border-stone-200 border-l-4 ${getStatusBorder(claim.status)} rounded-lg shadow-sm`}>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">{getStatusIcon(claim.status)}</div>
                        <p className="text-stone-800 font-medium">"{claim.claim}"</p>
                      </div>
                      {getStatusLabel(claim.status)}
                    </div>
                    <p className="text-stone-600 text-sm mb-4 ml-7">{claim.explanation}</p>
                    {claim.sources && claim.sources.length > 0 && (
                      <div className="ml-7 space-y-2">
                        <div className="text-xs text-stone-400 uppercase tracking-wide">Sources</div>
                        {claim.sources.map((source, srcIndex) => (
                          <div key={srcIndex} className="p-3 bg-stone-50 rounded border border-stone-100">
                            <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm font-medium block mb-1">{source.title}</a>
                            <p className="text-stone-600 text-xs">{source.snippet}</p>
                            <span className="text-stone-400 text-xs">{source.domain}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>

        <footer className="mt-20 pt-8 border-t border-stone-200">
          <p className="text-sm text-stone-400">Trust Check — Verify, don't assume.</p>
        </footer>
      </div>
    </div>
  )
}
