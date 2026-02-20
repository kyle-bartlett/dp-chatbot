/**
 * API Route: /api/health
 * Health check endpoint for monitoring and load balancer probes.
 * No authentication required — this is intentionally public.
 */

import { supabase } from '@/lib/supabaseClient'

export async function GET() {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    checks: {}
  }

  // Check Supabase connectivity
  try {
    const start = Date.now()
    const { count, error } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
    const latencyMs = Date.now() - start

    if (error) {
      checks.checks.database = { status: 'unhealthy', latencyMs, error: 'Connection failed' }
      checks.status = 'degraded'
    } else {
      checks.checks.database = { status: 'healthy', latencyMs, documentCount: count || 0 }
    }
  } catch (err) {
    checks.checks.database = { status: 'unhealthy', error: 'Unreachable' }
    checks.status = 'degraded'
  }

  // Check required environment variables (existence only, not values)
  const requiredEnvVars = [
    'ANTHROPIC_API_KEY',
    'OPENAI_API_KEY',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXTAUTH_SECRET'
  ]

  const missingEnvVars = requiredEnvVars.filter(key => !process.env[key])

  checks.checks.configuration = {
    status: missingEnvVars.length === 0 ? 'healthy' : 'degraded',
    missingKeys: missingEnvVars.length > 0 ? missingEnvVars : undefined
  }

  if (missingEnvVars.length > 0) {
    checks.status = 'degraded'
  }

  const httpStatus = checks.status === 'healthy' ? 200 : 503
  return Response.json(checks, { status: httpStatus })
}
