'use client'

import Link from 'next/link'
import Logo from '@/components/Logo'
import ChatWindow from '@/components/ChatWindow'
import AuthGuard, { UserMenu } from '@/components/AuthGuard'
import { Settings, HelpCircle, FileStack } from 'lucide-react'

export default function Home() {
  return (
    <AuthGuard>
      <div className="h-screen flex flex-col">
        {/* Header */}
        <header className="bg-gradient-to-r from-white via-white to-[#00A0E9]/5 border-b border-gray-200 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <Logo />

            {/* Right side actions */}
            <div className="flex items-center gap-2">
              <Link
                href="/documents"
                className="p-2 text-gray-400 hover:text-[#00A0E9] hover:bg-gray-100 rounded-lg transition-colors"
                title="Manage Documents"
              >
                <FileStack className="w-5 h-5" />
              </Link>
              <Link
                href="/help"
                className="p-2 text-gray-400 hover:text-[#00A0E9] hover:bg-gray-100 rounded-lg transition-colors"
                title="Help & Guide"
              >
                <HelpCircle className="w-5 h-5" />
              </Link>
              <Link
                href="/settings"
                className="p-2 text-gray-400 hover:text-[#00A0E9] hover:bg-gray-100 rounded-lg transition-colors"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </Link>

              {/* User menu */}
              <div className="ml-2 pl-3 border-l border-gray-200">
                <UserMenu />
              </div>
            </div>
          </div>
        </header>

        {/* Main chat area */}
        <main className="flex-1 overflow-hidden">
          <ChatWindow />
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-100 py-2 px-4">
          <p className="text-xs text-center text-gray-400">
            Anker Demand Planning Assistant | Powered by Claude AI | Internal Use Only
          </p>
        </footer>
      </div>
    </AuthGuard>
  )
}
