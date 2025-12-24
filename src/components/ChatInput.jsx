'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Paperclip, Command } from 'lucide-react'

export default function ChatInput({ onSendMessage, disabled }) {
  const [message, setMessage] = useState('')
  const textareaRef = useRef(null)

  // Global keyboard shortcut: "/" to focus input
  useEffect(() => {
    const handleGlobalKeydown = (e) => {
      // "/" to focus input (when not already in an input)
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault()
        textareaRef.current?.focus()
      }
      // Escape to blur input
      if (e.key === 'Escape' && document.activeElement === textareaRef.current) {
        textareaRef.current?.blur()
      }
      // Cmd/Ctrl + K to clear input
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setMessage('')
        textareaRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleGlobalKeydown)
    return () => window.removeEventListener('keydown', handleGlobalKeydown)
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (message.trim() && !disabled) {
      onSendMessage(message.trim())
      setMessage('')
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  // Auto-resize textarea
  const handleChange = (e) => {
    setMessage(e.target.value)
    // Reset height to calculate new height
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 border-t border-[#00A0E9]/30 bg-transparent">
      <div className="flex items-end gap-3 max-w-4xl mx-auto">
        {/* Attachment button (future feature) */}
        <button
          type="button"
          className="flex-shrink-0 p-2.5 text-gray-400 hover:text-[#00A0E9] hover:bg-[#00A0E9]/10 rounded-lg transition-all hover:neon-glow-sm"
          title="Attach document (coming soon)"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {/* Input field */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask about CPFR, forecasts, SOPs, SKUs, or any planning topic..."
            disabled={disabled}
            rows={1}
            className="w-full px-4 py-3 bg-[#2d2d2d] border border-[#00A0E9]/40 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#00A0E9]/50 focus:border-[#00A0E9] transition-all text-sm text-gray-100 placeholder:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minHeight: '48px', maxHeight: '120px' }}
          />
        </div>

        {/* Send button */}
        <button
          type="submit"
          disabled={!message.trim() || disabled}
          className="flex-shrink-0 p-3 bg-gradient-to-r from-[#00A0E9] to-[#00d4aa] text-white rounded-lg shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg transition-all neon-glow-sm hover:neon-glow"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>

      {/* Helper text with keyboard shortcuts */}
      <div className="flex items-center justify-center gap-4 mt-2 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-[#2d2d2d] border border-[#00A0E9]/40 rounded text-[10px] font-mono text-gray-200">/</kbd>
          <span>focus</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-[#0d1421] border border-[#00A0E9]/30 rounded text-[10px] font-mono text-gray-300">Enter</kbd>
          <span>send</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-[#0d1421] border border-[#00A0E9]/30 rounded text-[10px] font-mono text-gray-300">Shift+Enter</kbd>
          <span>new line</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-[#0d1421] border border-[#00A0E9]/30 rounded text-[10px] font-mono text-gray-300">Esc</kbd>
          <span>blur</span>
        </span>
      </div>
    </form>
  )
}
