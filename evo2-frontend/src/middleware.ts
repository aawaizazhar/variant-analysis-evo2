import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '~/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/api/billing/webhook') return NextResponse.next()
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/',
    '/dashboard/:path*',
    '/settings/:path*',
    '/api/:path*',
    '/billing/:path*',
  ],
}
