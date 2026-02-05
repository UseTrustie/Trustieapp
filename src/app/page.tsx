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
  'Grok', 'DeepSeek', 'Kimi', 'Llama', 'Mistral', 'Other'
]

// Fun facts to show while loading (Madelynn's request)
const LOADING_FACTS = [
  "Did you know? AI models can confidently make up facts 15-20% of the time.",
  "Fun fact: The term 'hallucination' describes when AI confidently invents information.",
  "Did you know? Even the best AI models struggle with recent events and specific numbers.",
  "Fun fact: AI models are trained on text patterns, not truth verification.",
  "Did you know? Trustie searches Wikipedia, news sites, and official sources for you.",
  "Fun fact: AI chatbots optimize for sounding helpful, not for being accurate.",
  "Did you know? Most AI mistakes happen with dates, statistics, and recent events.",
  "Fun fact: Trustie was built because every AI admits they can be wrong.",
]

export default function Home() {
  // Theme state
  const [darkMode, setDarkMode] = useState(true)
  
  // Navigation state
  const [activeTab, setActiveTab] = useState('ask')
  const [showSettings, setShowSettings] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [settingsTab, setSettingsTab] = useState('general')
  
  // Ask Trustie state
  const [question, setQuestion] = useState('')
  const [isAsking, setIsAsking] = useState(false)
  const [askResult, setAskResult] = useState<AskResult | null>(null)
  const [askError, setAskError] = useState<string | null>(null)
  
  // Verify state
  const [aiOutput, setAiOutput] = useState('')
  const [aiSource, setAiSource] = useState('')
  const [customAiSource, setCustomAiSource] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // UI state
  const [currentStep, setCurrentStep] = useState('')
  const [elapsedTime, setElapsedTime] = useState(0)
  const [loadingFact, setLoadingFact] = useState('')
  const [copied, setCopied] = useState(false)
  
  // Rankings state
  const [rankings, setRankings] = useState<AIRanking[]>([])
  const [showRankings, setShowRankings] = useState(false)
  
  // Feedback state
  const [feedback, setFeedback] = useState('')
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)
  
  // Settings state
  const [userName, setUserName] = useState('')
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [dataCollectionEnabled, setDataCollectionEnabled] = useState(false)

  useEffect(() => {
    fetchRankings()
    const savedMode = localStorage.getItem('darkMode')
    if (savedMode !== null) setDarkMode(savedMode === 'true')
    const savedName = localStorage.getItem('userName')
    if (savedName) setUserName(savedName)
  }, [])

  useEffect(() => {
    localStorage.setItem('darkMode', String(darkMode))
  }, [darkMode])

  // Loading fact rotation
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isVerifying || isAsking) {
      setElapsedTime(0)
      setLoadingFact(LOADING_FACTS[Math.floor(Math.random() * LOADING_FACTS.length)])
      interval = setInterval(() => {
        setElapsedTime(t => t + 1)
        if (Math.random() > 0.8) {
          setLoadingFact(LOADING_FACTS[Math.floor(Math.random() * LOADING_FACTS.length)])
        }
      }, 1000)
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

  // Copy results to clipboard
  const copyResults = () => {
    if (!result) return
    
    let text = result.summaryText ? result.summaryText + '\n\n' : ''
    text += `Results: ${result.summary.supported} verified, ${result.summary.contradicted} false, ${result.summary.unverified} unconfirmed\n\n`
    
    result.claims.forEach((claim, i) => {
      const statusText = claim.status === 'supported' ? '✓ VERIFIED' : 
                         claim.status === 'contradicted' ? '✗ FALSE' : 
                         claim.status === 'unverified' ? '? UNCONFIRMED' : '○ OPINION'
      text += `${i + 1}. "${claim.claim}"\n   ${statusText}: ${claim.explanation}\n\n`
    })
    
    text += '\n— Verified with Trustie (trustieapp-red.vercel.app)'
    
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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

  const handleFeedbackSubmit = () => {
    if (feedback.trim()) {
      console.log('Feedback:', feedback)
      setFeedbackSubmitted(true)
      setFeedback('')
      setTimeout(() => setFeedbackSubmitted(false), 3000)
    }
  }

  const handleSaveSettings = () => {
    localStorage.setItem('userName', userName)
    setShowSettings(false)
  }

  const openAuthModal = (mode: 'signin' | 'signup') => {
    setAuthMode(mode)
    setShowAuthModal(true)
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

  // Updated labels per Madelynn - bolder, more professional
  const getStatusLabel = (status: string) => {
    const base = "px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide"
    switch (status) {
      case 'supported': return <span className={`${base} text-emerald-300 bg-emerald-900/50`}>Verified Truth ✓</span>
      case 'contradicted': return <span className={`${base} text-red-300 bg-red-900/50`}>Proven False ✗</span>
      case 'unverified': return <span className={`${base} text-amber-300 bg-amber-900/50`}>Unconfirmed</span>
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
          
          {/* Header Right - Rankings, Settings, Auth, Theme */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowRankings(!showRankings)}
              className={`text-sm ${textMuted} hover:text-blue-400 transition-colors flex items-center gap-1`}
            >
              🏆 Rankings
            </button>
            
            {/* Settings Button */}
            <button
              onClick={() => setShowSettings(true)}
              className={`p-2 rounded-lg ${bgCard} ${borderColor} border hover:border-blue-500 transition-colors`}
              title="Settings"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            
            {/* Sign In / Sign Up Buttons */}
            <button
              onClick={() => openAuthModal('signin')}
              className={`px-3 py-1.5 text-sm ${textMuted} hover:text-blue-400 transition-colors`}
            >
              Sign in
            </button>
            <button
              onClick={() => openAuthModal('signup')}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Sign up
            </button>
            
            {/* Theme Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-lg ${bgCard} ${borderColor} border`}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </header>

        {/* Tabs */}
        <div className={`flex gap-1 mb-6 p-1 ${bgCard} rounded-lg ${borderColor} border`}>
          {[
            { id: 'ask', label: '💬 Ask Trustie' },
            { id: 'verify', label: '🔍 Check AI Output' },
            { id: 'feedback', label: '💡 Feedback' },
            { id: 'help', label: '❓ How It Works' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
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
            <h2 className="text-sm font-semibold uppercase tracking-wide mb-2 text-blue-400">
              🏆 AI Truth Rankings
            </h2>
            <p className={`text-xs ${textMuted} mb-4`}>See which AI scores highest based on verifications!</p>
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
                        <span className="text-emerald-400">{ai.supportedRate}% verified</span>
                        <span className="text-red-400">{ai.contradictedRate}% false</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ASK TAB */}
        {activeTab === 'ask' && (
          <main className="space-y-6">
            <div className={`p-4 ${bgCard} rounded-lg ${borderColor} border`}>
              <p className={`text-lg ${textMain}`}>🎯 Ask anything. Get answers with proof.</p>
              <p className={`${textMuted} mt-1 text-sm`}>Unlike other AIs, Trustie shows you exactly where the answer comes from.</p>
            </div>

            <div className={`p-4 ${bgCard} rounded-lg ${borderColor} border`}>
              <label className={`block text-sm font-medium mb-3`}>What do you want to know?</label>
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

            {/* Loading fact display */}
            {isAsking && (
              <div className={`text-center text-sm ${textMuted} p-3 ${bgCard} rounded-lg`}>
                💡 {loadingFact}
              </div>
            )}

            {askError && !askResult && (
              <div className={`p-4 ${bgCard} border border-red-500/50 rounded-lg text-red-400`}>
                <p className="font-medium">⚠️ {askError}</p>
              </div>
            )}

            {askResult && (
              <div className="space-y-4">
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
                          {source.snippet && <p className={`${textMuted} text-xs`}>{source.snippet}</p>}
                          <span className={`${textMuted} text-xs`}>{source.domain}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Disclaimer - Madelynn's wording */}
            <p className={`text-xs ${textMuted} text-center`}>
              Note: Trustie searches the web for answers, but we are not perfect. Always double-check important information.
            </p>
          </main>
        )}

        {/* VERIFY TAB */}
        {activeTab === 'verify' && (
          <main className="space-y-6">
            <div className={`p-4 ${bgCard} rounded-lg ${borderColor} border`}>
              <p className={`text-lg ${textMain}`}>🔍 No more blind trusting AI.</p>
              <p className={`${textMuted} mt-1 text-sm`}>Paste what an AI told you. We find the facts.</p>
            </div>

            {/* AI Source */}
            <div className={`p-4 ${bgCard} rounded-lg ${borderColor} border`}>
              <label className={`block text-sm font-medium mb-3`}>Which AI said this?</label>
              <div className="flex flex-wrap gap-2">
                {POPULAR_AIS.map((ai) => (
                  <button
                    key={ai}
                    onClick={() => {
                      setAiSource(ai)
                      if (ai !== 'Other') setCustomAiSource('')
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
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

            {/* Text Input */}
            <div className={`p-4 ${bgCard} rounded-lg ${borderColor} border`}>
              <label className={`block text-sm font-medium mb-3`}>Paste the AI response</label>
              <textarea
                value={aiOutput}
                onChange={(e) => setAiOutput(e.target.value)}
                placeholder="Copy and paste what the AI said here..."
                className={`w-full h-40 p-4 ${darkMode ? 'bg-gray-900' : 'bg-stone-100'} ${borderColor} border rounded-lg text-sm focus:border-blue-500 focus:outline-none resize-none`}
                disabled={isVerifying}
              />
            </div>

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

            {/* Loading fact */}
            {isVerifying && (
              <div className={`text-center text-sm ${textMuted} p-3 ${bgCard} rounded-lg`}>
                💡 {loadingFact}
              </div>
            )}

            {error && !result && (
              <div className={`p-4 ${bgCard} border border-red-500/50 rounded-lg text-red-400`}>
                <p className="font-medium">⚠️ {error}</p>
              </div>
            )}

            {/* Results */}
            {result && result.claims && result.claims.length > 0 && (
              <div className="space-y-6">
                {/* Summary */}
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
                      <span className={textMuted}>Verified Truth</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-red-400 font-bold text-2xl">{result.summary.contradicted}</span>
                      <span className={textMuted}>Proven False</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-amber-400 font-bold text-2xl">{result.summary.unverified}</span>
                      <span className={textMuted}>Unconfirmed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-blue-400 font-bold text-2xl">{result.summary.opinions}</span>
                      <span className={textMuted}>Opinions</span>
                    </div>
                  </div>
                  
                  {/* Copy button */}
                  <button
                    onClick={copyResults}
                    className={`mt-4 px-4 py-2 text-sm rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-stone-200'} ${textMuted} hover:text-blue-400 transition-all`}
                  >
                    {copied ? '✓ Copied!' : '📋 Copy Results'}
                  </button>
                </div>

                {/* Claims */}
                <div className="space-y-4">
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
                              {source.snippet && <p className={`${textMuted} text-xs`}>{source.snippet}</p>}
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

            {/* Disclaimer - Madelynn's exact wording */}
            <p className={`text-xs ${textMuted} text-center`}>
              Trustie is for informational and educational purposes only, not legal, medical, or financial advice.
            </p>
          </main>
        )}

        {/* FEEDBACK TAB */}
        {activeTab === 'feedback' && (
          <div className={`p-6 ${bgCard} ${borderColor} border rounded-lg space-y-4`}>
            <h2 className="text-xl font-bold">💡 Your Feedback Matters</h2>
            <p className={textMuted}>Found a bug? Have an idea? Tell us! We read every message.</p>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Type your feedback here...

• What did you like?
• What did not work?
• What features would you like to see?"
              className={`w-full h-40 p-4 ${darkMode ? 'bg-gray-900' : 'bg-stone-100'} ${borderColor} border rounded-lg text-sm focus:border-blue-500 focus:outline-none resize-none`}
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
              <p className="text-emerald-400">✓ Thank you! We received your feedback.</p>
            )}
          </div>
        )}

        {/* HELP TAB */}
        {activeTab === 'help' && (
          <div className={`p-6 ${bgCard} ${borderColor} border rounded-lg space-y-6`}>
            <h2 className="text-xl font-bold">❓ How Trustie Works</h2>
            
            <div className="space-y-4">
              <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-900' : 'bg-stone-100'}`}>
                <p className="font-medium mb-2">💬 Ask Trustie</p>
                <p className={`text-sm ${textMuted}`}>Ask any question and get an answer WITH sources. We show you exactly where the information comes from, so you can verify it yourself.</p>
              </div>
              
              <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-900' : 'bg-stone-100'}`}>
                <p className="font-medium mb-2">🔍 Check AI Output</p>
                <p className={`text-sm ${textMuted}`}>Paste something from ChatGPT, Claude, Gemini, or any AI and we will check if it is accurate using real sources.</p>
              </div>
              
              <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-900' : 'bg-stone-100'}`}>
                <p className="font-medium mb-2">🏆 AI Truth Rankings</p>
                <p className={`text-sm ${textMuted}`}>See which AIs are most accurate based on all verifications done by Trustie users.</p>
              </div>
            </div>

            <div className="pt-4">
              <h3 className="font-bold mb-2">🤔 Why Trustie?</h3>
              <p className={textMuted}>
                AI sounds confident, even when wrong. Trustie empowers you to verify with real evidence.
              </p>
            </div>
            
            <div className="pt-4">
              <h3 className="font-bold mb-2">📊 How accurate is Trustie?</h3>
              <p className={textMuted}>
                Trustie searches authoritative sources like Wikipedia, news sites, and official websites. We show you the sources so you can verify the information yourself.
              </p>
            </div>
          </div>
        )}

        {/* SETTINGS MODAL */}
        {showSettings && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className={`${bgCard} rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden`}>
              {/* Settings Header */}
              <div className={`flex items-center justify-between p-4 border-b ${borderColor}`}>
                <h2 className="text-xl font-bold">Settings</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className={`p-2 rounded-lg ${textMuted} hover:text-white`}
                >
                  ✕
                </button>
              </div>
              
              <div className="flex h-[60vh]">
                {/* Settings Sidebar */}
                <div className={`w-48 border-r ${borderColor} p-2`}>
                  {[
                    { id: 'general', label: 'General' },
                    { id: 'account', label: 'Account' },
                    { id: 'privacy', label: 'Privacy' },
                    { id: 'about', label: 'About' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setSettingsTab(tab.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                        settingsTab === tab.id 
                          ? 'bg-blue-600 text-white' 
                          : `${textMuted} hover:text-white`
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                
                {/* Settings Content */}
                <div className="flex-1 p-6 overflow-y-auto">
                  {settingsTab === 'general' && (
                    <div className="space-y-6">
                      <div>
                        <h3 className="font-medium mb-4">Profile</h3>
                        <div className="space-y-4">
                          <div>
                            <label className={`block text-sm ${textMuted} mb-2`}>Display Name</label>
                            <input
                              type="text"
                              value={userName}
                              onChange={(e) => setUserName(e.target.value)}
                              placeholder="Enter your name"
                              className={`w-full p-3 ${darkMode ? 'bg-gray-900' : 'bg-stone-100'} ${borderColor} border rounded-lg text-sm focus:border-blue-500 focus:outline-none`}
                            />
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="font-medium mb-4">Appearance</h3>
                        <div className="flex gap-4">
                          <button
                            onClick={() => setDarkMode(false)}
                            className={`flex-1 p-4 rounded-lg border ${!darkMode ? 'border-blue-500 bg-blue-500/10' : borderColor}`}
                          >
                            <div className="text-2xl mb-2">☀️</div>
                            <div className="text-sm">Light</div>
                          </button>
                          <button
                            onClick={() => setDarkMode(true)}
                            className={`flex-1 p-4 rounded-lg border ${darkMode ? 'border-blue-500 bg-blue-500/10' : borderColor}`}
                          >
                            <div className="text-2xl mb-2">🌙</div>
                            <div className="text-sm">Dark</div>
                          </button>
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="font-medium mb-4">Notifications</h3>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm">Response notifications</p>
                            <p className={`text-xs ${textMuted}`}>Get notified when verification is complete</p>
                          </div>
                          <button
                            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                            className={`w-12 h-6 rounded-full transition-colors ${notificationsEnabled ? 'bg-blue-600' : 'bg-gray-600'}`}
                          >
                            <div className={`w-5 h-5 rounded-full bg-white transform transition-transform ${notificationsEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {settingsTab === 'account' && (
                    <div className="space-y-6">
                      <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-900' : 'bg-stone-100'}`}>
                        <h3 className="font-medium mb-2">Account</h3>
                        <p className={`text-sm ${textMuted} mb-4`}>Sign in to save your verification history and sync across devices.</p>
                        <div className="flex gap-3">
                          <button
                            onClick={() => { setShowSettings(false); openAuthModal('signin'); }}
                            className={`px-4 py-2 rounded-lg border ${borderColor} ${textMuted} hover:border-blue-500`}
                          >
                            Sign in
                          </button>
                          <button
                            onClick={() => { setShowSettings(false); openAuthModal('signup'); }}
                            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                          >
                            Create account
                          </button>
                        </div>
                      </div>
                      <p className={`text-xs ${textMuted}`}>Account features coming soon!</p>
                    </div>
                  )}
                  
                  {settingsTab === 'privacy' && (
                    <div className="space-y-6">
                      <div>
                        <h3 className="font-medium mb-4">Privacy Settings</h3>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm">Data collection</p>
                              <p className={`text-xs ${textMuted}`}>Help improve Trustie with anonymous usage data</p>
                            </div>
                            <button
                              onClick={() => setDataCollectionEnabled(!dataCollectionEnabled)}
                              className={`w-12 h-6 rounded-full transition-colors ${dataCollectionEnabled ? 'bg-blue-600' : 'bg-gray-600'}`}
                            >
                              <div className={`w-5 h-5 rounded-full bg-white transform transition-transform ${dataCollectionEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="font-medium mb-4">Data</h3>
                        <button className={`px-4 py-2 rounded-lg border ${borderColor} ${textMuted} hover:border-red-500 hover:text-red-400`}>
                          Clear local data
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {settingsTab === 'about' && (
                    <div className="space-y-6">
                      <div>
                        <h3 className="font-medium mb-2">Trustie</h3>
                        <p className={`text-sm ${textMuted}`}>AI answers you can actually trust</p>
                        <p className={`text-xs ${textMuted} mt-2`}>Version 1.0.0</p>
                      </div>
                      
                      <div className="space-y-2">
                        <a href="#" className={`block text-sm text-blue-400 hover:text-blue-300`}>Privacy Policy</a>
                        <a href="#" className={`block text-sm text-blue-400 hover:text-blue-300`}>Terms of Service</a>
                        <a href="#" className={`block text-sm text-blue-400 hover:text-blue-300`}>Contact Us</a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Settings Footer */}
              <div className={`flex justify-end gap-3 p-4 border-t ${borderColor}`}>
                <button
                  onClick={() => setShowSettings(false)}
                  className={`px-4 py-2 rounded-lg ${textMuted} hover:text-white`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSettings}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AUTH MODAL */}
        {showAuthModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className={`${bgCard} rounded-xl p-6 max-w-md w-full space-y-6`}>
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">
                  {authMode === 'signin' ? 'Log in to your account' : 'Create your account'}
                </h3>
                <button
                  onClick={() => setShowAuthModal(false)}
                  className={`p-2 rounded-lg ${textMuted} hover:text-white`}
                >
                  ✕
                </button>
              </div>
              
              <p className={textMuted}>
                {authMode === 'signin' 
                  ? 'Sign in to save your verification history and sync across devices.'
                  : 'Create an account to save your history and get personalized features.'}
              </p>
              
              <div className="space-y-3">
                <button className={`w-full flex items-center justify-center gap-3 p-3 rounded-lg border ${borderColor} hover:border-blue-500 transition-colors`}>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>
                
                <button className={`w-full flex items-center justify-center gap-3 p-3 rounded-lg border ${borderColor} hover:border-blue-500 transition-colors`}>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                  Continue with Apple
                </button>
                
                <button className={`w-full flex items-center justify-center gap-3 p-3 rounded-lg border ${borderColor} hover:border-blue-500 transition-colors`}>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#F25022" d="M1 1h10v10H1z"/>
                    <path fill="#00A4EF" d="M1 13h10v10H1z"/>
                    <path fill="#7FBA00" d="M13 1h10v10H13z"/>
                    <path fill="#FFB900" d="M13 13h10v10H13z"/>
                  </svg>
                  Continue with Microsoft
                </button>
              </div>
              
              <div className="relative">
                <div className={`absolute inset-0 flex items-center`}>
                  <div className={`w-full border-t ${borderColor}`}></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className={`px-2 ${bgCard} ${textMuted}`}>OR</span>
                </div>
              </div>
              
              <div className="space-y-3">
                <input
                  type="email"
                  placeholder="Email address"
                  className={`w-full p-3 ${darkMode ? 'bg-gray-900' : 'bg-stone-100'} ${borderColor} border rounded-lg text-sm focus:border-blue-500 focus:outline-none`}
                />
                <button className="w-full p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                  Continue
                </button>
              </div>
              
              <p className={`text-center text-sm ${textMuted}`}>
                {authMode === 'signin' ? (
                  <>Do not have an account? <button onClick={() => setAuthMode('signup')} className="text-blue-400 hover:text-blue-300">Sign up</button></>
                ) : (
                  <>Already have an account? <button onClick={() => setAuthMode('signin')} className="text-blue-400 hover:text-blue-300">Sign in</button></>
                )}
              </p>
              
              <p className={`text-xs ${textMuted} text-center`}>
                🚧 Account features coming soon! This is a preview of the login experience.
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className={`mt-12 pt-6 border-t ${borderColor} text-center`}>
          <p className={`text-sm ${textMuted}`}>Trustie — AI answers you can actually trust</p>
          <p className={`text-xs ${textMuted} mt-1`}>For informational purposes only • Not professional advice</p>
        </footer>
      </div>
    </div>
  )
}
