import { NextRequest, NextResponse } from 'next/server'

/**
 * middleware.ts
 *
 * Next.js Edge Middleware that runs on every matched request.
 *
 * Responsibilities:
 *   1. Attach OWASP-recommended security headers to all responses.
 *   2. Apply a sliding-window-log IP rate limiter on sensitive API endpoints
 *      to mitigate brute-force attacks and room-flooding abuse.
 *
 * Rate limiting uses an in-memory Map (per Edge worker instance).
 * For production deployments with multiple workers, replace with an
 * external store (e.g., Upstash Redis via @upstash/ratelimit).
 */

// ─── Rate limiter ─────────────────────────────────────────────────────────────

interface RateLimitEntry {
  // Timestamps (ms) of requests that landed within the current window.
  timestamps: number[]
}

interface RateLimitRule {
  limit: number
  windowMs: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// Buckets are matched by prefix, checked in the order below — put more
// specific prefixes first. The matched bucket (not the raw request path) is
// used as the rate-limit key, so e.g. /api/rooms/abc12 and /api/rooms/xyz99
// share one counter per IP instead of each getting its own.
//
// Limits are sized per bucket based on actual client traffic:
//   - /api/rooms/join: a one-off action per user session — stays strict to
//     resist brute-forcing room codes.
//   - /api/rooms/[roomId]: hit repeatedly by ONE open tab via snapshot
//     polling (~every 500ms), presence heartbeats (~every 2s), and debounced
//     autosave on keystrokes. A single legitimate tab can generate 150+
//     requests/minute on its own, and multiple participants behind the same
//     NAT/IP share this bucket, so the limit needs real headroom — it's
//     still there to catch runaway loops / scripted abuse, not normal use.
const RATE_LIMIT_RULES: Array<{ path: string; rule: RateLimitRule }> = [
  { path: '/api/rooms/join', rule: { limit: 10, windowMs: 60_000 } },
  { path: '/api/rooms', rule: { limit: 400, windowMs: 60_000 } },
]

/**
 * Returns the rate-limit rule (and its bucket key) a path belongs to
 * (exact or prefix match), or null if the path isn't rate-limited.
 */
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

  // True sliding window: drop any timestamps that have aged out.
  entry.timestamps = entry.timestamps.filter((t) => now - t < rule.windowMs)

  if (entry.timestamps.length >= rule.limit) {
    rateLimitStore.set(key, entry)
    return true
  }

  entry.timestamps.push(now)
  rateLimitStore.set(key, entry)
  return false
}

// The longest window across all rules — used to decide when a stale entry
// is safe to prune, regardless of which bucket it belongs to.
const MAX_WINDOW_MS = Math.max(...RATE_LIMIT_RULES.map((r) => r.rule.windowMs))

// Periodically prune stale entries to prevent memory growth.
// Edge runtime doesn't support setInterval — we prune inline every ~100 checks.
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

// ─── Security headers ─────────────────────────────────────────────────────────

function applySecurityHeaders(response: NextResponse): NextResponse {
  const h = response.headers

  // Prevent clickjacking.
  h.set('X-Frame-Options', 'DENY')

  // Stop browsers from MIME-sniffing the content type.
  h.set('X-Content-Type-Options', 'nosniff')

  // Control referrer information sent with requests.
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Restrict browser feature access.
  h.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()')

  // Enforce HTTPS for 1 year (only effective in production over HTTPS).
  h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')

  // Basic Content-Security-Policy. Tighten further in production by removing
  // 'unsafe-inline' once all inline styles are moved to CSS modules / classes.
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

// ─── Middleware entry point ───────────────────────────────────────────────────

export function middleware(request: NextRequest) {
  maybePrune()

  const { pathname } = request.nextUrl

  // Determine the real client IP (works behind Vercel / standard proxies).
  // Note: x-forwarded-for is client-suppliable and only trustworthy when the
  // app sits behind a proxy that overwrites/strips it (Vercel does this).
  // If self-hosting behind a different proxy, verify it does the same.
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '0.0.0.0'

  // Rate-limit check.
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
  // Apply middleware to all routes except Next.js internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}