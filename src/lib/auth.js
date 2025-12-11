/**
 * NextAuth configuration for Google OAuth
 * Restricts access to Anker domain emails only
 */

import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'

// Allowed email domains (add your company domain)
const ALLOWED_DOMAINS = [
  'anker.com',
  'anker-in.com',
  // Add other Anker domains as needed
]

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Check if auth is configured
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        // Auth not configured, allow all (for development)
        return true
      }

      // Check email domain
      const email = user.email || profile?.email
      if (!email) {
        return false
      }

      const domain = email.split('@')[1]?.toLowerCase()
      if (!domain) {
        return false
      }

      // Check if domain is allowed
      const isAllowed = ALLOWED_DOMAINS.some(allowed =>
        domain === allowed || domain.endsWith('.' + allowed)
      )

      if (!isAllowed) {
        // Redirect to error page with message
        return `/auth/error?error=AccessDenied&message=${encodeURIComponent('Only Anker employees can access this application.')}`
      }

      return true
    },
    async session({ session, token }) {
      // Add user info to session
      if (session.user) {
        session.user.id = token.sub
      }
      return session
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  trustHost: true,
})

/**
 * Check if authentication is configured
 */
export function isAuthConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}
