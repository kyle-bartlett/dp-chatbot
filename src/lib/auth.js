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

// Google OAuth scopes needed for document access
const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/documents.readonly',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/drive.readonly'
].join(' ')

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: GOOGLE_SCOPES,
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        },
      },
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
    async jwt({ token, account }) {
      // Persist the OAuth tokens right after signin
      if (account) {
        console.log('[AUTH] JWT callback - Initial login, storing tokens')
        console.log('[AUTH] access_token exists:', !!account.access_token)
        console.log('[AUTH] refresh_token exists:', !!account.refresh_token)
        console.log('[AUTH] expires_at:', account.expires_at)
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.expiresAt = account.expires_at
      }

      // Return previous token if the access token has not expired yet
      if (token.expiresAt && Date.now() < token.expiresAt * 1000) {
        return token
      }

      // Access token has expired, try to refresh it
      if (token.refreshToken) {
        try {
          const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: process.env.GOOGLE_CLIENT_ID,
              client_secret: process.env.GOOGLE_CLIENT_SECRET,
              grant_type: 'refresh_token',
              refresh_token: token.refreshToken,
            }),
          })

          const refreshedTokens = await response.json()

          if (!response.ok) {
            console.error('Failed to refresh token:', refreshedTokens)
            throw refreshedTokens
          }

          return {
            ...token,
            accessToken: refreshedTokens.access_token,
            expiresAt: Math.floor(Date.now() / 1000 + refreshedTokens.expires_in),
            // Keep the refresh token if a new one wasn't provided
            refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
          }
        } catch (error) {
          console.error('Error refreshing access token:', error)
          // Return token without refresh - user will need to re-authenticate
          return { ...token, error: 'RefreshAccessTokenError' }
        }
      }

      return token
    },
    async session({ session, token }) {
      // Add user info and access token to session
      console.log('[AUTH] Session callback')
      console.log('[AUTH] token.accessToken exists:', !!token.accessToken)
      console.log('[AUTH] token.accessToken length:', token.accessToken?.length || 0)
      console.log('[AUTH] token.error:', token.error || 'none')
      if (session.user) {
        session.user.id = token.sub
      }
      session.accessToken = token.accessToken
      session.error = token.error
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
