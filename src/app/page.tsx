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
  "Is this true?",
  "Did this really happen?",
  "Are these numbers correct?",
  "Is this real or fake?"
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
              <p className={`text-sm ${textMuted}`}>Check if AI is telling the truth</p>
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
            { id: 'verify', label: '🔍 Check Facts' },
            { id: 'feedback', label: '💬 Feedback' },
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

        {/* Main Content */}
        {activeTab === 'verify' && (
          <main className="space-y-6">
            
            {/* Intro */}
            <div className={`p-4 ${bgCard} rounded-lg ${borderColor} border`}>
              <p className={`text-lg ${textMain}`}>
                🤔 Not sure if ChatGPT or another AI told you the truth?
              </p>
              <p className={`${textMuted} mt-2`}>
                Paste what the AI said below and we'll check if it's true by searching real websites.
              </p>
              <p className={`text-xs ${textMuted} mt-2`}>
                ⏱️ Takes about 20-40 seconds
              </p>
            </div>

            {/* Rankings Panel */}
            {showRankings && (
              <div className={`p-5 ${bgCard} ${borderColor} border rounded-lg`}>
                <h2 className="text-sm font-semibold uppercase tracking-wide mb-4 text-blue-400">
                  🏆 Which AI Lies the Least?
                </h2>
                {rankings.length === 0 ? (
                  <p className={textMuted}>No data yet. Check some AI responses to see rankings!</p>
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

            {/* Step 1: AI Source Selector */}
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
              
              {/* Quick Check Buttons */}
              <div className="flex flex-wrap gap-2 mb-3">
                {QUICK_CHECKS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setAiOutput(prompt + " ")}
                    className={`px-3 py-1.5 rounded-full text-xs ${darkMode ? 'bg-gray-700' : 'bg-stone-100'} ${textMuted} hover:text-blue-400 transition-all`}
                  >
                    {prompt}
                  </button>
                ))}
              </div>

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

            {/* Help text when button is disabled */}
            {(!aiOutput.trim() || !getEffectiveAiSource()) && !isVerifying && (
              <p className={`text-center text-sm ${textMuted}`}>
                {!getEffectiveAiSource() ? '👆 First, pick which AI said this' : '👆 Paste the AI response above'}
              </p>
            )}

            {/* Time Estimate */}
            {isVerifying && (
              <div className={`text-center text-sm ${textMuted}`}>
                ⏱️ Usually takes 20-40 seconds
              </div>
            )}

            {/* Error Display */}
            {error && !result && (
              <div className={`p-4 ${bgCard} border border-red-500/50 rounded-lg text-red-400`}>
                <p className="font-medium">⚠️ {error}</p>
              </div>
            )}

            {/* Message Display */}
            {result?.message && (
              <div className={`p-4 ${bgCard} border border-blue-500/50 rounded-lg text-blue-300`}>
                <p>{result.message}</p>
              </div>
            )}

            {/* Results Section */}
            {result && result.claims && result.claims.length > 0 && (
              <div className="space-y-6">
                <div className={`p-5 ${bgCard} ${borderColor} border rounded-lg`}>
                  <div className={`text-sm font-medium mb-4`}>
                    ✅ Done! Here's what we found ({elapsedTime} seconds)
                  </div>
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
                </div>

                <div className="space-y-4">
                  <div className={`text-sm font-medium`}>
                    📋 We checked {result.claims.length} claims:
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
                          <div className={`text-xs ${textMuted} uppercase tracking-wide`}>🔗 Proof (click to see)</div>
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

            {/* Disclaimer */}
            <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-800/50' : 'bg-stone-100'} text-xs ${textMuted}`}>
              <strong>Note:</strong> Trustie helps you check facts, but we're not perfect. Always double-check important information yourself. This is not legal, medical, or financial advice.
            </div>
          </main>
        )}

        {/* Feedback Tab */}
        {activeTab === 'feedback' && (
          <div className={`p-6 ${bgCard} ${borderColor} border rounded-lg space-y-4`}>
            <h2 className="text-xl font-bold">💬 Tell Us What You Think</h2>
            <p className={textMuted}>Found a bug? Have an idea? We'd love to hear from you!</p>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Type your feedback here..."
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
              Send Feedback
            </button>
            {feedbackSubmitted && (
              <p className="text-emerald-400">✓ Thanks! We got your feedback.</p>
            )}
          </div>
        )}

        {/* About Tab */}
        {activeTab === 'about' && (
          <div className={`p-6 ${bgCard} ${borderColor} border rounded-lg space-y-6`}>
            <h2 className="text-xl font-bold">❓ How Does Trustie Work?</h2>
            
            <div className="space-y-4">
              <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-900' : 'bg-stone-100'}`}>
                <p className="font-medium mb-2">1️⃣ You paste what an AI told you</p>
                <p className={`text-sm ${textMuted}`}>Copy the response from ChatGPT, Claude, or any AI and paste it here.</p>
              </div>
              
              <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-900' : 'bg-stone-100'}`}>
                <p className="font-medium mb-2">2️⃣ We find the facts</p>
                <p className={`text-sm ${textMuted}`}>Our system reads the text and picks out things that can be checked (like dates, numbers, events).</p>
              </div>
              
              <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-900' : 'bg-stone-100'}`}>
                <p className="font-medium mb-2">3️⃣ We search real websites</p>
                <p className={`text-sm ${textMuted}`}>We check Wikipedia, news sites, and other trusted sources to see if the facts are true.</p>
              </div>
              
              <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-900' : 'bg-stone-100'}`}>
                <p className="font-medium mb-2">4️⃣ You see the results</p>
                <p className={`text-sm ${textMuted}`}>We show you what's true ✓, what's false ✗, and what we couldn't confirm ?</p>
              </div>
            </div>

            <div className="pt-4">
              <h3 className="font-bold mb-2">🤔 Why use Trustie?</h3>
              <p className={textMuted}>
                AI chatbots sound confident even when they're wrong. They make up facts, dates, and statistics. 
                Trustie helps you check if what they told you is actually true — with real sources you can click and read yourself.
              </p>
            </div>

            <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-900' : 'bg-stone-100'} text-xs ${textMuted}`}>
              <strong>Disclaimer:</strong> Trustie is for informational and educational purposes only. We do not provide legal, medical, financial, or professional advice. Always consult qualified professionals for important decisions. We're not responsible for actions taken based on information from this tool.
            </div>
          </div>
        )}

        {/* Email Capture Modal */}
        {showEmailPrompt && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className={`${bgCard} rounded-xl p-6 max-w-md w-full space-y-4`}>
              <h3 className="text-xl font-bold">🎉 You're finding Trustie useful!</h3>
              <p className={textMuted}>
                Want to get even more? Join our email list:
              </p>
              <ul className={`text-sm ${textMuted} space-y-1`}>
                <li>✓ Learn which AIs are most accurate</li>
                <li>✓ Tips to spot AI mistakes</li>
                <li>✓ New features before anyone else</li>
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
                  Yes, Sign Me Up
                </button>
                <button
                  onClick={() => setShowEmailPrompt(false)}
                  className={`flex-1 py-2 ${bgCard} ${borderColor} border rounded-lg font-medium ${textMuted}`}
                >
                  No Thanks
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className={`mt-12 pt-6 border-t ${borderColor} text-center`}>
          <p className={`text-sm ${textMuted}`}>
            Trustie — Check if AI is telling the truth
          </p>
          <p className={`text-xs ${textMuted} mt-1`}>
            For informational purposes only • Not professional advice
          </p>
        </footer>
      </div>
    </div>
  )
}
