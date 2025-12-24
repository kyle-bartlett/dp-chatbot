'use client'

import { useState } from 'react'
import { User, Bot, FileText, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'

/**
 * Simple markdown-like formatting
 */
function formatMessage(text) {
  if (!text) return ''

  // Process line by line
  const lines = text.split('\n')
  const elements = []
  let inList = false
  let listItems = []

  lines.forEach((line, idx) => {
      // Headers
      if (line.startsWith('### ')) {
        if (inList) {
          elements.push(<ul key={`list-${idx}`} className="list-disc list-inside mb-2 space-y-1">{listItems}</ul>)
          listItems = []
          inList = false
        }
        elements.push(<h4 key={idx} className="font-semibold text-gray-100 mt-3 mb-1">{line.slice(4)}</h4>)
      } else if (line.startsWith('## ')) {
        if (inList) {
          elements.push(<ul key={`list-${idx}`} className="list-disc list-inside mb-2 space-y-1">{listItems}</ul>)
          listItems = []
          inList = false
        }
        elements.push(<h3 key={idx} className="font-bold text-gray-100 mt-3 mb-2">{line.slice(3)}</h3>)
      }
    // Bullet points
    else if (line.match(/^[\-\*•]\s/)) {
      inList = true
      const content = line.slice(2)
      listItems.push(<li key={idx}>{formatInline(content)}</li>)
    }
    // Numbered lists
    else if (line.match(/^\d+\.\s/)) {
      if (inList && listItems.length > 0) {
        elements.push(<ul key={`list-${idx}`} className="list-disc list-inside mb-2 space-y-1">{listItems}</ul>)
        listItems = []
      }
      inList = true
      const content = line.replace(/^\d+\.\s/, '')
      listItems.push(<li key={idx}>{formatInline(content)}</li>)
    }
    // Empty line
    else if (line.trim() === '') {
      if (inList) {
        elements.push(<ul key={`list-${idx}`} className="list-disc list-inside mb-2 space-y-1">{listItems}</ul>)
        listItems = []
        inList = false
      }
      elements.push(<div key={idx} className="h-2" />)
    }
    // Regular text
    else {
      if (inList) {
        elements.push(<ul key={`list-${idx}`} className="list-disc list-inside mb-2 space-y-1">{listItems}</ul>)
        listItems = []
        inList = false
      }
      elements.push(<p key={idx} className="mb-1">{formatInline(line)}</p>)
    }
  })

  // Close any open list
  if (inList && listItems.length > 0) {
    elements.push(<ul key="list-final" className="list-disc list-inside mb-2 space-y-1">{listItems}</ul>)
  }

  return elements
}

/**
 * Format inline elements (bold, italic, code)
 */
function formatInline(text) {
  // Bold: **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g)

  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={idx} className="font-semibold">{part.slice(2, -2)}</strong>
    }
    // Inline code: `code`
    if (part.includes('`')) {
      const codeParts = part.split(/(`[^`]+`)/g)
      return codeParts.map((cp, cidx) => {
        if (cp.startsWith('`') && cp.endsWith('`')) {
          return <code key={`${idx}-${cidx}`} className="bg-[#0d1421] border border-[#00A0E9]/30 px-1 py-0.5 rounded text-sm font-mono text-[#00A0E9]">{cp.slice(1, -1)}</code>
        }
        return cp
      })
    }
    return part
  })
}

export default function MessageBubble({ message, isUser, sources }) {
  const [showSources, setShowSources] = useState(false)

  return (
    <div className={`chat-bubble flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center shadow-md ${
        isUser
          ? 'bg-gradient-to-br from-gray-600 to-gray-700'
          : 'bg-gradient-to-br from-[#00A0E9] to-[#00d4aa]'
      }`}>
        {isUser ? (
          <User className="w-5 h-5 text-white" />
        ) : (
          <Bot className="w-5 h-5 text-white" />
        )}
      </div>

      {/* Message bubble */}
      <div className={`max-w-[75%] ${isUser ? '' : ''}`}>
        <div className={`px-4 py-3 rounded-lg shadow-lg ${
          isUser
            ? 'bg-gradient-to-br from-[#00A0E9] to-[#0090d9] text-white neon-glow-sm'
            : 'bg-[#151823] text-gray-200 border border-[#00A0E9]/20'
        }`}>
          <div className="text-sm leading-relaxed">
            {isUser ? message : formatMessage(message)}
          </div>
        </div>

        {/* Sources section */}
        {!isUser && sources && sources.length > 0 && (
          <div className="mt-1">
            <button
              onClick={() => setShowSources(!showSources)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#00A0E9] transition-colors"
            >
              <FileText className="w-3 h-3" />
              <span>{sources.length} source{sources.length > 1 ? 's' : ''} used</span>
              {showSources ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {showSources && (
              <div className="mt-2 p-2 bg-[#0d1421] rounded-lg border border-[#00A0E9]/20 space-y-1">
                {sources.map((source, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <span className="w-4 h-4 bg-[#00A0E9]/20 text-[#00A0E9] rounded flex items-center justify-center font-medium border border-[#00A0E9]/30">
                      {idx + 1}
                    </span>
                    <span className="text-gray-300 flex-1 truncate">{source.title}</span>
                    {source.url && (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-500 hover:text-[#00A0E9] transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {source.score && (
                      <span className="text-gray-500">
                        {Math.round(source.score * 100)}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
