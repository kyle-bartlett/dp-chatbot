'use client'

import { signIn } from 'next-auth/react'
import Logo from '@/components/Logo'
import { Chrome } from 'lucide-react'

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="flex justify-center mb-6">
          <Logo />
        </div>

        <h1 className="text-2xl font-bold text-gray-800 text-center mb-2">
          Welcome Back
        </h1>
        <p className="text-gray-500 text-center mb-8">
          Sign in with your Anker account to continue
        </p>

        <button
          onClick={() => signIn('google', { callbackUrl: '/' })}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white border-2 border-gray-200 rounded-xl hover:border-[#00A0E9] hover:bg-gray-50 transition-all"
        >
          <Chrome className="w-6 h-6 text-[#4285F4]" />
          <span className="font-medium text-gray-700">Continue with Google</span>
        </button>

        <div className="mt-6 p-4 bg-blue-50 rounded-xl">
          <p className="text-sm text-blue-700 text-center">
            <strong>Anker employees only</strong>
            <br />
            Use your @anker.com email to sign in
          </p>
        </div>

        <p className="mt-6 text-xs text-gray-400 text-center">
          By signing in, you agree to our internal usage policies.
        </p>
      </div>
    </div>
  )
}
