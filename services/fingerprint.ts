'use client'

import FingerprintJS from '@fingerprintjs/fingerprintjs'

// Module-level cache for FingerprintJS agent
let fpPromise: ReturnType<typeof FingerprintJS.load> | null = null

function getFpPromise() {
  if (typeof window === 'undefined') return null
  if (!fpPromise) {
    fpPromise = FingerprintJS.load()
  }
  return fpPromise
}

// Get stable visitor ID from browser signals
export async function getVisitorId(): Promise<string> {
  try {
    const promise = getFpPromise()
    if (!promise) return ''
    const fp = await promise
    const result = await fp.get()
    return result.visitorId
  } catch {
    return ''
  }
}

// Fast synchronous device ID from localStorage (instant fallback)
export function getLocalFingerprint(): string {
  if (typeof window === 'undefined') return ''
  const key = 'clipboard-device-fingerprint'
  const existing = localStorage.getItem(key)
  if (existing) return existing
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `fp-${Date.now()}-${Math.random().toString(36).slice(2)}`
  localStorage.setItem(key, id)
  return id
}

export function getLocalFingerprintSync(): string {
  return getLocalFingerprint()
}
