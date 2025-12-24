'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import MessageBubble from './MessageBubble'
import TypingIndicator from './TypingIndicator'
import ChatInput from './ChatInput'
import { FileText, TrendingUp, Package, BookOpen, Search, Trash2, Download, Lock } from 'lucide-react'

const WELCOME_MESSAGE = `Hello! I'm your Anker Charging Offline Planning Assistant. I'm here to help you with:

• **CPFR processes** - Walmart, Target, BBY, Costco, Apple procedures
• **Forecasting** - Logic, ladders, and refresh processes
• **KPIs & Dashboards** - Metrics, tracking, and reporting
• **SOPs & Training** - Standard procedures and onboarding materials
• **Supply & Inventory** - Pipeline, PSI ladders, and allocation
• **SKU Lookup** - Search for specific product information

What would you like to know?`

const QUICK_ACTIONS = [
  { icon: FileText, label: 'CPFR Process', query: 'Explain the CPFR process for Walmart' },
  { icon: TrendingUp, label: 'Forecast Logic', query: 'How does the forecast logic work?' },
  { icon: Package, label: 'Supply Chain', query: 'What is the PSI ladder process?' },
  { icon: BookOpen, label: 'Training', query: 'Where can I find training materials?' },
  { icon: Search, label: 'SKU Lookup', query: 'Look up information for SKU A2140' },
]

const STORAGE_KEY = 'anker-na-offline-planning-chat-history'

// Fun ASCII-style login prompt
function LoginRequiredOverlay() {
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-[#00A0E9]/10 to-[#00d4aa]/10 backdrop-blur-sm flex items-center justify-center z-10">
      <div className="bg-[#2d2d2d] rounded-lg shadow-2xl p-8 max-w-md mx-4 text-center border border-[#00A0E9]/40 neon-glow-sm">
        <div className="mb-6">
          <pre className="text-[#00A0E9] text-xs font-mono leading-tight inline-block text-left">
{`    ┌─────────────────────────┐
    │  ⚡ ACCESS REQUIRED ⚡  │
    ├─────────────────────────┤
    │                         │
    │   ┌───┐                 │
    │   │ 🔐│  Please log in  │
    │   └───┘   to continue   │
    │                         │
    │   Your forecast awaits! │
    │                         │
    └─────────────────────────┘`}
          </pre>
        </div>
        <p className="text-gray-300 mb-4">
          Sign in with your <span className="font-semibold text-[#00A0E9]">@anker.com</span> account to access the Offline Planning Assistant
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
          <Lock className="w-4 h-4" />
          <span>Internal Use Only</span>
        </div>
      </div>
    </div>
  )
}

export default function ChatWindow() {
  const { data: session } = useSession()
  const [messages, setMessages] = useState([
    { id: 1, content: WELCOME_MESSAGE, isUser: false, sources: [] }
  ])
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)

  // Load chat history from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.length > 1) {
          setMessages(parsed)
        }
      }
    } catch (e) {
      console.error('Failed to load chat history:', e)
    }
  }, [])

  // Save chat history to localStorage when messages change
  useEffect(() => {
    if (messages.length > 1) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
      } catch (e) {
        console.error('Failed to save chat history:', e)
      }
    }
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading])

  const handleSendMessage = async (content) => {
    // Add user message
    const userMessage = { id: Date.now(), content, isUser: true }
    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          history: messages.map(m => ({
            role: m.isUser ? 'user' : 'assistant',
            content: m.content
          }))
        })
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const data = await response.json()

      // Add assistant message with sources
      const assistantMessage = {
        id: Date.now() + 1,
        content: data.response,
        isUser: false,
        sources: data.sources || []
      }
      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage = {
        id: Date.now() + 1,
        content: "I'm sorry, I encountered an error. Please make sure the API is configured correctly and try again.",
        isUser: false,
        sources: []
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuickAction = (query) => {
    handleSendMessage(query)
  }

  const handleClearHistory = () => {
    if (confirm('Clear all chat history? This cannot be undone.')) {
      setMessages([{ id: 1, content: WELCOME_MESSAGE, isUser: false, sources: [] }])
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  const handleExportChat = () => {
    const exportData = messages
      .filter(m => m.id !== 1) // Skip welcome message
      .map(m => ({
        role: m.isUser ? 'User' : 'Assistant',
        message: m.content,
        timestamp: new Date(m.id).toISOString(),
        sources: m.sources?.map(s => s.title) || []
      }))

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `anker-na-offline-planning-chat-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full relative">
      {/* Chat container with distinct lighter background */}
      <div className="flex flex-col h-full bg-[#353535]/95 backdrop-blur-md border border-[#00A0E9]/40 rounded-lg shadow-2xl neon-glow-sm">
        {/* Show login overlay if not authenticated */}
        {!session?.user && <LoginRequiredOverlay />}
        {/* Chat toolbar */}
        {messages.length > 2 && (
          <div className="px-4 py-2 border-b border-[#00A0E9]/30 bg-[#2d2d2d]/80 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto flex justify-end gap-2">
            <button
              onClick={handleExportChat}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-[#00A0E9] hover:bg-[#00A0E9]/10 rounded-lg transition-all hover:neon-glow-sm"
              title="Export chat"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
            <button
              onClick={handleClearHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
              title="Clear history"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg.content}
              isUser={msg.isUser}
              sources={msg.sources}
            />
          ))}

          {isLoading && <TypingIndicator />}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Quick actions (show only when few messages) */}
      {messages.length <= 2 && !isLoading && (
        <div className="px-4 pb-2">
          <div className="max-w-4xl mx-auto">
            <p className="text-xs text-gray-400 mb-2 font-medium">Quick questions:</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_ACTIONS.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQuickAction(action.query)}
                  className="flex items-center gap-2 px-3 py-2 bg-[#2d2d2d] border border-[#00A0E9]/40 rounded-lg text-sm text-gray-200 hover:border-[#00A0E9] hover:text-[#00A0E9] hover:bg-[#00A0E9]/15 transition-all hover:neon-glow-sm"
                >
                  <action.icon className="w-4 h-4" />
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

        {/* Input area */}
        <ChatInput onSendMessage={handleSendMessage} disabled={isLoading} />
      </div>
    </div>
  )
}
