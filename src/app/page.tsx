'use client'

import React, { useState, useEffect } from 'react'

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
  "Fun fact: The first AI program was written in 1951.",
  "Did you know? AI cannot actually think - it predicts the most likely next word.",
  "Interesting: Cross-referencing sources reduces misinformation by 73%.",
  "Did you know? Most AI hallucinations occur with specific dates and statistics.",
  "Fun fact: .edu and .gov sources are considered most reliable.",
  "Did you know? Trustie verifies claims against multiple independent sources.",
  "Interesting: Critical thinking skills are more important than ever in the age of AI.",
  "Did you know? Wikipedia can be edited by anyone - always verify important facts.",
  "Fun fact: The term 'artificial intelligence' was coined in 1956."
]

const AI_CATEGORIES = [
  { name: 'Coding', icon: '💻', description: 'Best AIs for programming and development', ais: ['Claude', 'ChatGPT', 'Copilot'] },
  { name: 'Research', icon: '🔬', description: 'Best AIs for academic and scientific research', ais: ['Perplexity', 'Claude', 'ChatGPT'] },
  { name: 'Writing', icon: '✍️', description: 'Best AIs for content creation and copywriting', ais: ['Claude', 'ChatGPT', 'Gemini'] },
  { name: 'Math', icon: '🔢', description: 'Best AIs for calculations and problem solving', ais: ['ChatGPT', 'Claude', 'Wolfram'] },
  { name: 'Creative', icon: '🎨', description: 'Best AIs for brainstorming and ideation', ais: ['Claude', 'ChatGPT', 'Gemini'] },
  { name: 'Business', icon: '💼', description: 'Best AIs for business strategy and analysis', ais: ['ChatGPT', 'Claude', 'Perplexity'] },
  { name: 'Legal', icon: '⚖️', description: 'Best AIs for legal research (not advice)', ais: ['Claude', 'ChatGPT', 'Perplexity'] },
  { name: 'Health', icon: '🏥', description: 'Best AIs for health information (not diagnosis)', ais: ['ChatGPT', 'Claude', 'Perplexity'] },
  { name: 'Education', icon: '📚', description: 'Best AIs for learning and tutoring', ais: ['ChatGPT', 'Claude', 'Khanmigo'] },
  { name: 'Customer Service', icon: '💬', description: 'Best AIs for support and chat', ais: ['ChatGPT', 'Claude', 'Intercom'] },
]

// ============================================
// MAIN COMPONENT
// ============================================
export default function Home() {
  const [darkMode, setDarkMode] = useState(true)
  const [activeTab, setActiveTab] = useState('search')
  const [showSettings, setShowSettings] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [settingsTab, setSettingsTab] = useState('general')
  
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [rephrasedAnswer, setRephrasedAnswer] = useState('')
  const [isRephrasing, setIsRephrasing] = useState(false)
  
  const [aiOutput, setAiOutput] = useState('')
  const [aiSource, setAiSource] = useState('')
  const [customAiSource, setCustomAiSource] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState('')
  const [elapsedTime, setElapsedTime] = useState(0)
  const [currentFact, setCurrentFact] = useState('')
  
  const [rankings, setRankings] = useState<AIRanking[]>([])
  
  const [tabFeedback, setTabFeedback] = useState('')
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)
  const [resultFeedback, setResultFeedback] = useState<'helpful' | 'not-helpful' | null>(null)
  
  const [displayName, setDisplayName] = useState('')
  const [appearanceMode, setAppearanceMode] = useState<'light' | 'dark' | 'auto'>('dark')
  
  const [email, setEmail] = useState('')
  const [showEmailPopup, setShowEmailPopup] = useState(false)
  const [emailSubmitted, setEmailSubmitted] = useState(false)
  
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchRankings()
    const savedMode = localStorage.getItem('darkMode')
    if (savedMode !== null) setDarkMode(savedMode === 'true')
    const savedName = localStorage.getItem('displayName')
    if (savedName) setDisplayName(savedName)
    const savedEmailSubmitted = localStorage.getItem('emailSubmitted')
    if (savedEmailSubmitted) setEmailSubmitted(true)
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

  useEffect(() => {
    const interval = setInterval(fetchRankings, 30000)
    return () => clearInterval(interval)
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
    if (aiSource === 'Other' && customAiSource.trim()) return customAiSource.trim()
    return aiSource
  }

  const trackUsage = () => {
    const count = parseInt(localStorage.getItem('useCount') || '0') + 1
    localStorage.setItem('useCount', String(count))
    if (count >= 3 && !emailSubmitted && !localStorage.getItem('emailSubmitted')) {
      setTimeout(() => setShowEmailPopup(true), 2000)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    
    setIsSearching(true)
    setError(null)
    setSearchResult(null)
    setRephrasedAnswer('')
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
      trackUsage()
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setIsSearching(false)
      setCurrentStep('')
    }
  }

  const handleRephrase = async () => {
    if (!searchResult?.answer) return
    
    setIsRephrasing(true)
    
    try {
      const response = await fetch('/api/rephrase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: searchResult.answer })
      })

      const data = await response.json()
      
      if (response.ok && data.rephrased) {
        setRephrasedAnswer(data.rephrased)
      }
    } catch (err) {
      console.error('Rephrase failed')
    } finally {
      setIsRephrasing(false)
    }
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
    setResultFeedback(null)
    setCurrentStep('Reading your text...')

    try {
      setTimeout(() => setCurrentStep('Extracting claims...'), 2000)
      setTimeout(() => setCurrentStep('Searching trusted sources...'), 5000)
      setTimeout(() => setCurrentStep('Cross-referencing...'), 10000)

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
      fetchRankings()
      trackUsage()
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
      setShowEmailPopup(false)
    }
  }

  const handleFeedbackSubmit = () => {
    if (tabFeedback.trim()) {
      console.log('Feedback:', tabFeedback, 'Tab:', activeTab)
      setFeedbackSubmitted(true)
      setTabFeedback('')
      setTimeout(() => setFeedbackSubmitted(false), 3000)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const clearLocalData = () => {
    localStorage.clear()
    setDisplayName('')
    setEmailSubmitted(false)
    alert('All local data has been cleared.')
  }

  const getSourceQuality = (domain: string): 'high' | 'medium' | 'low' => {
    const highTrust = ['.edu', '.gov', 'pubmed', 'nature.com', 'sciencedirect', 'who.int', 'cdc.gov', 'nih.gov', 'nasa.gov', 'britannica.com']
    const mediumTrust = ['wikipedia', 'reuters', 'apnews', 'bbc', 'npr', 'pbs', 'nytimes', 'washingtonpost', 'espn', 'cnn', 'cbsnews']
    
    const domainLower = domain.toLowerCase()
    if (highTrust.some(t => domainLower.includes(t))) return 'high'
    if (mediumTrust.some(t => domainLower.includes(t))) return 'medium'
    return 'low'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified': return '✓'
      case 'false': return '✗'
      case 'unconfirmed': return '?'
      case 'opinion': return '○'
      default: return ''
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified': return 'text-emerald-400'
      case 'false': return 'text-red-400'
      case 'unconfirmed': return 'text-amber-400'
      case 'opinion': return 'text-blue-400'
      default: return 'text-gray-400'
    }
  }

  const getQualityBadge = (quality: string) => {
    switch (quality) {
      case 'high': return { text: 'High Trust', color: 'bg-emerald-900/50 text-emerald-300' }
      case 'medium': return { text: 'Medium Trust', color: 'bg-amber-900/50 text-amber-300' }
      default: return { text: 'Verify Manually', color: 'bg-gray-700 text-gray-400' }
    }
  }

  const bgMain = darkMode ? 'bg-gray-900' : 'bg-stone-50'
  const bgCard = darkMode ? 'bg-gray-800' : 'bg-white'
  const bgInput = darkMode ? 'bg-gray-900' : 'bg-stone-100'
  const textMain = darkMode ? 'text-gray-100' : 'text-stone-900'
  const textMuted = darkMode ? 'text-gray-400' : 'text-stone-500'
  const borderColor = darkMode ? 'border-gray-700' : 'border-stone-200'

  const FeedbackBox = () => (
    <div className={`mt-6 p-4 ${bgCard} ${borderColor} border rounded-xl`}>
      <p className="text-sm font-medium mb-2">💬 Was this helpful? Let us know!</p>
      <p className={`text-xs ${textMuted} mb-3`}>Compliments? Complaints? Ideas? How can we improve? We read everything.</p>
      <textarea
        value={tabFeedback}
        onChange={(e) => setTabFeedback(e.target.value)}
        placeholder="Type your feedback here..."
        rows={2}
        className={`w-full p-3 ${bgInput} ${borderColor} border rounded-lg text-sm focus:border-blue-500 focus:outline-none resize-none`}
      />
      <button
        onClick={handleFeedbackSubmit}
        disabled={!tabFeedback.trim()}
        className={`mt-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
          tabFeedback.trim() 
            ? 'bg-blue-600 text-white hover:bg-blue-700' 
            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
        }`}
      >
        Send Feedback
      </button>
      {feedbackSubmitted && (
        <span className="ml-3 text-emerald-400 text-sm">✓ Thank you!</span>
      )}
    </div>
  )

  return (
    <div className={`min-h-screen ${bgMain} ${textMain} transition-colors duration-300`}>
      <div className="max-w-6xl mx-auto px-4 py-6">
        
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
              <span className="text-white text-xl">✓</span>
            </div>
            <div>
              <h1 className="text-xl font-bold">Trustie</h1>
              <p className={`text-xs ${textMuted}`}>Verify AI with Real Sources</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
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

        <div className="flex gap-6">
          
          <div className="flex-1">
            
            <div className={`text-center mb-6 p-4 ${bgCard} rounded-xl ${borderColor} border`}>
              <p className="text-lg font-medium">No more blind trusting AI.</p>
              <p className={`text-sm ${textMuted} mt-1`}>Paste what an AI told you. We find the facts.</p>
            </div>

            <div className={`flex gap-1 mb-6 p-1 ${bgCard} rounded-xl ${borderColor} border`}>
              {[
                { id: 'search', label: '🔍 Search' },
                { id: 'check', label: '✓ Check AI' },
                { id: 'discover', label: '🧭 Discover AIs' },
                { id: 'help', label: 'ℹ️ Help' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25' 
                      : `${textMuted} hover:text-blue-400 hover:bg-blue-500/10`
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'search' && (
              <main className="space-y-4">
                <div className={`p-5 ${bgCard} ${borderColor} border rounded-xl`}>
                  <p className={`text-sm ${textMuted} mb-3`}>Ask any question. We will find trusted sources and show you the truth.</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="Type your question here..."
                      className={`flex-1 p-4 ${bgInput} ${borderColor} border rounded-xl focus:border-blue-500 focus:outline-none`}
                    />
                    <button
                      onClick={handleSearch}
                      disabled={isSearching || !searchQuery.trim()}
                      className={`px-6 rounded-xl font-semibold transition-all ${
                        isSearching || !searchQuery.trim()
                          ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {isSearching ? '...' : 'Search'}
                    </button>
                  </div>
                  <div className={`mt-2 text-xs ${textMuted}`}>
                    🔒 We do not track you • 🌐 Same results for everyone (no filter bubbles)
                  </div>
                </div>

                {isSearching && (
                  <div className={`p-6 ${bgCard} ${borderColor} border rounded-xl text-center`}>
                    <div className="flex items-center justify-center gap-3 mb-3">
                      <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <span>{currentStep} ({elapsedTime}s)</span>
                    </div>
                    <p className={`text-sm ${textMuted}`}>💡 {currentFact}</p>
                  </div>
                )}

                {error && !searchResult && (
                  <div className={`p-4 ${bgCard} border border-red-500/50 rounded-xl text-red-400`}>
                    ⚠️ {error}
                  </div>
                )}

                {searchResult && (
                  <div className={`p-5 ${bgCard} ${borderColor} border rounded-xl space-y-4`}>
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`text-3xl font-bold ${
                          searchResult.trustScore >= 80 ? 'text-emerald-400' :
                          searchResult.trustScore >= 50 ? 'text-amber-400' : 'text-red-400'
                        }`}>
                          {searchResult.trustScore}%
                        </div>
                        <div>
                          <div className="font-medium">Trust Score</div>
                          <div className={`text-xs ${textMuted}`}>{searchResult.sourceAgreement} sources agree</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleRephrase}
                          disabled={isRephrasing}
                          className={`px-3 py-2 rounded-lg text-sm ${bgInput} hover:bg-blue-500/20 transition-all flex items-center gap-2`}
                          title="Rewrite in different words (same facts)"
                        >
                          ✨ {isRephrasing ? 'Rewriting...' : 'Make It Your Own'}
                        </button>
                        <button
                          onClick={() => copyToClipboard(rephrasedAnswer || searchResult.answer)}
                          className={`px-3 py-2 rounded-lg text-sm ${bgInput} hover:bg-blue-500/20 transition-all flex items-center gap-2`}
                        >
                          📋 {copied ? 'Copied!' : 'Copy Result'}
                        </button>
                      </div>
                    </div>

                    <div className={`p-4 rounded-lg ${bgInput}`}>
                      <p className="leading-relaxed">{rephrasedAnswer || searchResult.answer}</p>
                      {rephrasedAnswer && (
                        <p className={`text-xs ${textMuted} mt-2`}>✨ Rephrased version - same facts, different words</p>
                      )}
                    </div>

                    {searchResult.warnings?.length > 0 && (
                      <div className="p-3 rounded-lg bg-amber-900/20 border border-amber-500/30">
                        <div className="text-amber-400 font-medium text-sm mb-1">⚠️ Note:</div>
                        {searchResult.warnings.map((w, i) => (
                          <p key={i} className={`text-sm ${textMuted}`}>• {w}</p>
                        ))}
                      </div>
                    )}

                    <div>
                      <div className={`text-sm font-medium mb-2`}>🔗 Sources ({searchResult.sources.length})</div>
                      <div className="space-y-2">
                        {searchResult.sources.map((source, i) => {
                          const quality = source.quality || getSourceQuality(source.domain)
                          const badge = getQualityBadge(quality)
                          return (
                            <div key={i} className={`p-3 rounded-lg ${bgInput}`}>
                              <div className="flex items-center justify-between mb-1">
                                <a href={source.url} target="_blank" rel="noopener noreferrer"
                                   className="text-blue-400 hover:text-blue-300 font-medium text-sm">
                                  {source.title} ↗
                                </a>
                                <span className={`text-xs px-2 py-0.5 rounded ${badge.color}`}>{badge.text}</span>
                              </div>
                              <p className={`text-xs ${textMuted}`}>{source.snippet}</p>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className={`p-3 rounded-lg ${bgInput} text-sm`}>
                      <div className="font-medium mb-1">🔍 How to verify yourself:</div>
                      <p className={textMuted}>Click the links above. Look for .edu or .gov sites. Check if multiple sources agree.</p>
                    </div>
                  </div>
                )}

                <FeedbackBox />
              </main>
            )}

            {activeTab === 'check' && (
              <main className="space-y-4">
                <div className={`p-4 ${bgCard} ${borderColor} border rounded-xl`}>
                  <label className={`block text-sm font-medium mb-3`}>Which AI told you this?</label>
                  <div className="flex flex-wrap gap-2">
                    {POPULAR_AIS.map(ai => (
                      <button
                        key={ai}
                        onClick={() => setAiSource(ai)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          aiSource === ai
                            ? 'bg-blue-600 text-white'
                            : `${bgInput} ${textMuted} hover:text-blue-400 border ${borderColor}`
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

                <div className={`p-4 ${bgCard} ${borderColor} border rounded-xl`}>
                  <label className={`block text-sm font-medium mb-2`}>Paste the AI response here:</label>
                  <textarea
                    value={aiOutput}
                    onChange={(e) => setAiOutput(e.target.value)}
                    placeholder="Paste what the AI told you..."
                    rows={5}
                    className={`w-full p-4 ${bgInput} ${borderColor} border rounded-xl focus:border-blue-500 focus:outline-none resize-none`}
                  />
                </div>

                <button
                  onClick={verifyContent}
                  disabled={isVerifying || !aiOutput.trim() || !getEffectiveAiSource()}
                  className={`w-full py-4 rounded-xl text-lg font-semibold transition-all ${
                    isVerifying || !aiOutput.trim() || !getEffectiveAiSource()
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isVerifying ? `Checking... (${elapsedTime}s)` : '✓ Check If This Is True'}
                </button>

                {isVerifying && (
                  <div className={`p-4 ${bgCard} ${borderColor} border rounded-xl text-center`}>
                    <p className="mb-2">{currentStep}</p>
                    <p className={`text-sm ${textMuted}`}>💡 {currentFact}</p>
                  </div>
                )}

                {error && (
                  <div className={`p-4 ${bgCard} border border-red-500/50 rounded-xl text-red-400`}>
                    ⚠️ {error}
                  </div>
                )}

                {result && result.claims && (
                  <div className={`p-5 ${bgCard} ${borderColor} border rounded-xl space-y-4`}>
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-emerald-400">{result.summary.verified}</div>
                          <div className={`text-xs ${textMuted}`}>True</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-400">{result.summary.false}</div>
                          <div className={`text-xs ${textMuted}`}>False</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-amber-400">{result.summary.unconfirmed}</div>
                          <div className={`text-xs ${textMuted}`}>Unconfirmed</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-400">{result.summary.opinions}</div>
                          <div className={`text-xs ${textMuted}`}>Opinions</div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const text = result.claims.map(c => `${c.status.toUpperCase()}: ${c.claim}`).join('\n')
                          copyToClipboard(text)
                        }}
                        className={`px-3 py-2 rounded-lg text-sm ${bgInput} hover:bg-blue-500/20 flex items-center gap-2`}
                      >
                        📋 {copied ? 'Copied!' : 'Copy Results'}
                      </button>
                    </div>

                    <div className="space-y-3">
                      {result.claims.map((claim, i) => (
                        <div key={i} className={`p-4 rounded-lg ${bgInput} border-l-4 ${
                          claim.status === 'verified' ? 'border-l-emerald-500' :
                          claim.status === 'false' ? 'border-l-red-500' :
                          claim.status === 'unconfirmed' ? 'border-l-amber-500' : 'border-l-blue-500'
                        }`}>
                          <div className="flex items-start gap-2">
                            <span className={`text-lg ${getStatusColor(claim.status)}`}>
                              {getStatusIcon(claim.status)}
                            </span>
                            <div className="flex-1">
                              <p className="font-medium">"{claim.claim}"</p>
                              <p className={`text-sm ${textMuted} mt-1`}>{claim.explanation}</p>
                              {claim.sources?.length > 0 && (
                                <div className="mt-2">
                                  {claim.sources.map((s, j) => (
                                    <a key={j} href={s.url} target="_blank" rel="noopener noreferrer"
                                       className="text-blue-400 text-sm hover:underline block">
                                      🔗 {s.title}
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className={`p-3 rounded-lg ${bgInput}`}>
                      <p className="text-sm font-medium mb-2">Was this verification helpful?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setResultFeedback('helpful')}
                          className={`px-4 py-2 rounded-lg text-sm ${
                            resultFeedback === 'helpful' ? 'bg-emerald-600 text-white' : `${bgCard} ${textMuted}`
                          }`}
                        >
                          👍 Yes
                        </button>
                        <button
                          onClick={() => setResultFeedback('not-helpful')}
                          className={`px-4 py-2 rounded-lg text-sm ${
                            resultFeedback === 'not-helpful' ? 'bg-red-600 text-white' : `${bgCard} ${textMuted}`
                          }`}
                        >
                          👎 No
                        </button>
                      </div>
                      {resultFeedback && <p className={`text-xs ${textMuted} mt-2`}>Thank you for your feedback!</p>}
                    </div>
                  </div>
                )}

                <div className={`p-3 rounded-xl ${bgInput} text-xs ${textMuted} text-center`}>
                  Trustie is for informational and educational purposes only, not legal, medical, or financial advice.
                </div>

                <FeedbackBox />
              </main>
            )}

            {activeTab === 'discover' && (
              <main className="space-y-4">
                <div className={`p-5 ${bgCard} ${borderColor} border rounded-xl`}>
                  <h2 className="text-xl font-bold mb-2">🧭 Discover the Best AI for Your Needs</h2>
                  <p className={textMuted}>Find which AI is most trusted for your specific use case. Based on real user verifications.</p>
                </div>

                <div className={`p-4 ${bgCard} ${borderColor} border rounded-xl`}>
                  <p className={`text-sm ${textMuted} text-center`}>🚧 Coming Soon! This will show real rankings based on user data.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {AI_CATEGORIES.map((category) => (
                    <div key={category.name} className={`p-4 ${bgCard} ${borderColor} border rounded-xl hover:border-blue-500/50 transition-all cursor-pointer`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{category.icon}</span>
                        <span className="font-semibold">{category.name}</span>
                      </div>
                      <p className={`text-xs ${textMuted} mb-3`}>{category.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {category.ais.map((ai, i) => (
                          <span key={ai} className={`text-xs px-2 py-1 rounded ${bgInput}`}>
                            {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} {ai}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className={`p-4 ${bgCard} ${borderColor} border rounded-xl text-center`}>
                  <p className="font-medium mb-2">Want to help build this?</p>
                  <p className={`text-sm ${textMuted}`}>Every time you verify AI output in the "Check AI" tab, you contribute to these rankings!</p>
                </div>

                <FeedbackBox />
              </main>
            )}

            {activeTab === 'help' && (
              <main className={`p-6 ${bgCard} ${borderColor} border rounded-xl space-y-6`}>
                <h2 className="text-xl font-bold">How Trustie Works</h2>
                
                <div className="space-y-4">
                  <div className={`p-4 rounded-xl ${bgInput}`}>
                    <p className="font-medium mb-1">1️⃣ You ask a question or paste AI text</p>
                    <p className={`text-sm ${textMuted}`}>Use Search to ask anything, or Check AI to verify what an AI told you.</p>
                  </div>
                  
                  <div className={`p-4 rounded-xl ${bgInput}`}>
                    <p className="font-medium mb-1">2️⃣ We search trusted sources</p>
                    <p className={`text-sm ${textMuted}`}>We check .edu sites, .gov sites, and established news sources. Wikipedia is Medium Trust because anyone can edit it.</p>
                  </div>
                  
                  <div className={`p-4 rounded-xl ${bgInput}`}>
                    <p className="font-medium mb-1">3️⃣ You see what is true or false</p>
                    <p className={`text-sm ${textMuted}`}>✓ = Verified True, ✗ = Proven False, ? = Could Not Confirm. With links to proof so you can verify yourself.</p>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold mb-2">Trust Levels Explained</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 rounded bg-emerald-900/50 text-emerald-300">High Trust</span>
                      <span className={textMuted}>.edu, .gov, peer-reviewed journals</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 rounded bg-amber-900/50 text-amber-300">Medium Trust</span>
                      <span className={textMuted}>Wikipedia, major news (BBC, Reuters, etc.)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-400">Verify Manually</span>
                      <span className={textMuted}>Other sites - check them yourself</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold mb-2">Why trust Trustie?</h3>
                  <ul className={`text-sm ${textMuted} space-y-1`}>
                    <li>• We show our sources - you can click and verify yourself</li>
                    <li>• We prioritize .edu and .gov sites over random websites</li>
                    <li>• We do not track you or sell your data</li>
                    <li>• Same results for everyone - no filter bubbles</li>
                    <li>• Rankings are based on real user verifications</li>
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

                <FeedbackBox />
              </main>
            )}
          </div>

          <div className={`w-72 flex-shrink-0 hidden lg:block`}>
            <div className={`p-4 ${bgCard} ${borderColor} border rounded-xl sticky top-6`}>
              <h2 className="text-lg font-bold text-blue-400 mb-1">🏆 Top 5 Most Trusted AIs</h2>
              <p className={`text-xs ${textMuted} mb-4`}>Live rankings from real user verifications</p>
              
              {rankings.length === 0 ? (
                <div className="text-center py-4">
                  <p className={`text-sm ${textMuted}`}>No data yet.</p>
                  <p className={`text-xs ${textMuted} mt-1`}>Verify an AI in "Check AI" tab to add data!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {rankings.slice(0, 5).map((ai, index) => (
                    <div key={ai.name} className={`p-3 rounded-lg ${bgInput}`}>
                      <div className="flex items-center gap-2">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                          index === 0 ? 'bg-yellow-500/30 text-yellow-400' :
                          index === 1 ? 'bg-gray-400/30 text-gray-300' :
                          index === 2 ? 'bg-orange-500/30 text-orange-400' :
                          'bg-gray-700 text-gray-500'
                        }`}>
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm">{ai.name}</div>
                          <div className="flex gap-2 text-xs">
                            <span className="text-emerald-400">{ai.verifiedRate}% true</span>
                            <span className="text-red-400">{ai.falseRate}% false</span>
                          </div>
                        </div>
                        <span className={`text-xs ${textMuted}`}>{ai.checksCount} checks</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <div className={`mt-4 pt-4 border-t ${borderColor}`}>
                <p className={`text-xs ${textMuted} text-center`}>Updates every 30 seconds</p>
                <p className={`text-xs ${textMuted} text-center mt-1`}>More verifications = more accurate rankings</p>
              </div>
            </div>
          </div>
        </div>

        {showEmailPopup && !emailSubmitted && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className={`${bgCard} rounded-2xl p-6 max-w-md w-full shadow-2xl`}>
              <h3 className="text-lg font-bold mb-2">📬 Stay Updated!</h3>
              <p className={`${textMuted} text-sm mb-4`}>
                Get notified about new features, AI rankings updates, and tips. No spam, ever.
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
                  onClick={() => setShowEmailPopup(false)}
                  className={`px-4 py-2 ${bgInput} rounded-xl ${textMuted}`}
                >
                  Maybe Later
                </button>
              </div>
            </div>
          </div>
        )}

        {showSettings && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className={`${bgCard} rounded-2xl p-6 max-w-lg w-full shadow-2xl max-h-[80vh] overflow-y-auto`}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">⚙️ Settings</h3>
                <button onClick={() => setShowSettings(false)} className={`${textMuted} text-xl`}>✕</button>
              </div>

              <div className={`flex gap-1 mb-6 p-1 ${bgInput} rounded-xl`}>
                {['general', 'account', 'privacy', 'about'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setSettingsTab(tab)}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium capitalize transition-all ${
                      settingsTab === tab ? 'bg-blue-600 text-white' : `${textMuted}`
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

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
                          className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium capitalize ${
                            appearanceMode === mode ? 'bg-blue-600 text-white' : `${bgInput} ${textMuted}`
                          }`}
                        >
                          {mode === 'light' ? '☀️ ' : mode === 'dark' ? '🌙 ' : '🔄 '}{mode}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {settingsTab === 'account' && (
                <div className="space-y-4">
                  <div className={`p-4 rounded-xl ${bgInput} text-center`}>
                    <p className={textMuted}>Sign in to save your verification history</p>
                    <button
                      onClick={() => { setShowSettings(false); setAuthMode('signin'); setShowAuthModal(true) }}
                      className="mt-3 w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
                    >
                      Sign In / Create Account
                    </button>
                  </div>
                  <p className={`text-xs ${textMuted} text-center`}>🚧 Account features coming soon!</p>
                </div>
              )}

              {settingsTab === 'privacy' && (
                <div className="space-y-4">
                  <div className={`p-4 rounded-xl ${bgInput}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">🔒 Privacy-First Design</p>
                        <p className={`text-sm ${textMuted}`}>We do not track your searches or sell your data.</p>
                      </div>
                      <span className="text-emerald-400">✓</span>
                    </div>
                  </div>
                  <div className={`p-4 rounded-xl ${bgInput}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">🌐 No Filter Bubbles</p>
                        <p className={`text-sm ${textMuted}`}>Same results for everyone - no personalization.</p>
                      </div>
                      <span className="text-emerald-400">✓</span>
                    </div>
                  </div>
                  <button
                    onClick={clearLocalData}
                    className={`w-full py-3 ${bgInput} rounded-xl font-medium text-red-400 hover:bg-red-500/20`}
                  >
                    🗑️ Clear All Local Data
                  </button>
                  <p className={`text-xs ${textMuted}`}>This clears your display name and preferences saved in this browser.</p>
                </div>
              )}

              {settingsTab === 'about' && (
                <div className="space-y-4">
                  <div className={`p-4 rounded-xl ${bgInput}`}>
                    <p className="font-medium">Trustie</p>
                    <p className={`text-sm ${textMuted}`}>Version 1.0.0</p>
                    <p className={`text-sm ${textMuted} mt-2`}>Verify AI claims with real sources. Built to make AI more trustworthy.</p>
                  </div>
                  <a href="#" className={`block p-3 rounded-xl ${bgInput} hover:bg-blue-500/10`}>📄 Privacy Policy</a>
                  <a href="#" className={`block p-3 rounded-xl ${bgInput} hover:bg-blue-500/10`}>📋 Terms of Service</a>
                  <a href="#" className={`block p-3 rounded-xl ${bgInput} hover:bg-blue-500/10`}>📧 Contact Us</a>
                </div>
              )}
            </div>
          </div>
        )}

        {showAuthModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className={`${bgCard} rounded-2xl p-6 max-w-md w-full shadow-2xl`}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">{authMode === 'signin' ? 'Sign In' : 'Create Account'}</h3>
                <button onClick={() => setShowAuthModal(false)} className={`${textMuted} text-xl`}>✕</button>
              </div>

              <div className="space-y-3">
                <button className={`w-full py-3 ${bgInput} rounded-xl font-medium flex items-center justify-center gap-3 hover:bg-blue-500/10`}>
                  🔵 Continue with Google
                </button>
                <button className={`w-full py-3 ${bgInput} rounded-xl font-medium flex items-center justify-center gap-3 hover:bg-blue-500/10`}>
                  ⚫ Continue with Apple
                </button>
                <button className={`w-full py-3 ${bgInput} rounded-xl font-medium flex items-center justify-center gap-3 hover:bg-blue-500/10`}>
                  🟦 Continue with Microsoft
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
                  <>No account? <button onClick={() => setAuthMode('signup')} className="text-blue-400">Sign up</button></>
                ) : (
                  <>Have an account? <button onClick={() => setAuthMode('signin')} className="text-blue-400">Sign in</button></>
                )}
              </p>

              <div className={`mt-4 p-3 rounded-xl ${bgInput} text-center`}>
                <p className={`text-xs ${textMuted}`}>🚧 Account features coming soon!</p>
              </div>
            </div>
          </div>
        )}

        <footer className={`mt-8 pt-6 border-t ${borderColor} text-center`}>
          <p className={`text-sm ${textMuted}`}>Trustie — Verify AI with Real Sources</p>
          <p className={`text-xs ${textMuted} mt-1`}>© 2025 Trustie. For informational and educational purposes only.</p>
        </footer>
      </div>
    </div>
  )
}
