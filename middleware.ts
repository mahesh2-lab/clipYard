import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory rate limiter per edge worker
interface RateLimitEntry {
  timestamps: number[]
}

interface RateLimitRule {
  limit: number
  windowMs: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// Strict join limit to prevent brute force; generous room limit for polling & presence
const RATE_LIMIT_RULES: Array<{ path: string; rule: RateLimitRule }> = [
  { path: '/api/rooms/join', rule: { limit: 10, windowMs: 60_000 } },
  { path: '/api/rooms', rule: { limit: 400, windowMs: 60_000 } },
]

function matchRateLimitRule(path: string): { bucket: string; rule: RateLimitRule } | null {
  for (const { path: p, rule } of RATE_LIMIT_RULES) {
    if (path === p || path.startsWith(p + '/')) return { bucket: p, rule }
  }
  return null
}

function isRateLimited(ip: string, path: string): boolean {
  const match = matchRateLimitRule(path)
  if (!match) return false
  const { bucket, rule } = match

  const now = Date.now()
  const key = `${ip}:${bucket}`
  const entry = rateLimitStore.get(key) ?? { timestamps: [] }

  // Slide window
  entry.timestamps = entry.timestamps.filter((t) => now - t < rule.windowMs)

  if (entry.timestamps.length >= rule.limit) {
    rateLimitStore.set(key, entry)
    return true
  }

  entry.timestamps.push(now)
  rateLimitStore.set(key, entry)
  return false
}

const MAX_WINDOW_MS = Math.max(...RATE_LIMIT_RULES.map((r) => r.rule.windowMs))

// Prune expired buckets periodically
let pruneCounter = 0
function maybePrune() {
  if (++pruneCounter < 100) return
  pruneCounter = 0
  const now = Date.now()
  for (const [key, entry] of rateLimitStore) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < MAX_WINDOW_MS)
    if (entry.timestamps.length === 0) {
      rateLimitStore.delete(key)
    }
  }
}

// OWASP headers & CSP
function applySecurityHeaders(response: NextResponse): NextResponse {
  const h = response.headers

  h.set('X-Frame-Options', 'DENY')
  h.set('X-Content-Type-Options', 'nosniff')
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  h.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()')
  h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')

  h.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://*.firebasedatabase.app https://*.firebaseio.com https://*.googleapis.com https://apis.google.com https://www.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      "media-src 'self' data: blob:",
      "connect-src 'self' https://*.firebaseio.com https://*.firebasedatabase.app https://*.googleapis.com wss://*.firebaseio.com wss://*.firebasedatabase.app",
      "frame-src 'self' https://*.firebasedatabase.app https://*.firebaseio.com https://*.googleapis.com https://apis.google.com https://www.gstatic.com",
      "frame-ancestors 'none'",
    ].join('; '),
  )

  return response
}

export function middleware(request: NextRequest) {
  maybePrune()

  const { pathname } = request.nextUrl
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '0.0.0.0'

  if (isRateLimited(ip, pathname)) {
    const limited = new NextResponse(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: {
        'content-type': 'application/json',
        'retry-after': '60',
      },
    })
    return applySecurityHeaders(limited)
  }

  const response = NextResponse.next()
  return applySecurityHeaders(response)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}