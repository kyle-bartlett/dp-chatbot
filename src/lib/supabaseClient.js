/**
 * Supabase Client — Singleton
 *
 * Creates a single Supabase client instance at module load time.
 * Node.js module loading is synchronous and cached, so this is safe
 * against concurrent access — every import gets the same instance.
 *
 * Uses the SERVICE_ROLE_KEY for server-side operations (bypasses RLS).
 * This client should NEVER be exposed to the browser.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    'Missing Supabase environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY). ' +
    'Database operations will fail until these are configured.'
  )
}

// Eagerly create the client at module load time.
// This avoids any theoretical race in lazy initialization and removes
// the fragile proxy object pattern.
const supabaseInstance = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null

/**
 * Get the Supabase client instance.
 * Throws if environment variables are not configured.
 */
export function getSupabase() {
  if (!supabaseInstance) {
    throw new Error(
      'Supabase is not initialized. Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY ' +
      'are set in your environment variables.'
    )
  }
  return supabaseInstance
}

/**
 * Direct export for backward compatibility.
 * All existing imports like `import { supabase } from './supabaseClient'` continue to work.
 * Throws at call time (not import time) if env vars are missing.
 */
export const supabase = new Proxy({}, {
  get(target, prop) {
    const client = getSupabase()
    const value = client[prop]
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value
  }
})
