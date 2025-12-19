'use client'

import { useSession, signIn, signOut } from 'next-auth/react'
import { Loader2, LogOut } from 'lucide-react'
import { useEffect, useState } from 'react'
import Image from 'next/image'

/**
 * AuthGuard component that protects pages
 * If GOOGLE_CLIENT_ID is not set, auth is bypassed (dev mode)
 */
export default function AuthGuard({ children }) {
  const { data: session, status } = useSession()
  const [authConfigured, setAuthConfigured] = useState(null) // null = unknown/loading

  // Detect whether auth is configured (server-side truth)
  useEffect(() => {
    let cancelled = false
    async function loadConfig() {
      try {
        const res = await fetch('/api/config')
        const data = await res.json()
        if (!cancelled) {
          setAuthConfigured(!!data.authConfigured)
        }
      } catch {
        if (!cancelled) {
          // If config endpoint fails, assume auth is enabled (safer)
          setAuthConfigured(true)
        }
      }
    }
    loadConfig()
    return () => { cancelled = true }
  }, [])

  // If session is loading
  if (status === 'loading' || authConfigured === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-[#00A0E9] animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  // If not authenticated and auth is enforced
  if (authConfigured && status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            Sign In Required
          </h1>
          <p className="text-gray-500 mb-6">
            Please sign in with your Anker account to access the Charging Knowledge Hub.
          </p>
          <button
            onClick={() => signIn('google')}
            className="px-6 py-3 bg-[#00A0E9] text-white rounded-xl hover:bg-[#0090d9] transition-colors"
          >
            Sign In with Google
          </button>
        </div>
      </div>
    )
  }

  // Authenticated - render children
  return children
}

/**
 * User menu component for authenticated users
 */
export function UserMenu() {
  const { data: session } = useSession()

  if (!session?.user) {
    // Auth not configured or not signed in - show placeholder
    return (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-gradient-to-br from-[#00A0E9] to-[#00d4aa] rounded-full flex items-center justify-center text-white text-sm font-medium">
          A
        </div>
        <span className="text-sm text-gray-600 hidden sm:block">Anker User</span>
      </div>
    )
  }

  // Signed in user
  const initials = session.user.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U'

  return (
    <div className="flex items-center gap-2">
      {session.user.image ? (
        <Image
          src={session.user.image}
          alt={session.user.name || 'User'}
          width={32}
          height={32}
          className="w-8 h-8 rounded-full"
        />
      ) : (
        <div className="w-8 h-8 bg-gradient-to-br from-[#00A0E9] to-[#00d4aa] rounded-full flex items-center justify-center text-white text-sm font-medium">
          {initials}
        </div>
      )}
      <span className="text-sm text-gray-600 hidden sm:block">
        {session.user.name || session.user.email}
      </span>
      <button
        onClick={() => signOut()}
        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
        title="Sign out"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  )
}
