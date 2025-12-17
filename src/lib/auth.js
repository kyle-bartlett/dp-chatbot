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

/**
 * Refresh an expired Google access token (server-side).
 * Requires Google OAuth client id/secret and a stored refresh token.
 */
async function refreshGoogleAccessToken(token) {
  try {
    const refreshToken = token.refreshToken
    if (!refreshToken) {
      return { ...token, error: 'MissingRefreshToken' }
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      return { ...token, error: 'AuthNotConfigured' }
    }

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })

    const refreshed = await res.json()
    if (!res.ok) {
      return { ...token, error: refreshed?.error || 'RefreshAccessTokenError' }
    }

    // Google may not always return a new refresh_token; keep existing
    return {
      ...token,
      accessToken: refreshed.access_token,
      accessTokenExpiresAt: Date.now() + (refreshed.expires_in ?? 3600) * 1000,
      refreshToken: refreshed.refresh_token ?? refreshToken,
      error: undefined,
    }
  } catch (e) {
    return { ...token, error: e?.message || 'RefreshAccessTokenError' }
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          // Needed for reading "Anker-only" Drive/Sheets/Docs via the signed-in user
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/drive.readonly',
            'https://www.googleapis.com/auth/spreadsheets.readonly',
            'https://www.googleapis.com/auth/documents.readonly',
          ].join(' '),
          access_type: 'offline',
          prompt: 'consent',
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
      // On initial sign-in, persist OAuth tokens in the JWT
      if (account) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.accessTokenExpiresAt = Date.now() + (account.expires_in ?? 3600) * 1000
        token.error = undefined
        return token
      }

      // If we have an access token and it's still valid, keep it
      if (token.accessToken && token.accessTokenExpiresAt && Date.now() < token.accessTokenExpiresAt - 60_000) {
        return token
      }

      // Attempt to refresh if expired
      return await refreshGoogleAccessToken(token)
    },
    async session({ session, token }) {
      // Add user info to session
      if (session.user) {
        session.user.id = token.sub
      }
      // Expose access token to server routes via `auth()`
      session.accessToken = token.accessToken
      session.authError = token.error
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
