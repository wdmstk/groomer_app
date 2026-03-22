import type { NextRequest } from 'next/server'
import { proxy as runProxy } from './src/proxy'

export async function proxy(req: NextRequest) {
  return runProxy(req)
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
    '/api/public/member-portal/:path*',
  ],
}
