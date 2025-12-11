'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/Logo'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { Suspense } from 'react'

function ErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const message = searchParams.get('message')

  const errorMessages = {
    AccessDenied: message || 'You do not have permission to access this application.',
    Configuration: 'There is a problem with the server configuration.',
    Verification: 'The verification link has expired or has already been used.',
    Default: 'An error occurred during authentication.',
  }

  const errorMessage = errorMessages[error] || errorMessages.Default

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="flex justify-center mb-6">
          <Logo />
        </div>

        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-800 text-center mb-2">
          Access Denied
        </h1>

        <p className="text-gray-500 text-center mb-6">
          {errorMessage}
        </p>

        <div className="space-y-3">
          <Link
            href="/auth/signin"
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#00A0E9] text-white rounded-xl hover:bg-[#0090d9] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Try Again
          </Link>

          <p className="text-xs text-gray-400 text-center">
            If you believe this is an error, contact your administrator.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  )
}
