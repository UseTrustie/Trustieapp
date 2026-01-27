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
  message?: string
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
  'Grok', 'Llama', 'Mistral', 'Pi', 'Other'
]

const QUICK_CHECKS = [
  "Check if this statistic is accurate",
  "Verify this historical claim",
  "Is this health advice correct?",
  "Fact-check this news claim"
]

export default function Home() {
  const [darkMode, setDarkMode] = useState(true)
  const [activeTab, setActiveTab] = useState('verify')
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
  const [email, setEmail] = useState('')
  const [showEmailPrompt, setShowEmailPrompt] = useState(false)
  const [emailSubmitted, setEmailSubmitted] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)

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
    if (isVerifying) {
      setElapsedTime(0)
      interval = setInterval(() => setElapsedTime(t => t + 1), 1000)
    }
    return () => clearInterval(interval)
  }, [isVerifying])

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
    setCurrentStep('Analyzing your text...')

    try {
      setTimeout(() => setCurrentStep('Extracting claims...'), 2000)
      setTimeout(() => setCurrentStep('Searching sources...'), 5000)
      setTimeout(() => setCurrentStep('Evaluating evidence...'), 10000)

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
      
      // Show email prompt after 3rd use
      const useCount = parseInt(localStorage.getItem('useCount') || '0') + 1
      localStorage.setItem('useCount', String(useCount))
      if (useCount >= 3 && !emailSubmitted && !localStorage.getItem('emailSubmitted')) {
        setTimeout(() => setShowEmailPrompt(true), 2000)
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setIsVerifying(false)
      setCurrentStep('')
    }
  }

  const handleEmailSubmit = () => {
    if (email.trim()) {
      console.log('Email captured:', email)
      localStorage.setItem('emailSubmitted', 'true')
      setEmailSubmitted(true)
      setShowEmailPrompt(false)
    }
  }

  const handleFeedbackSubmit = () => {
    if (feedback.trim()) {
      console.log('Feedback:', feedback)
      setFeedbackSubmitted(true)
      setFeedback('')
      setTimeout(() => setFeedbackSubmitted(false), 3000)
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
      case 'supported': return <span className={`${base} text-emerald-300 bg-emerald-900/50`}>Supported</span>
      case 'contradicted': return <span className={`${base} text-red-300 bg-red-900/50`}>Contradicted</span>
      case 'unverified': return <span className={`${base} text-amber-300 bg-amber-900/50`}>Unverified</span>
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
              <p className={`text-sm ${textMuted}`}>AI Fact Checker</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowRankings(!showRankings)}
              className={`text-sm ${textMuted} hover:text-blue-400 transition-colors`}
            >
              AI Rankings
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
            { id: 'verify', label: '🔍 Verify Claims' },
            { id: 'feedback', label: '💬 Feedback' },
            { id: 'about', label: 'ℹ️ About' }
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

        {/* Main Content */}
        {activeTab === 'verify' && (
          <main className="space-y-6">
            
            {/* Intro */}
            <div className={`p-4 ${bgCard} rounded-lg ${borderColor} border`}>
              <p className={textMuted}>
                Paste any AI-generated text and we'll verify the claims against real sources. 
                We'll show you what's supported, contradicted, or just opinion — with links to check yourself.
              </p>
              <p className={`text-xs ${textMuted} mt-2`}>
                ⏱️ Typical verification takes 15-30 seconds depending on the number of claims.
              </p>
            </div>

            {/* Rankings Panel */}
            {showRankings && (
              <div className={`p-5 ${bgCard} ${borderColor} border rounded-lg`}>
                <h2 className="text-sm font-semibold uppercase tracking-wide mb-4 text-blue-400">
                  AI Reliability Rankings
                </h2>
                {rankings.length === 0 ? (
                  <p className={textMuted}>No data yet. Be the first to verify an AI output!</p>
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
                            <span className="text-emerald-400">{ai.supportedRate}% supported</span>
                            <span className="text-red-400">{ai.contradictedRate}% contradicted</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* AI Source Selector */}
            <div>
              <label className={`block text-xs ${textMuted} mb-2 uppercase tracking-widest font-medium`}>
                Which AI generated this?
              </label>
              <div className="flex flex-wrap gap-2">
                {POPULAR_AIS.map((ai) => (
                  <button
                    key={ai}
                    onClick={() => {
                      setAiSource(ai)
                      if (ai !== 'Other') setCustomAiSource('')
                    }}
                    className={`px-3 py-1.5 rounded text-sm transition-all ${
                      aiSource === ai
                        ? 'bg-blue-600 text-white'
                        : `${bgCard} ${borderColor} border ${textMuted} hover:border-blue-500`
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
                  className={`w-full mt-3 p-3 ${bgCard} ${borderColor} border rounded-lg text-sm focus:border-blue-500 focus:outline-none`}
                />
              )}
            </div>

            {/* Quick Check Buttons */}
            <div>
              <label className={`block text-xs ${textMuted} mb-2 uppercase tracking-widest font-medium`}>
                Quick prompts
              </label>
              <div className="flex flex-wrap gap-2">
                {QUICK_CHECKS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setAiOutput(prompt + ": ")}
                    className={`px-3 py-1.5 rounded text-xs ${bgCard} ${borderColor} border ${textMuted} hover:border-blue-500 hover:text-blue-400 transition-all`}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            {/* Text Input */}
            <div>
              <label className={`block text-xs ${textMuted} mb-2 uppercase tracking-widest font-medium`}>
                Paste AI output to verify
              </label>
              <textarea
                value={aiOutput}
                onChange={(e) => setAiOutput(e.target.value)}
                placeholder="Paste the AI response you want to fact-check..."
                className={`w-full h-40 p-4 ${bgCard} ${borderColor} border rounded-lg text-sm focus:border-blue-500 focus:outline-none resize-none`}
                disabled={isVerifying}
              />
            </div>

            {/* Submit Button */}
            <button
              onClick={verifyContent}
              disabled={isVerifying || !aiOutput.trim() || !getEffectiveAiSource()}
              className={`w-full py-4 rounded-lg text-sm uppercase tracking-widest font-semibold transition-all ${
                isVerifying || !aiOutput.trim() || !getEffectiveAiSource()
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/25'
              }`}
            >
              {isVerifying ? (
                <span className="flex items-center justify-center gap-3">
                  {/* Fireball Spinner */}
                  <span className="relative w-5 h-5">
                    <span className="absolute inset-0 rounded-full bg-orange-500 animate-ping opacity-75"></span>
                    <span className="relative block w-5 h-5 rounded-full bg-gradient-to-tr from-yellow-400 via-orange-500 to-red-500 animate-spin"></span>
                  </span>
                  {currentStep} ({elapsedTime}s)
                </span>
              ) : (
                'Verify Against Sources'
              )}
            </button>

            {/* Time Estimate */}
            {isVerifying && (
              <div className={`text-center text-sm ${textMuted}`}>
                ⏱️ Usually takes 15-30 seconds • Checking {aiOutput.split('.').length - 1} potential claims
              </div>
            )}

            {/* Error Display */}
            {error && !result && (
              <div className={`p-4 ${bgCard} border border-red-500/50 rounded-lg text-red-400`}>
                <p className="font-medium mb-1">ℹ️ {error}</p>
              </div>
            )}

            {/* Message Display (for opinions, etc) */}
            {result?.message && (
              <div className={`p-4 ${bgCard} border border-blue-500/50 rounded-lg text-blue-300`}>
                <p>{result.message}</p>
              </div>
            )}

            {/* Results Section */}
            {result && result.claims && result.claims.length > 0 && (
              <div className="space-y-6">
                {/* Summary Bar */}
                <div className={`p-5 ${bgCard} ${borderColor} border rounded-lg`}>
                  <div className={`text-xs ${textMuted} uppercase tracking-widest mb-4 font-medium`}>
                    Verification Summary • Completed in {elapsedTime}s
                  </div>
                  <div className="flex flex-wrap gap-6">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold text-2xl">{result.summary.supported}</span>
                      <span className={textMuted}>Supported</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-red-400 font-bold text-2xl">{result.summary.contradicted}</span>
                      <span className={textMuted}>Contradicted</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-amber-400 font-bold text-2xl">{result.summary.unverified}</span>
                      <span className={textMuted}>Unverified</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-blue-400 font-bold text-2xl">{result.summary.opinions}</span>
                      <span className={textMuted}>Opinions</span>
                    </div>
                  </div>
                </div>

                {/* Individual Claims */}
                <div className="space-y-4">
                  <div className={`text-xs ${textMuted} uppercase tracking-widest font-medium`}>
                    Claims Analyzed ({result.claims.length})
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
                          <div className={`text-xs ${textMuted} uppercase tracking-wide`}>Sources</div>
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
                              <p className={`${textMuted} text-xs`}>{source.snippet}</p>
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
          </main>
        )}

        {/* Feedback Tab */}
        {activeTab === 'feedback' && (
          <div className={`p-6 ${bgCard} ${borderColor} border rounded-lg space-y-4`}>
            <h2 className="text-xl font-bold">Share Your Feedback</h2>
            <p className={textMuted}>Help us improve Trustie! Tell us what you think, report bugs, or suggest features.</p>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Your feedback..."
              className={`w-full h-32 p-4 ${darkMode ? 'bg-gray-900' : 'bg-stone-100'} ${borderColor} border rounded-lg text-sm focus:border-blue-500 focus:outline-none resize-none`}
            />
            <button
              onClick={handleFeedbackSubmit}
              disabled={!feedback.trim()}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                feedback.trim() 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              Submit Feedback
            </button>
            {feedbackSubmitted && (
              <p className="text-emerald-400">✓ Thank you for your feedback!</p>
            )}
          </div>
        )}

        {/* About Tab */}
        {activeTab === 'about' && (
          <div className={`p-6 ${bgCard} ${borderColor} border rounded-lg space-y-4`}>
            <h2 className="text-xl font-bold">About Trustie</h2>
            <p className={textMuted}>
              Trustie is an AI fact-checking tool that helps you verify claims made by AI assistants like ChatGPT, Claude, Gemini, and others.
            </p>
            <h3 className="text-lg font-semibold mt-4">How it works:</h3>
            <ol className={`list-decimal list-inside space-y-2 ${textMuted}`}>
              <li>Select which AI generated the text</li>
              <li>Paste the AI output you want to verify</li>
              <li>We analyze and extract factual claims</li>
              <li>Each claim is searched against real sources</li>
              <li>You see what's supported, contradicted, or unverified</li>
            </ol>
            <h3 className="text-lg font-semibold mt-4">Why use Trustie?</h3>
            <p className={textMuted}>
              AI can sound confident even when it's wrong. Trustie gives you real sources so you can verify for yourself — not just another AI opinion.
            </p>
          </div>
        )}

        {/* Email Capture Modal */}
        {showEmailPrompt && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className={`${bgCard} rounded-xl p-6 max-w-md w-full space-y-4`}>
              <h3 className="text-xl font-bold">🎉 You're getting value from Trustie!</h3>
              <p className={textMuted}>
                Get the most out of Trustie — we'll send you:
              </p>
              <ul className={`text-sm ${textMuted} space-y-1`}>
                <li>✓ Weekly AI reliability reports</li>
                <li>✓ Tips for spotting AI misinformation</li>
                <li>✓ Early access to new features</li>
              </ul>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className={`w-full p-3 ${darkMode ? 'bg-gray-900' : 'bg-stone-100'} ${borderColor} border rounded-lg text-sm focus:border-blue-500 focus:outline-none`}
              />
              <div className="flex gap-3">
                <button
                  onClick={handleEmailSubmit}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                >
                  Subscribe
                </button>
                <button
                  onClick={() => setShowEmailPrompt(false)}
                  className={`flex-1 py-2 ${bgCard} ${borderColor} border rounded-lg font-medium ${textMuted}`}
                >
                  Maybe later
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className={`mt-12 pt-6 border-t ${borderColor} text-center`}>
          <p className={`text-sm ${textMuted}`}>
            Trustie — Verify AI claims against real sources
          </p>
          <p className={`text-xs ${textMuted} mt-1`}>
            Built with transparency in mind • Not affiliated with any AI company
          </p>
        </footer>
      </div>
    </div>
  )
}
