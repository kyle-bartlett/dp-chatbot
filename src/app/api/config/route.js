import { isAuthConfigured } from '@/lib/auth'

export async function GET() {
  return Response.json({
    authConfigured: isAuthConfigured(),
  })
}

