'use client'

import { Bot } from 'lucide-react'

export default function TypingIndicator() {
  return (
    <div className="chat-bubble flex gap-3">
      {/* Avatar */}
      <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center shadow-md bg-gradient-to-br from-[#00A0E9] to-[#00d4aa]">
        <Bot className="w-5 h-5 text-white" />
      </div>

      {/* Typing bubble */}
      <div className="bg-[#151823] px-4 py-3 rounded-lg shadow-lg border border-[#00A0E9]/20">
        <div className="flex gap-1.5 items-center h-5">
          <div className="typing-dot w-2 h-2 bg-[#00A0E9] rounded-full"></div>
          <div className="typing-dot w-2 h-2 bg-[#00A0E9] rounded-full"></div>
          <div className="typing-dot w-2 h-2 bg-[#00A0E9] rounded-full"></div>
        </div>
      </div>
    </div>
  )
}
