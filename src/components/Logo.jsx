'use client'

import { Zap, Battery } from 'lucide-react'

export default function Logo() {
  return (
    <div className="flex items-center gap-3">
      {/* Anker-style logo with charging icon */}
      <div className="relative">
        <div className="w-12 h-12 bg-gradient-to-br from-[#00A0E9] to-[#00d4aa] rounded-xl flex items-center justify-center shadow-lg">
          <Zap className="w-7 h-7 text-white" strokeWidth={2.5} />
        </div>
        {/* Small battery indicator */}
        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-md">
          <Battery className="w-3 h-3 text-[#00A0E9]" />
        </div>
      </div>

      {/* Text */}
      <div className="flex flex-col">
        <span className="text-xl font-bold text-gray-100 tracking-tight">
          Anker <span className="gradient-text">Charging</span>
        </span>
        <span className="text-xs text-gray-400 font-medium -mt-0.5">
          Offline Planning Assistant
        </span>
      </div>
    </div>
  )
}
