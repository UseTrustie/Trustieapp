'use client'

import React, { useState, useEffect, useCallback } from 'react'

// ============================================
// TYPES
// ============================================
interface SourceResult {
  url: string
  title: string
  snippet: string
  domain: string
  quality?: 'high' | 'medium' | 'low'
}

interface ClaimResult {
  claim: string
  type: 'fact' | 'opinion' | 'prediction'
  status: 'verified' | 'false' | 'unconfirmed' | 'opinion'
  sources: SourceResult[]
  explanation: string
  sourceAgreement?: number
}

interface VerificationResult {
  claims: ClaimResult[]
  summary: {
    total: number
    verified: number
    false: number
    unconfirmed: number
    opinions: number
  }
  message?: string
  timeTaken?: number
}

interface SearchResult {
  query: string
  answer: string
  trustScore: number
  sources: SourceResult[]
  sourceAgreement: number
  warnings: string[]
}

interface AIRanking {
  name: string
  checksCount: number
  verifiedRate: number
  falseRate: number
  avgScore: number
}

// ============================================
// CONSTANTS
// ============================================
const POPULAR_AIS = [
  'ChatGPT', 'Claude', 'Gemini', 'Perplexity', 'Copilot', 
  'Grok', 'Llama', 'Mistral', 'DeepSeek', 'Kimi', 'Pi', 'Other'
]

const LOADING_FACTS = [
  "Did you know? AI models can hallucinate up to 20% of facts they generate.",
  "Fun fact: The first AI program was written in 1951 by Christopher Strachey.",
  "Did you know? ChatGPT was trained on over 570GB of text data.",
  "Interesting: AI cannot actually 'think' - it predicts the most likely next word.",
  "Did you know? Google processes over 8.5 billion searches per day.",
  "Fun fact: The term 'artificial intelligence' was coined in 1956.",
  "Did you know? AI models have no way to verify if their answers are correct.",
  "Interesting: Wikipedia has over 60 million articles in 300+ languages.",
  "Did you know? The average person spends 6+ hours online daily.",
  "Fun fact: The first search engine was called Archie, created in 1990.",
  "Did you know? AI can sound confident even when completely wrong.",
  "Interesting: Cross-referencing sources reduces misinformation by 73%.",
  "Did you know? Most AI hallucinations occur with specific dates and statistics.",
  "Fun fact: The human brain has about 86 billion neurons.",
  "Did you know? Fact-checking a claim takes humans an average of 5 minutes.",
  "Interesting: .edu and .gov sources are considered most reliable.",
  "Did you know? AI models do not have access to real-time information by default.",
  "Fun fact: The first website went live on August 6, 1991.",
  "Did you know? Trustie verifies claims against multiple independent sources.",
  "Interesting: Critical thinking skills are declining in the age of AI."
]

// ============================================
// MAIN COMPONENT
// ============================================
export default function Home() {
  // Theme & UI State
  const [darkMode, setDarkMode] = useState(true)
  const [activeTab, setActiveTab] = useState('search')
  const [showRankings, setShowRankings] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [settingsTab, setSettingsTab] = useState('general')
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  
  // Verification State
  const [aiOutput, setAiOutput] = useState('')
  const [aiSource, setAiSource] = useState('')
  const [customAiSource, setCustomAiSource] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState('')
  const [elapsedTime, setElapsedTime] = useState(0)
  const [currentFact, setCurrentFact] = useState('')
  
  // Rankings & Feedback State
  const [rankings, setRankings] = useState<AIRanking[]>([])
  const [feedback, setFeedback] = useState('')
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)
  const [resultFeedback, setResultFeedback] = useState<'helpful' | 'not-helpful' | null>(null)
  
  // Settings State
  const [displayName, setDisplayName] = useState('')
  const [appearanceMode, setAppearanceMode] = useState<'light' | 'dark' | 'auto'>('dark')
  
  // Email Capture
  const [email, setEmail] = useState('')
  const [showEmailPrompt, setShowEmailPrompt] = useState(false)
  const [emailSubmitted, setEmailSubmitted] = useState(false)

  // ============================================
  // EFFECTS
  // ============================================
  useEffect(() => {
    fetchRankings()
    const savedMode = localStorage.getItem('darkMode')
    if (savedMode !== null) setDarkMode(savedMode === 'true')
    const savedName = localStorage.getItem('displayName')
    if (savedName) setDisplayName(savedName)
  }, [])

  useEffect(() => {
    localStorage.setItem('darkMode', String(darkMode))
  }, [darkMode])

  useEffect(() => {
    if (appearanceMode === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setDarkMode(prefersDark)
    } else {
      setDarkMode(appearanceMode === 'dark')
    }
  }, [appearanceMode])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isVerifying || isSearching) {
      setElapsedTime(0)
      setCurrentFact(LOADING_FACTS[Math.floor(Math.random() * LOADING_FACTS.length)])
      interval = setInterval(() => {
        setElapsedTime(t => t + 1)
        if (Math.random() > 0.7) {
          setCurrentFact(LOADING_FACTS[Math.floor(Math.random() * LOADING_FACTS.length)])
        }
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isVerifying, isSearching])

  // ============================================
  // API FUNCTIONS
  // ============================================
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

  // Search Function
  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    
    setIsSearching(true)
    setError(null)
    setSearchResult(null)
    setCurrentStep('Searching trusted sources...')

    try {
      setTimeout(() => setCurrentStep('Cross-referencing sources...'), 3000)
      setTimeout(() => setCurrentStep('Calculating trust score...'), 6000)

      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery })
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Search failed')
      }
      
      setSearchResult(data)
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setIsSearching(false)
      setCurrentStep('')
    }
  }

  // Verify Function
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
    setResultFeedback(null)
    setCurrentStep('Reading your text...')

    try {
      setTimeout(() => setCurrentStep('Extracting claims...'), 2000)
      setTimeout(() => setCurrentStep('Searching trusted sources...'), 5000)
      setTimeout(() => setCurrentStep('Cross-referencing...'), 10000)
      setTimeout(() => setCurrentStep('Calculating trust scores...'), 15000)

      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: aiOutput, aiSource: effectiveSource })
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Verification failed')
      }
      
      setResult({ ...data, timeTaken: elapsedTime })
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

  // ============================================
  // HELPER FUNCTIONS
  // ============================================
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

  const copyResults = () => {
    if (!result) return
    const text = result.claims.map(c => 
      `${c.status.toUpperCase()}: "${c.claim}" - ${c.explanation}`
    ).join('\n\n')
    navigator.clipboard.writeText(text)
  }

  const clearLocalData = () => {
    localStorage.clear()
    setDisplayName('')
    setEmailSubmitted(false)
    alert('All local data has been cleared.')
  }

  const getSourceQuality = (domain: string): 'high' | 'medium' | 'low' => {
    if (domain.endsWith('.edu') || domain.endsWith('.gov') || 
        domain.includes('wikipedia') || domain.includes('pubmed') ||
        domain.includes('nature.com') || domain.includes('sciencedirect')) {
      return 'high'
    }
    if (domain.includes('news') || domain.includes('bbc') || 
        domain.includes('reuters') || domain.includes('apnews')) {
      return 'medium'
    }
    return 'low'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified': return <span className="text-emerald-400 text-lg">✓</span>
      case 'false': return <span className="text-red-400 text-lg">✗</span>
      case 'unconfirmed': return <span className="text-amber-400 text-lg">?</span>
      case 'opinion': return <span className="text-blue-400 text-lg">○</span>
      default: return null
    }
  }

  const getStatusLabel = (status: string) => {
    const base = "px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide"
    switch (status) {
      case 'verified': return <span className={`${base} text-emerald-300 bg-emerald-900/50`}>Verified Truth</span>
      case 'false': return <span className={`${base} text-red-300 bg-red-900/50`}>Proven False</span>
      case 'unconfirmed': return <span className={`${base} text-amber-300 bg-amber-900/50`}>Unconfirmed</span>
      case 'opinion': return <span className={`${base} text-blue-300 bg-blue-900/50`}>Opinion</span>
      default: return null
    }
  }

  const getStatusBorder = (status: string) => {
    switch (status) {
      case 'verified': return 'border-l-emerald-500'
      case 'false': return 'border-l-red-500'
      case 'unconfirmed': return 'border-l-amber-500'
      case 'opinion': return 'border-l-blue-500'
      default: return 'border-l-gray-600'
    }
  }

  const getQualityBadge = (quality: string) => {
    switch (quality) {
      case 'high': return <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-300">High Trust</span>
      case 'medium': return <span className="text-xs px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-300">Medium Trust</span>
      case 'low': return <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">Verify Manually</span>
      default: return null
    }
  }

  // ============================================
  // STYLES
  // ============================================
  const bgMain = darkMode ? 'bg-gray-900' : 'bg-stone-50'
  const bgCard = darkMode ? 'bg-gray-800' : 'bg-white'
  const bgInput = darkMode ? 'bg-gray-900' : 'bg-stone-100'
  const textMain = darkMode ? 'text-gray-100' : 'text-stone-900'
  const textMuted = darkMode ? 'text-gray-400' : 'text-stone-500'
  const borderColor = darkMode ? 'border-gray-700' : 'border-stone-200'

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className={`min-h-screen ${bgMain} ${textMain} transition-colors duration-300`}>
      <div className="max-w-4xl mx-auto px-4 py-6">
        
        {/* ============================================ */}
        {/* HEADER */}
        {/* ============================================ */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold">Trustie</h1>
              <p className={`text-xs ${textMuted}`}>Verify AI Claims with Real Sources in Seconds</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowRankings(!showRankings)}
              className={`text-sm px-3 py-1.5 rounded-lg ${textMuted} hover:text-blue-400 hover:bg-blue-500/10 transition-all`}
            >
              🏆 Rankings
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className={`p-2 rounded-lg ${bgCard} ${borderColor} border hover:border-blue-500/50 transition-all`}
              title="Settings"
            >
              ⚙️
            </button>
            <button
              onClick={() => { setAuthMode('signin'); setShowAuthModal(true) }}
              className={`text-sm px-3 py-1.5 rounded-lg ${textMuted} hover:text-blue-400 transition-all`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setAuthMode('signup'); setShowAuthModal(true) }}
              className="text-sm px-4 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all"
            >
              Sign Up
            </button>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-lg ${bgCard} ${borderColor} border`}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </header>

        {/* ============================================ */}
        {/* TAGLINE */}
        {/* ============================================ */}
        <div className={`text-center mb-6 p-4 ${bgCard} rounded-xl ${borderColor} border`}>
          <p className="text-lg font-medium">No more blind trusting AI.</p>
          <p className={`text-sm ${textMuted} mt-1`}>Paste what an AI told you. We find the facts.</p>
        </div>

        {/* ============================================ */}
        {/* TABS */}
        {/* ============================================ */}
        <div className={`flex gap-1 mb-6 p-1 ${bgCard} rounded-xl ${borderColor} border`}>
          {[
            { id: 'search', label: '🔍 Search', desc: 'Find trusted answers' },
            { id: 'verify', label: '✓ Verify AI', desc: 'Check AI claims' },
            { id: 'ask', label: '💬 Ask Trustie', desc: 'Get verified answers' },
            { id: 'feedback', label: '📝 Feedback', desc: 'Help us improve' },
            { id: 'about', label: 'ℹ️ About', desc: 'How it works' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25' 
                  : `${textMuted} hover:text-blue-400 hover:bg-blue-500/10`
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ============================================ */}
        {/* RANKINGS PANEL */}
        {/* ============================================ */}
        {showRankings && (
          <div className={`mb-6 p-5 ${bgCard} ${borderColor} border rounded-xl`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-blue-400">
                🏆 AI Truth Rankings
              </h2>
              <button onClick={() => setShowRankings(false)} className={textMuted}>✕</button>
            </div>
            <p className={`text-sm ${textMuted} mb-4`}>
              See which AI scores highest based on real user verifications!
            </p>
            {rankings.length === 0 ? (
              <p className={textMuted}>No data yet. Be the first to verify an AI output!</p>
            ) : (
              <div className="space-y-3">
                {rankings.slice(0, 10).map((ai, index) => (
                  <div key={ai.name} className={`flex items-center gap-3 p-3 rounded-lg ${bgInput}`}>
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                      index === 1 ? 'bg-gray-400/20 text-gray-300' :
                      index === 2 ? 'bg-orange-500/20 text-orange-400' :
                      'bg-gray-700 text-gray-400'
                    }`}>#{index + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{ai.name}</span>
                        <span className={`text-sm ${textMuted}`}>{ai.checksCount} checks</span>
                      </div>
                      <div className="flex gap-4 mt-1 text-xs">
                        <span className="text-emerald-400">✓ {ai.verifiedRate}% verified</span>
                        <span className="text-red-400">✗ {ai.falseRate}% false</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================ */}
        {/* SEARCH TAB */}
        {/* ============================================ */}
        {activeTab === 'search' && (
          <main className="space-y-4">
            <div className={`p-5 ${bgCard} ${borderColor} border rounded-xl`}>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Ask anything... We will find trusted sources"
                  className={`flex-1 p-4 ${bgInput} ${borderColor} border rounded-xl focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                />
                <button
                  onClick={handleSearch}
                  disabled={isSearching || !searchQuery.trim()}
                  className={`px-6 rounded-xl font-semibold transition-all ${
                    isSearching || !searchQuery.trim()
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/25'
                  }`}
                >
                  {isSearching ? '...' : '🔍'}
                </button>
              </div>
              
              <div className={`mt-3 flex flex-wrap gap-2 text-xs ${textMuted}`}>
                <span>🔒 Privacy-first: We do not track you</span>
                <span>•</span>
                <span>🌐 Same results for everyone (no filter bubbles)</span>
              </div>
            </div>

            {/* Loading State */}
            {isSearching && (
              <div className={`p-6 ${bgCard} ${borderColor} border rounded-xl text-center`}>
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="font-medium">{currentStep} ({elapsedTime}s)</span>
                </div>
                <p className={`text-sm ${textMuted} italic`}>💡 {currentFact}</p>
              </div>
            )}

            {/* Search Results */}
            {searchResult && (
              <div className={`p-5 ${bgCard} ${borderColor} border rounded-xl space-y-4`}>
                {/* Trust Score */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`text-3xl font-bold ${
                      searchResult.trustScore >= 80 ? 'text-emerald-400' :
                      searchResult.trustScore >= 50 ? 'text-amber-400' : 'text-red-400'
                    }`}>
                      {searchResult.trustScore}%
                    </div>
                    <div>
                      <div className="font-medium">Trust Score</div>
                      <div className={`text-xs ${textMuted}`}>
                        {searchResult.sourceAgreement} sources agree
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(searchResult.answer)}
                    className={`p-2 rounded-lg ${bgInput} hover:bg-blue-500/20 transition-all`}
                    title="Copy answer"
                  >
                    📋
                  </button>
                </div>

                {/* Answer */}
                <div className={`p-4 rounded-lg ${bgInput}`}>
                  <p className="leading-relaxed">{searchResult.answer}</p>
                </div>

                {/* Warnings */}
                {searchResult.warnings && searchResult.warnings.length > 0 && (
                  <div className="p-3 rounded-lg bg-amber-900/20 border border-amber-500/30">
                    <div className="text-amber-400 font-medium text-sm mb-1">⚠️ Please Note:</div>
                    {searchResult.warnings.map((w, i) => (
                      <p key={i} className={`text-sm ${textMuted}`}>• {w}</p>
                    ))}
                  </div>
                )}

                {/* Sources */}
                <div>
                  <div className={`text-xs ${textMuted} uppercase tracking-wide mb-2`}>
                    🔗 Sources ({searchResult.sources.length})
                  </div>
                  <div className="space-y-2">
                    {searchResult.sources.map((source, i) => {
                      const quality = getSourceQuality(source.domain)
                      return (
                        <div key={i} className={`p-3 rounded-lg ${bgInput}`}>
                          <div className="flex items-center justify-between mb-1">
                            <a 
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300 font-medium text-sm"
                            >
                              {source.title} ↗
                            </a>
                            {getQualityBadge(quality)}
                          </div>
                          <p className={`text-xs ${textMuted}`}>{source.snippet}</p>
                          <span className={`text-xs ${textMuted}`}>{source.domain}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* How to Verify */}
                <div className={`p-3 rounded-lg ${bgInput}`}>
                  <div className="text-sm font-medium mb-2">🔍 How to verify yourself:</div>
                  <ol className={`text-xs ${textMuted} space-y-1`}>
                    <li>1. Click the source links above to read the original content</li>
                    <li>2. Look for .edu, .gov, or established news sources</li>
                    <li>3. Check if multiple independent sources agree</li>
                    <li>4. Be skeptical of sources without clear authorship</li>
                  </ol>
                </div>
              </div>
            )}
          </main>
        )}

        {/* ============================================ */}
        {/* VERIFY TAB */}
        {/* ============================================ */}
        {activeTab === 'verify' && (
          <main className="space-y-4">
            {/* AI Source Selector */}
            <div className={`p-4 ${bgCard} ${borderColor} border rounded-xl`}>
              <label className={`block text-sm font-medium mb-3 ${textMuted}`}>
                Which AI told you this?
              </label>
              <div className="flex flex-wrap gap-2">
                {POPULAR_AIS.map(ai => (
                  <button
                    key={ai}
                    onClick={() => setAiSource(ai)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      aiSource === ai
                        ? 'bg-blue-600 text-white'
                        : `${bgInput} ${textMuted} hover:text-blue-400 hover:border-blue-500/50 border ${borderColor}`
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
                  placeholder="Enter AI name..."
                  className={`mt-3 w-full p-3 ${bgInput} ${borderColor} border rounded-lg focus:border-blue-500 focus:outline-none`}
                />
              )}
            </div>

            {/* Text Input */}
            <div className={`p-4 ${bgCard} ${borderColor} border rounded-xl`}>
              <textarea
                value={aiOutput}
                onChange={(e) => setAiOutput(e.target.value)}
                placeholder="Paste the AI response you want to verify..."
                rows={6}
                className={`w-full p-4 ${bgInput} ${borderColor} border rounded-xl focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none`}
              />
            </div>

            {/* Verify Button */}
            <button
              onClick={verifyContent}
              disabled={isVerifying || !aiOutput.trim() || !getEffectiveAiSource()}
              className={`w-full py-4 rounded-xl text-lg font-semibold transition-all ${
                isVerifying || !aiOutput.trim() || !getEffectiveAiSource()
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/25'
              }`}
            >
              {isVerifying ? (
                <span className="flex items-center justify-center gap-3">
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  {currentStep} ({elapsedTime}s)
                </span>
              ) : (
                '✓ Verify Against Real Sources'
              )}
            </button>

            {/* Loading Facts */}
            {isVerifying && (
              <div className={`p-4 ${bgCard} ${borderColor} border rounded-xl text-center`}>
                <p className={`text-sm ${textMuted} italic`}>💡 {currentFact}</p>
              </div>
            )}

            {/* Error Display */}
            {error && !result && (
              <div className={`p-4 ${bgCard} border border-red-500/50 rounded-xl text-red-400`}>
                <p className="font-medium">⚠️ {error}</p>
              </div>
            )}

            {/* Results */}
            {result && result.claims && result.claims.length > 0 && (
              <div className="space-y-4">
                {/* Summary */}
                <div className={`p-5 ${bgCard} ${borderColor} border rounded-xl`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="font-medium">
                      ✅ Verification Complete ({result.timeTaken || elapsedTime}s)
                    </div>
                    <button
                      onClick={copyResults}
                      className={`px-3 py-1 rounded-lg text-sm ${bgInput} hover:bg-blue-500/20 transition-all`}
                    >
                      📋 Copy Results
                    </button>
                  </div>
                  
                  {/* Summary Stats */}
                  <div className="flex flex-wrap gap-6 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold text-2xl">{result.summary.verified}</span>
                      <span className={textMuted}>Verified Truth</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-red-400 font-bold text-2xl">{result.summary.false}</span>
                      <span className={textMuted}>Proven False</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-amber-400 font-bold text-2xl">{result.summary.unconfirmed}</span>
                      <span className={textMuted}>Unconfirmed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-blue-400 font-bold text-2xl">{result.summary.opinions}</span>
                      <span className={textMuted}>Opinions</span>
                    </div>
                  </div>

                  {/* Verdict */}
                  <div className={`p-3 rounded-lg ${
                    result.summary.false > 0 ? 'bg-red-900/20 text-red-300' :
                    result.summary.verified > result.summary.unconfirmed ? 'bg-emerald-900/20 text-emerald-300' :
                    'bg-amber-900/20 text-amber-300'
                  }`}>
                    {result.summary.false > 0 
                      ? `⚠️ Warning: ${result.summary.false} claim(s) appear to be FALSE. Verify before trusting.`
                      : result.summary.verified > result.summary.unconfirmed
                      ? `✓ Most claims appear to be supported by trusted sources.`
                      : `⚡ Some claims could not be independently verified. Check sources below.`
                    }
                  </div>
                </div>

                {/* Individual Claims */}
                <div className="space-y-3">
                  {result.claims.map((claim, index) => (
                    <div 
                      key={index}
                      className={`p-4 ${bgCard} ${borderColor} border border-l-4 ${getStatusBorder(claim.status)} rounded-xl`}
                    >
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">{getStatusIcon(claim.status)}</div>
                          <p className="font-medium">"{claim.claim}"</p>
                        </div>
                        {getStatusLabel(claim.status)}
                      </div>

                      <p className={`${textMuted} text-sm mb-3 ml-7`}>{claim.explanation}</p>

                      {claim.sourceAgreement && claim.sourceAgreement > 1 && (
                        <div className={`ml-7 mb-3 text-xs ${textMuted}`}>
                          📊 {claim.sourceAgreement} sources agree on this
                        </div>
                      )}

                      {claim.sources && claim.sources.length > 0 && (
                        <div className="ml-7 space-y-2">
                          <div className={`text-xs ${textMuted} uppercase tracking-wide`}>🔗 Sources</div>
                          {claim.sources.map((source, srcIndex) => {
                            const quality = getSourceQuality(source.domain)
                            return (
                              <div key={srcIndex} className={`p-2 rounded-lg ${bgInput}`}>
                                <div className="flex items-center justify-between">
                                  <a 
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                                  >
                                    {source.title} ↗
                                  </a>
                                  {getQualityBadge(quality)}
                                </div>
                                <p className={`${textMuted} text-xs mt-1`}>{source.snippet}</p>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Result Feedback */}
                <div className={`p-4 ${bgCard} ${borderColor} border rounded-xl`}>
                  <div className="text-sm font-medium mb-3">Was this verification helpful?</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setResultFeedback('helpful')}
                      className={`px-4 py-2 rounded-lg text-sm transition-all ${
                        resultFeedback === 'helpful' 
                          ? 'bg-emerald-600 text-white' 
                          : `${bgInput} ${textMuted} hover:bg-emerald-500/20`
                      }`}
                    >
                      👍 Yes, helpful
                    </button>
                    <button
                      onClick={() => setResultFeedback('not-helpful')}
                      className={`px-4 py-2 rounded-lg text-sm transition-all ${
                        resultFeedback === 'not-helpful' 
                          ? 'bg-red-600 text-white' 
                          : `${bgInput} ${textMuted} hover:bg-red-500/20`
                      }`}
                    >
                      👎 Not helpful
                    </button>
                  </div>
                  {resultFeedback && (
                    <p className={`text-sm ${textMuted} mt-2`}>
                      Thank you for your feedback! This helps us improve.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Disclaimer */}
            <div className={`p-3 rounded-xl ${bgInput} text-xs ${textMuted}`}>
              Trustie is for informational and educational purposes only, not legal, medical, or financial advice.
            </div>
          </main>
        )}

        {/* ============================================ */}
        {/* ASK TRUSTIE TAB */}
        {/* ============================================ */}
        {activeTab === 'ask' && (
          <main className="space-y-4">
            <div className={`p-5 ${bgCard} ${borderColor} border rounded-xl`}>
              <p className={textMuted}>
                Ask any question and Trustie will find verified answers from trusted sources.
              </p>
            </div>
            
            <div className={`p-4 ${bgCard} ${borderColor} border rounded-xl`}>
              <textarea
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ask your question here..."
                rows={3}
                className={`w-full p-4 ${bgInput} ${borderColor} border rounded-xl focus:border-blue-500 focus:outline-none resize-none`}
              />
            </div>

            <button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className={`w-full py-4 rounded-xl text-lg font-semibold transition-all ${
                isSearching || !searchQuery.trim()
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/25'
              }`}
            >
              {isSearching ? `Searching... (${elapsedTime}s)` : '🔍 Get Verified Answer'}
            </button>

            {isSearching && (
              <div className={`p-4 ${bgCard} ${borderColor} border rounded-xl text-center`}>
                <p className={`text-sm ${textMuted} italic`}>💡 {currentFact}</p>
              </div>
            )}

            {searchResult && (
              <div className={`p-5 ${bgCard} ${borderColor} border rounded-xl space-y-4`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`text-2xl font-bold ${
                      searchResult.trustScore >= 80 ? 'text-emerald-400' :
                      searchResult.trustScore >= 50 ? 'text-amber-400' : 'text-red-400'
                    }`}>
                      {searchResult.trustScore}% Trust
                    </div>
                    <span className={textMuted}>({searchResult.sourceAgreement} sources agree)</span>
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(searchResult.answer)}
                    className={`px-3 py-1 rounded-lg text-sm ${bgInput}`}
                  >
                    📋 Copy
                  </button>
                </div>
                <div className={`p-4 rounded-lg ${bgInput}`}>
                  <p>{searchResult.answer}</p>
                </div>
                <div>
                  <div className={`text-xs ${textMuted} mb-2`}>Sources:</div>
                  {searchResult.sources.map((s, i) => (
                    <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" 
                       className="block text-blue-400 text-sm hover:underline">
                      {s.title} ↗
                    </a>
                  ))}
                </div>
              </div>
            )}
          </main>
        )}

        {/* ============================================ */}
        {/* FEEDBACK TAB */}
        {/* ============================================ */}
        {activeTab === 'feedback' && (
          <main className={`p-6 ${bgCard} ${borderColor} border rounded-xl space-y-4`}>
            <h2 className="text-xl font-bold">📝 Help Us Improve Trustie</h2>
            <p className={textMuted}>
              Found a bug? Have an idea? Your feedback helps us build the most trusted AI verification tool.
            </p>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Tell us what you think..."
              rows={5}
              className={`w-full p-4 ${bgInput} ${borderColor} border rounded-xl focus:border-blue-500 focus:outline-none resize-none`}
            />
            <button
              onClick={handleFeedbackSubmit}
              disabled={!feedback.trim()}
              className={`px-6 py-3 rounded-xl font-medium transition-all ${
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
          </main>
        )}

        {/* ============================================ */}
        {/* ABOUT TAB */}
        {/* ============================================ */}
        {activeTab === 'about' && (
          <main className={`p-6 ${bgCard} ${borderColor} border rounded-xl space-y-6`}>
            <h2 className="text-xl font-bold">How Trustie Works</h2>
            
            <div className="space-y-4">
              <div className={`p-4 rounded-xl ${bgInput}`}>
                <p className="font-medium mb-2">1️⃣ You paste what an AI told you</p>
                <p className={`text-sm ${textMuted}`}>Copy the response from ChatGPT, Claude, Gemini, or any AI.</p>
              </div>
              
              <div className={`p-4 rounded-xl ${bgInput}`}>
                <p className="font-medium mb-2">2️⃣ We extract the claims</p>
                <p className={`text-sm ${textMuted}`}>Our system identifies factual statements that can be verified.</p>
              </div>
              
              <div className={`p-4 rounded-xl ${bgInput}`}>
                <p className="font-medium mb-2">3️⃣ We search trusted sources</p>
                <p className={`text-sm ${textMuted}`}>We check Wikipedia, academic sources (.edu), government sites (.gov), and reputable news outlets.</p>
              </div>
              
              <div className={`p-4 rounded-xl ${bgInput}`}>
                <p className="font-medium mb-2">4️⃣ You see the evidence</p>
                <p className={`text-sm ${textMuted}`}>Each claim is marked as Verified ✓, False ✗, or Unconfirmed ? with links to sources.</p>
              </div>
            </div>

            <div className="pt-4">
              <h3 className="font-bold mb-2">Why Trustie?</h3>
              <p className={textMuted}>
                AI chatbots sound confident even when they are wrong. Trustie empowers you to verify claims with real evidence from trusted sources. You see the proof. You decide.
              </p>
            </div>

            <div className={`p-4 rounded-xl ${bgInput}`}>
              <h3 className="font-bold mb-2">Our Methodology</h3>
              <ul className={`text-sm ${textMuted} space-y-1`}>
                <li>• We prioritize .edu, .gov, and established sources</li>
                <li>• We show how many sources agree (cross-referencing)</li>
                <li>• We flag commercial or potentially biased sources</li>
                <li>• We never personalize results (no filter bubbles)</li>
                <li>• We do not track your searches</li>
              </ul>
            </div>

            <div className={`pt-4 text-xs ${textMuted}`}>
              <p>Version 1.0.0</p>
              <div className="flex gap-4 mt-2">
                <a href="#" className="text-blue-400 hover:underline">Privacy Policy</a>
                <a href="#" className="text-blue-400 hover:underline">Terms of Service</a>
                <a href="#" className="text-blue-400 hover:underline">Contact Us</a>
              </div>
            </div>
          </main>
        )}

        {/* ============================================ */}
        {/* EMAIL CAPTURE MODAL */}
        {/* ============================================ */}
        {showEmailPrompt && !emailSubmitted && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className={`${bgCard} rounded-2xl p-6 max-w-md w-full shadow-2xl`}>
              <h3 className="text-lg font-bold mb-2">Stay Updated! 📬</h3>
              <p className={`${textMuted} text-sm mb-4`}>
                Get notified about new features and improvements. No spam, ever.
              </p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className={`w-full p-3 ${bgInput} ${borderColor} border rounded-xl mb-3 focus:border-blue-500 focus:outline-none`}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleEmailSubmit}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
                >
                  Subscribe
                </button>
                <button
                  onClick={() => setShowEmailPrompt(false)}
                  className={`px-4 py-2 ${bgInput} rounded-xl ${textMuted}`}
                >
                  Maybe Later
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* SETTINGS MODAL */}
        {/* ============================================ */}
        {showSettings && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className={`${bgCard} rounded-2xl p-6 max-w-lg w-full shadow-2xl max-h-[80vh] overflow-y-auto`}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">⚙️ Settings</h3>
                <button onClick={() => setShowSettings(false)} className={textMuted}>✕</button>
              </div>

              {/* Settings Tabs */}
              <div className={`flex gap-1 mb-6 p-1 ${bgInput} rounded-xl`}>
                {['general', 'account', 'privacy', 'about'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setSettingsTab(tab)}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium capitalize transition-all ${
                      settingsTab === tab 
                        ? 'bg-blue-600 text-white' 
                        : `${textMuted} hover:text-blue-400`
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* General Settings */}
              {settingsTab === 'general' && (
                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${textMuted}`}>Display Name</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => {
                        setDisplayName(e.target.value)
                        localStorage.setItem('displayName', e.target.value)
                      }}
                      placeholder="Your name (optional)"
                      className={`w-full p-3 ${bgInput} ${borderColor} border rounded-xl focus:border-blue-500 focus:outline-none`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${textMuted}`}>Appearance</label>
                    <div className="flex gap-2">
                      {['light', 'dark', 'auto'].map(mode => (
                        <button
                          key={mode}
                          onClick={() => setAppearanceMode(mode as any)}
                          className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium capitalize transition-all ${
                            appearanceMode === mode 
                              ? 'bg-blue-600 text-white' 
                              : `${bgInput} ${textMuted} hover:text-blue-400`
                          }`}
                        >
                          {mode === 'light' ? '☀️' : mode === 'dark' ? '🌙' : '🔄'} {mode}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Account Settings */}
              {settingsTab === 'account' && (
                <div className="space-y-4">
                  <div className={`p-4 rounded-xl ${bgInput} text-center`}>
                    <p className={`${textMuted} mb-3`}>Sign in to save your verification history</p>
                    <button
                      onClick={() => { setShowSettings(false); setAuthMode('signin'); setShowAuthModal(true) }}
                      className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
                    >
                      Sign In / Create Account
                    </button>
                  </div>
                  <p className={`text-xs ${textMuted} text-center`}>
                    🚧 Account features coming soon! This is a preview.
                  </p>
                </div>
              )}

              {/* Privacy Settings */}
              {settingsTab === 'privacy' && (
                <div className="space-y-4">
                  <div className={`p-4 rounded-xl ${bgInput}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Privacy-First Design</p>
                        <p className={`text-sm ${textMuted}`}>We do not track your searches or store personal data.</p>
                      </div>
                      <span className="text-emerald-400">✓</span>
                    </div>
                  </div>
                  <button
                    onClick={clearLocalData}
                    className={`w-full py-3 ${bgInput} rounded-xl font-medium text-red-400 hover:bg-red-500/20 transition-all`}
                  >
                    🗑️ Clear All Local Data
                  </button>
                  <p className={`text-xs ${textMuted}`}>
                    This will clear your display name and local preferences.
                  </p>
                </div>
              )}

              {/* About Settings */}
              {settingsTab === 'about' && (
                <div className="space-y-4">
                  <div className={`p-4 rounded-xl ${bgInput}`}>
                    <p className="font-medium">Trustie</p>
                    <p className={`text-sm ${textMuted}`}>Version 1.0.0</p>
                  </div>
                  <div className="space-y-2">
                    <a href="#" className={`block p-3 rounded-xl ${bgInput} hover:bg-blue-500/20 transition-all`}>
                      📄 Privacy Policy
                    </a>
                    <a href="#" className={`block p-3 rounded-xl ${bgInput} hover:bg-blue-500/20 transition-all`}>
                      📋 Terms of Service
                    </a>
                    <a href="#" className={`block p-3 rounded-xl ${bgInput} hover:bg-blue-500/20 transition-all`}>
                      📧 Contact Us
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* AUTH MODAL */}
        {/* ============================================ */}
        {showAuthModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className={`${bgCard} rounded-2xl p-6 max-w-md w-full shadow-2xl`}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">
                  {authMode === 'signin' ? 'Sign In' : 'Create Account'}
                </h3>
                <button onClick={() => setShowAuthModal(false)} className={textMuted}>✕</button>
              </div>

              <div className="space-y-3">
                <button className={`w-full py-3 ${bgInput} rounded-xl font-medium flex items-center justify-center gap-3 hover:bg-blue-500/20 transition-all`}>
                  <span>🔵</span> Continue with Google
                </button>
                <button className={`w-full py-3 ${bgInput} rounded-xl font-medium flex items-center justify-center gap-3 hover:bg-blue-500/20 transition-all`}>
                  <span>⚫</span> Continue with Apple
                </button>
                <button className={`w-full py-3 ${bgInput} rounded-xl font-medium flex items-center justify-center gap-3 hover:bg-blue-500/20 transition-all`}>
                  <span>🟦</span> Continue with Microsoft
                </button>
              </div>

              <div className="flex items-center gap-3 my-4">
                <div className={`flex-1 border-t ${borderColor}`}></div>
                <span className={`text-sm ${textMuted}`}>or</span>
                <div className={`flex-1 border-t ${borderColor}`}></div>
              </div>

              <input
                type="email"
                placeholder="Enter your email"
                className={`w-full p-3 ${bgInput} ${borderColor} border rounded-xl mb-3 focus:border-blue-500 focus:outline-none`}
              />
              <button className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700">
                Continue with Email
              </button>

              <p className={`text-center text-sm ${textMuted} mt-4`}>
                {authMode === 'signin' ? (
                  <>Do not have an account? <button onClick={() => setAuthMode('signup')} className="text-blue-400">Sign up</button></>
                ) : (
                  <>Already have an account? <button onClick={() => setAuthMode('signin')} className="text-blue-400">Sign in</button></>
                )}
              </p>

              <div className={`mt-4 p-3 rounded-xl ${bgInput} text-center`}>
                <p className={`text-xs ${textMuted}`}>
                  🚧 Account features are coming soon! This is a preview of the login experience.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* FOOTER */}
        {/* ============================================ */}
        <footer className={`mt-8 pt-6 border-t ${borderColor} text-center`}>
          <p className={`text-sm ${textMuted}`}>
            Trustie — Verify AI Claims with Real Sources in Seconds
          </p>
          <p className={`text-xs ${textMuted} mt-2`}>
            © 2025 Trustie. For informational and educational purposes only.
          </p>
        </footer>
      </div>
    </div>
  )
}
