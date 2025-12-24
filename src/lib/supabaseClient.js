
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

let supabaseInstance = null

export function getSupabase() {
  if (supabaseInstance) return supabaseInstance

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables')
  }

  supabaseInstance = createClient(supabaseUrl, supabaseKey)
  return supabaseInstance
}

// Keep backward compatibility if needed, but better to switch to getter
export const supabase = {
  from: (...args) => getSupabase().from(...args),
  rpc: (...args) => getSupabase().rpc(...args),
  // Add other methods if used directly, or just rely on the proxy object below
}
