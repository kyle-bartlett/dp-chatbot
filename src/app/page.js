'use client'

import Link from 'next/link'
import Logo from '@/components/Logo'
import ChatWindow from '@/components/ChatWindow'
import AuthGuard, { UserMenu } from '@/components/AuthGuard'
import AnkerBackground from '@/components/AnkerBackground'
import { Settings, HelpCircle, FileStack } from 'lucide-react'

export default function Home() {
  return (
    <AuthGuard>
      <AnkerBackground />
      <div className="h-screen flex flex-col relative">
        {/* Header */}
        <header className="bg-[#2d2d2d]/90 backdrop-blur-md border-b border-[#00A0E9]/40 shadow-lg relative">
          {/* Subtle blue glow at top of header */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00A0E9]/50 to-transparent" />
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <Logo />

            {/* Right side actions */}
            <div className="flex items-center gap-2">
              <Link
                href="/documents"
                className="p-2 text-gray-400 hover:text-[#00A0E9] hover:bg-[#00A0E9]/10 rounded-lg transition-all hover:neon-glow-sm"
                title="Manage Documents"
              >
                <FileStack className="w-5 h-5" />
              </Link>
              <Link
                href="/help"
                className="p-2 text-gray-400 hover:text-[#00A0E9] hover:bg-[#00A0E9]/10 rounded-lg transition-all hover:neon-glow-sm"
                title="Help & Guide"
              >
                <HelpCircle className="w-5 h-5" />
              </Link>
              <Link
                href="/settings"
                className="p-2 text-gray-400 hover:text-[#00A0E9] hover:bg-[#00A0E9]/10 rounded-lg transition-all hover:neon-glow-sm"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </Link>

              {/* User menu */}
              <div className="ml-2 pl-3 border-l border-[#00A0E9]/20">
                <UserMenu />
              </div>
            </div>
          </div>
        </header>

        {/* Main chat area - constrained to show background */}
        <main className="flex-1 overflow-hidden p-4 md:p-8">
          <div className="max-w-4xl mx-auto h-full max-h-[calc(100vh-180px)]">
            <ChatWindow />
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-[#2d2d2d]/90 backdrop-blur-md border-t border-[#00A0E9]/40 py-2 px-4 relative">
          {/* Subtle blue glow at bottom of footer */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00A0E9]/50 to-transparent" />
          <p className="text-xs text-center text-gray-400">
            Anker Charging Offline Planning Assistant | Powered by Claude AI | Internal Use Only
          </p>
        </footer>
      </div>
    </AuthGuard>
  )
}
