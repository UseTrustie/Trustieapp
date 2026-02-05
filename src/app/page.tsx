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
  summaryText?: string
  message?: string
}

interface AskResult {
  answer: string
  sources: SourceResult[]
  confidence: 'high' | 'medium' | 'low'
}

interface AIRanking {
  name: string
  checksCount: number
  supportedRate: number
  contradictedRate: number
  avgScore: number
}

const POPULAR_AIS = [
  'ChatGPT', 'Claude', 'Gemini', 'Perplexity', 'Copilot', 
  'Grok', 'DeepSeek', 'Llama', 'Mistral', 'Other'
]

export default function Home() {
  const [darkMode, setDarkMode] = useState(true)
  const [activeTab, setActiveTab] = useState('ask') // Changed default to 'ask'
  const [aiOutput, setAiOutput] = useState('')
  const [aiSource, setAiSource] = useState('')
  const [customAiSource, setCustomAiSource] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState('')
  const [elapsedTime, setElapsedTime] = useState(0)
  const [rankings, setRankings] = useState<AIRanking[]>([])
  const [showRankings, setShowRankings] = useState(false)
  
  // Ask Trustie state
  const [question, setQuestion] = useState('')
  const [isAsking, setIsAsking] = useState(false)
  const [askResult, setAskResult] = useState<AskResult | null>(null)
  const [askError, setAskError] = useState<string | null>(null)

  useEffect(() => {
    fetchRankings()
    const savedMode = localStorage.getItem('darkMode')
    if (savedMode !== null) setDarkMode(savedMode === 'true')
  }, [])

  useEffect(() => {
    localStorage.setItem('darkMode', String(darkMode))
  }, [darkMode])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isVerifying || isAsking) {
      setElapsedTime(0)
      interval = setInterval(() => setElapsedTime(t => t + 1), 1000)
    }
    return () => clearInterval(interval)
  }, [isVerifying, isAsking])

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
    if (aiSource === 'Other' && customAiSource.trim()) return customAiSource.trim()
    return aiSource
  }

  // ASK TRUSTIE FUNCTION
  const askTrustie = async () => {
    if (!question.trim()) {
      setAskError('Please type a question.')
      return
    }

    setIsAsking(true)
    setAskError(null)
    setAskResult(null)
    setCurrentStep('Searching for answers...')

    try {
      setTimeout(() => setCurrentStep('Finding sources...'), 3000)
      setTimeout(() => setCurrentStep('Verifying information...'), 7000)

      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim() })
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get answer')
      }
      
      setAskResult(data)
    } catch (err: any) {
      setAskError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setIsAsking(false)
      setCurrentStep('')
    }
  }

  // VERIFY FUNCTION
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
    setCurrentStep('Reading your text...')

    try {
      setTimeout(() => setCurrentStep('Finding claims...'), 2000)
      setTimeout(() => setCurrentStep('Searching the web...'), 5000)
      setTimeout(() => setCurrentStep('Checking sources...'), 10000)

      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: aiOutput, aiSource: effectiveSource })
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Verification failed')
      }
      
      setResult(data)
      if (data.message) setError(data.message)
      fetchRankings()
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setIsVerifying(false)
      setCurrentStep('')
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'supported': return <span className="text-emerald-400 text-lg">✓</span>
      case 'contradicted': return <span className="text-red-400 text-lg">✗</span>
      case 'unverified': return <span className="text-amber-400 text-lg">?</span>
      case 'opinion': return <span className="text-blue-400 text-lg">○</span>
      default: return null
    }
  }

  const getStatusLabel = (status: string) => {
    const base = "px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide"
    switch (status) {
      case 'supported': return <span className={`${base} text-emerald-300 bg-emerald-900/50`}>True</span>
      case 'contradicted': return <span className={`${base} text-red-300 bg-red-900/50`}>False</span>
      case 'unverified': return <span className={`${base} text-amber-300 bg-amber-900/50`}>Can't Confirm</span>
      case 'opinion': return <span className={`${base} text-blue-300 bg-blue-900/50`}>Opinion</span>
      default: return null
    }
  }

  const getStatusBorder = (status: string) => {
    switch (status) {
      case 'supported': return 'border-l-emerald-500'
      case 'contradicted': return 'border-l-red-500'
      case 'unverified': return 'border-l-amber-500'
      case 'opinion': return 'border-l-blue-500'
      default: return 'border-l-gray-600'
    }
  }

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'text-emerald-400'
      case 'medium': return 'text-amber-400'
      case 'low': return 'text-red-400'
      default: return 'text-gray-400'
    }
  }

  const bgMain = darkMode ? 'bg-gray-900' : 'bg-stone-50'
  const bgCard = darkMode ? 'bg-gray-800' : 'bg-white'
  const textMain = darkMode ? 'text-gray-100' : 'text-stone-900'
  const textMuted = darkMode ? 'text-gray-400' : 'text-stone-500'
  const borderColor = darkMode ? 'border-gray-700' : 'border-stone-200'

  return (
    <div className={`min-h-screen ${bgMain} ${textMain} transition-colors duration-300`}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold">Trustie</h1>
              <p className={`text-sm ${textMuted}`}>AI answers you can actually trust</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowRankings(!showRankings)}
              className={`text-sm ${textMuted} hover:text-blue-400 transition-colors`}
            >
              🏆 Rankings
            </button>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-lg ${bgCard} ${borderColor} border`}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </header>

        {/* Tabs */}
        <div className={`flex gap-2 mb-6 p-1 ${bgCard} rounded-lg ${borderColor} border`}>
          {[
            { id: 'ask', label: '💬 Ask Trustie' },
            { id: 'verify', label: '🔍 Check AI Output' },
            { id: 'about', label: '❓ How It Works' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.id 
                  ? 'bg-blue-600 text-white' 
                  : `${textMuted} hover:text-blue-400`
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Rankings Panel */}
        {showRankings && (
          <div className={`p-5 ${bgCard} ${borderColor} border rounded-lg mb-6`}>
            <h2 className="text-sm font-semibold uppercase tracking-wide mb-4 text-blue-400">
              🏆 Which AI Is Most Accurate?
            </h2>
            {rankings.length === 0 ? (
              <p className={textMuted}>No data yet. Verify some AI responses to see rankings!</p>
            ) : (
              <div className="space-y-3">
                {rankings.slice(0, 10).map((ai, index) => (
                  <div key={ai.name} className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                      index === 1 ? 'bg-gray-400/20 text-gray-300' :
                      index === 2 ? 'bg-orange-500/20 text-orange-400' :
                      'bg-gray-700 text-gray-400'
                    }`}>{index + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{ai.name}</span>
                        <span className={`text-sm ${textMuted}`}>{ai.checksCount} checks</span>
                      </div>
                      <div className="flex gap-3 mt-1 text-xs">
                        <span className="text-emerald-400">{ai.supportedRate}% true</span>
                        <span className="text-red-400">{ai.contradictedRate}% false</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ASK TRUSTIE TAB */}
        {activeTab === 'ask' && (
          <main className="space-y-6">
            
            {/* Intro */}
            <div className={`p-4 ${bgCard} rounded-lg ${borderColor} border`}>
              <p className={`text-lg ${textMain}`}>
                🎯 Ask anything. Get answers with proof.
              </p>
              <p className={`${textMuted} mt-2`}>
                Unlike other AIs, Trustie shows you exactly where the answer comes from.
              </p>
            </div>

            {/* Question Input */}
            <div className={`p-4 ${bgCard} rounded-lg ${borderColor} border`}>
              <label className={`block text-sm font-medium mb-3`}>
                What do you want to know?
              </label>
              
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Type your question here...

Examples:
• Is it safe to eat eggs every day?
• When was the Eiffel Tower built?
• How many moons does Jupiter have?"
                className={`w-full h-32 p-4 ${darkMode ? 'bg-gray-900' : 'bg-stone-100'} ${borderColor} border rounded-lg text-sm focus:border-blue-500 focus:outline-none resize-none`}
                disabled={isAsking}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && question.trim()) {
                    e.preventDefault()
                    askTrustie()
                  }
                }}
              />
            </div>

            {/* Submit Button */}
            <button
              onClick={askTrustie}
              disabled={isAsking || !question.trim()}
              className={`w-full py-4 rounded-lg text-lg font-semibold transition-all ${
                isAsking || !question.trim()
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/25'
              }`}
            >
              {isAsking ? (
                <span className="flex items-center justify-center gap-3">
                  <span className="relative w-6 h-6">
                    <span className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-75"></span>
                    <span className="relative block w-6 h-6 rounded-full bg-gradient-to-tr from-blue-400 via-blue-500 to-blue-600 animate-spin"></span>
                  </span>
                  {currentStep} ({elapsedTime}s)
                </span>
              ) : (
                '🔍 Get Answer with Sources'
              )}
            </button>

            {/* Error Display */}
            {askError && !askResult && (
              <div className={`p-4 ${bgCard} border border-red-500/50 rounded-lg text-red-400`}>
                <p className="font-medium">⚠️ {askError}</p>
              </div>
            )}

            {/* Ask Result */}
            {askResult && (
              <div className="space-y-4">
                {/* Answer Card */}
                <div className={`p-5 ${bgCard} ${borderColor} border rounded-lg`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-blue-400">💡</span>
                    <span className="font-medium">Answer</span>
                    <span className={`ml-auto text-xs ${getConfidenceColor(askResult.confidence)}`}>
                      {askResult.confidence === 'high' && '✓ High confidence'}
                      {askResult.confidence === 'medium' && '~ Medium confidence'}
                      {askResult.confidence === 'low' && '? Low confidence'}
                    </span>
                  </div>
                  <p className={`${textMain} leading-relaxed`}>{askResult.answer}</p>
                </div>

                {/* Sources */}
                {askResult.sources && askResult.sources.length > 0 && (
                  <div className={`p-5 ${bgCard} ${borderColor} border rounded-lg`}>
                    <div className={`text-xs ${textMuted} uppercase tracking-wide mb-3`}>
                      🔗 Sources ({askResult.sources.length})
                    </div>
                    <div className="space-y-2">
                      {askResult.sources.map((source, index) => (
                        <div key={index} className={`p-3 rounded ${darkMode ? 'bg-gray-900' : 'bg-stone-100'}`}>
                          <a 
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 text-sm font-medium block mb-1"
                          >
                            {source.title} ↗
                          </a>
                          {source.snippet && (
                            <p className={`${textMuted} text-xs`}>{source.snippet}</p>
                          )}
                          <span className={`${textMuted} text-xs`}>{source.domain}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No Sources Warning */}
                {(!askResult.sources || askResult.sources.length === 0) && (
                  <div className={`p-4 ${bgCard} border border-amber-500/50 rounded-lg text-amber-300`}>
                    <p className="text-sm">⚠️ We couldn't find specific sources for this answer. Please verify independently.</p>
                  </div>
                )}
              </div>
            )}

            {/* Disclaimer */}
            <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-800/50' : 'bg-stone-100'} text-xs ${textMuted}`}>
              <strong>Note:</strong> Trustie searches the web for answers, but we're not perfect. Always double-check important information.
            </div>
          </main>
        )}

        {/* VERIFY TAB */}
        {activeTab === 'verify' && (
          <main className="space-y-6">
            
            {/* Intro */}
            <div className={`p-4 ${bgCard} rounded-lg ${borderColor} border`}>
              <p className={`text-lg ${textMain}`}>
                🤔 Not sure if an AI told you the truth?
              </p>
              <p className={`${textMuted} mt-2`}>
                Paste what the AI said and we'll check if it's accurate.
              </p>
            </div>

            {/* Step 1: AI Source */}
            <div className={`p-4 ${bgCard} rounded-lg ${borderColor} border`}>
              <label className={`block text-sm font-medium mb-3`}>
                Step 1: Which AI said this?
              </label>
              <div className="flex flex-wrap gap-2">
                {POPULAR_AIS.map((ai) => (
                  <button
                    key={ai}
                    onClick={() => {
                      setAiSource(ai)
                      if (ai !== 'Other') setCustomAiSource('')
                    }}
                    className={`px-4 py-2 rounded-lg text-sm transition-all ${
                      aiSource === ai
                        ? 'bg-blue-600 text-white'
                        : `${darkMode ? 'bg-gray-700' : 'bg-stone-100'} ${textMuted} hover:border-blue-500 border ${borderColor}`
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
                  placeholder="Type the AI name..."
                  className={`w-full mt-3 p-3 ${bgCard} ${borderColor} border rounded-lg text-sm focus:border-blue-500 focus:outline-none`}
                />
              )}
            </div>

            {/* Step 2: Text Input */}
            <div className={`p-4 ${bgCard} rounded-lg ${borderColor} border`}>
              <label className={`block text-sm font-medium mb-3`}>
                Step 2: Paste what the AI told you
              </label>

              <textarea
                value={aiOutput}
                onChange={(e) => setAiOutput(e.target.value)}
                placeholder="Copy and paste what the AI said here...

Example: 'The Great Wall of China is visible from space. It was built in 200 BC and is 13,000 miles long.'"
                className={`w-full h-40 p-4 ${darkMode ? 'bg-gray-900' : 'bg-stone-100'} ${borderColor} border rounded-lg text-sm focus:border-blue-500 focus:outline-none resize-none`}
                disabled={isVerifying}
              />
            </div>

            {/* Submit Button */}
            <button
              onClick={verifyContent}
              disabled={isVerifying || !aiOutput.trim() || !getEffectiveAiSource()}
              className={`w-full py-4 rounded-lg text-lg font-semibold transition-all ${
                isVerifying || !aiOutput.trim() || !getEffectiveAiSource()
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/25'
              }`}
            >
              {isVerifying ? (
                <span className="flex items-center justify-center gap-3">
                  <span className="relative w-6 h-6">
                    <span className="absolute inset-0 rounded-full bg-orange-500 animate-ping opacity-75"></span>
                    <span className="relative block w-6 h-6 rounded-full bg-gradient-to-tr from-yellow-400 via-orange-500 to-red-500 animate-spin"></span>
                  </span>
                  {currentStep} ({elapsedTime}s)
                </span>
              ) : (
                '🔍 Check If This Is True'
              )}
            </button>

            {/* Help text */}
            {(!aiOutput.trim() || !getEffectiveAiSource()) && !isVerifying && (
              <p className={`text-center text-sm ${textMuted}`}>
                {!getEffectiveAiSource() ? '👆 First, pick which AI said this' : '👆 Paste the AI response above'}
              </p>
            )}

            {/* Error Display */}
            {error && !result && (
              <div className={`p-4 ${bgCard} border border-red-500/50 rounded-lg text-red-400`}>
                <p className="font-medium">⚠️ {error}</p>
              </div>
            )}

            {/* Results Section */}
            {result && result.claims && result.claims.length > 0 && (
              <div className="space-y-6">
                
                {/* SUMMARY AT TOP - This is the key improvement */}
                <div className={`p-5 ${bgCard} ${borderColor} border rounded-lg`}>
                  {result.summaryText && (
                    <p className={`text-lg font-medium mb-4 ${
                      result.summary.contradicted > 0 ? 'text-red-400' : 
                      result.summary.supported > 0 ? 'text-emerald-400' : 
                      'text-amber-400'
                    }`}>
                      {result.summaryText}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-6">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold text-2xl">{result.summary.supported}</span>
                      <span className={textMuted}>True</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-red-400 font-bold text-2xl">{result.summary.contradicted}</span>
                      <span className={textMuted}>False</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-amber-400 font-bold text-2xl">{result.summary.unverified}</span>
                      <span className={textMuted}>Can't Confirm</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-blue-400 font-bold text-2xl">{result.summary.opinions}</span>
                      <span className={textMuted}>Opinions</span>
                    </div>
                  </div>
                  <p className={`text-xs ${textMuted} mt-3`}>
                    Checked in {elapsedTime} seconds
                  </p>
                </div>

                {/* Individual Claims */}
                <div className="space-y-4">
                  <div className={`text-sm font-medium`}>
                    📋 Details for each claim:
                  </div>
                  
                  {result.claims.map((claim, index) => (
                    <div 
                      key={index}
                      className={`p-5 ${bgCard} ${borderColor} border border-l-4 ${getStatusBorder(claim.status)} rounded-lg`}
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">{getStatusIcon(claim.status)}</div>
                          <p className="font-medium">"{claim.claim}"</p>
                        </div>
                        {getStatusLabel(claim.status)}
                      </div>

                      <p className={`${textMuted} text-sm mb-4 ml-7`}>{claim.explanation}</p>

                      {claim.sources && claim.sources.length > 0 && (
                        <div className="ml-7 space-y-2">
                          <div className={`text-xs ${textMuted} uppercase tracking-wide`}>🔗 Sources</div>
                          {claim.sources.map((source, srcIndex) => (
                            <div key={srcIndex} className={`p-3 rounded ${darkMode ? 'bg-gray-900' : 'bg-stone-100'}`}>
                              <a 
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 text-sm font-medium block mb-1"
                              >
                                {source.title} ↗
                              </a>
                              {source.snippet && (
                                <p className={`${textMuted} text-xs`}>{source.snippet}</p>
                              )}
                              <span className={`${textMuted} text-xs`}>{source.domain}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Disclaimer */}
            <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-800/50' : 'bg-stone-100'} text-xs ${textMuted}`}>
              <strong>Note:</strong> Trustie helps you check facts, but we're not perfect. Always double-check important information yourself.
            </div>
          </main>
        )}

        {/* ABOUT TAB */}
        {activeTab === 'about' && (
          <div className={`p-6 ${bgCard} ${borderColor} border rounded-lg space-y-6`}>
            <h2 className="text-xl font-bold">❓ How Does Trustie Work?</h2>
            
            <div className="space-y-4">
              <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-900' : 'bg-stone-100'}`}>
                <p className="font-medium mb-2">💬 Ask Trustie</p>
                <p className={`text-sm ${textMuted}`}>Ask any question and get an answer WITH sources. Unlike other AIs that make things up, Trustie shows you exactly where the information comes from.</p>
              </div>
              
              <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-900' : 'bg-stone-100'}`}>
                <p className="font-medium mb-2">🔍 Check AI Output</p>
                <p className={`text-sm ${textMuted}`}>Paste something ChatGPT, Claude, or another AI told you, and we'll verify if it's true by checking real websites.</p>
              </div>
              
              <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-900' : 'bg-stone-100'}`}>
                <p className="font-medium mb-2">🏆 AI Rankings</p>
                <p className={`text-sm ${textMuted}`}>See which AIs are most accurate based on all the checks people have done with Trustie.</p>
              </div>
            </div>

            <div className="pt-4">
              <h3 className="font-bold mb-2">🤔 Why use Trustie?</h3>
              <p className={textMuted}>
                AI chatbots sound confident even when they're wrong. They make up facts, dates, and statistics. 
                Trustie helps you get accurate information with real sources you can click and verify yourself.
              </p>
            </div>

            <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-900' : 'bg-stone-100'} text-xs ${textMuted}`}>
              <strong>Disclaimer:</strong> Trustie is for informational purposes only. We do not provide legal, medical, financial, or professional advice. Always consult qualified professionals for important decisions.
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className={`mt-12 pt-6 border-t ${borderColor} text-center`}>
          <p className={`text-sm ${textMuted}`}>
            Trustie — AI answers you can actually trust
          </p>
          <p className={`text-xs ${textMuted} mt-1`}>
            For informational purposes only • Not professional advice
          </p>
        </footer>
      </div>
    </div>
  )
}
