'use client'

/**
 * services/room.ts
 *
 * Client-side room service. Encapsulates all API calls, token management,
 * and presence logic so page components stay thin and focused on rendering.
 *
 * All fetch calls include the device fingerprint header for server-side
 * correlation. The fingerprint is NEVER used as a sole auth mechanism —
 * it accompanies a properly signed JWT token on every request.
 */

import { sanitizeClipboard, getRoomUrl, isValidRoomId, normalizeRoomId } from '@/lib/clipboard'
import { getLocalFingerprint, getVisitorId } from '@/services/fingerprint'
import { getFirebaseServices, signInToFirebaseRoom } from '@/lib/firebase-client'
import { onDisconnect, onValue, ref } from 'firebase/database'

// ─── Types ───────────────────────────────────────────────────────────────────

export type RoomRole = 'host' | 'participant'

export type RoomTokenPayload = {
  token: string
  firebaseToken: string
  role: RoomRole
  roomId?: string
}

export type Device = {
  sid: string
  fingerprint: string
  name: string
  deviceLabel: string
  role: RoomRole
}

export type RoomSnapshot = {
  roomId: string
  status: 'open' | 'closed'
  text: string
  people: number
  role?: RoomRole
  devices?: Device[]
}

// ─── Token cache ─────────────────────────────────────────────────────────────

const pendingConnections = new Map<string, Promise<RoomTokenPayload>>()

function readCachedToken(roomId: string): RoomTokenPayload | null {
  try {
    const raw = sessionStorage.getItem(`clipboard-token-${roomId}`)
    return raw ? (JSON.parse(raw) as RoomTokenPayload) : null
  } catch {
    return null
  }
}

function writeCachedToken(roomId: string, payload: RoomTokenPayload) {
  sessionStorage.setItem(`clipboard-token-${roomId}`, JSON.stringify(payload))
}

export function clearCachedToken(roomId: string) {
  sessionStorage.removeItem(`clipboard-token-${roomId}`)
}

// ─── Host fingerprint persistence ────────────────────────────────────────────

export function getStoredHostFingerprint(roomId: string): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(`clipboard-host-fp-${roomId}`)
}

export function setStoredHostFingerprint(roomId: string, fingerprint: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(`clipboard-host-fp-${roomId}`, fingerprint)
}

export function clearStoredHostFingerprint(roomId: string) {
  if (typeof window === 'undefined') return
  localStorage.removeItem(`clipboard-host-fp-${roomId}`)
}

export function subscribeToRoomStatus(
  roomId: string,
  onStatus: (status: 'open' | 'closed') => void,
): Unsubscribe {
  const { database } = getFirebaseServices()
  const statusRef = ref(database, `rooms/${roomId}/meta/status`)

  const unsub = onValue(
    statusRef,
    (snapshot) => {
      const value = snapshot.val()
      if (value === null) {
        onStatus('closed')
        return
      }
      onStatus(value === 'closed' ? 'closed' : 'open')
    },
    (error) => {
      console.error('Firebase room status listener failed', roomId, error)
    },
  )

  return () => {
    try { unsub() } catch { /* ignore */ }
  }
}

export function subscribeToRoomClipUpdatedAt(
  roomId: string,
  onUpdatedAt: (updatedAt?: number) => void,
): Unsubscribe {
  const { database } = getFirebaseServices()
  const updatedAtRef = ref(database, `rooms/${roomId}/clip/updatedAt`)

  const unsub = onValue(
    updatedAtRef,
    (snapshot) => {
      const value = snapshot.val()
      onUpdatedAt(typeof value === 'number' ? value : undefined)
    },
    (error) => {
      console.error('Firebase room clip listener failed', roomId, error)
    },
  )

  return () => {
    try { unsub() } catch { /* ignore */ }
  }
}

export function setupRoomPresenceOnDisconnect(roomId: string) {
  const { auth, database } = getFirebaseServices()
  const uid = auth.currentUser?.uid
  if (!uid) return () => undefined

  const presenceRef = ref(database, `rooms/${roomId}/presence/${uid}`)
  const onDisconnectRef = onDisconnect(presenceRef)
  onDisconnectRef.remove().catch((error) => {
    console.error('Failed to register room presence onDisconnect', roomId, error)
  })

  return () => {
    onDisconnectRef.cancel().catch(() => undefined)
  }
}

/**
 * Subscribe specifically to presence child events for lower-latency updates
 * to participant lists. Calls `onPresence` with the full current presence map
 * whenever a child is added/changed/removed.
 */
export function subscribeToRoomPresence(
  roomId: string,
  onPresence: (presence: RoomLiveState['presence']) => void,
): Unsubscribe {
  const { database } = getFirebaseServices()
  const presenceRef = ref(database, `rooms/${roomId}/presence`)

  // Listen to the whole presence node — this delivers the current map
  // immediately and on every change (child added/changed/removed).
  const unsub = onValue(
    presenceRef,
    (snapshot) => {
      onPresence(snapshot.val() || {})
    },
    (error) => {
      console.error('Firebase room presence listener failed', roomId, error)
    },
  )

  return () => {
    try { unsub() } catch { /* ignore */ }
  }
}

// ─── Device label ────────────────────────────────────────────────────────────

export function getDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Unknown device'
  const ua = navigator.userAgent

  let os = 'Unknown OS'
  if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS'
  else if (/Android/.test(ua)) os = 'Android'
  else if (/Mac OS X/.test(ua)) os = 'macOS'
  else if (/Windows/.test(ua)) os = 'Windows'
  else if (/Linux/.test(ua)) os = 'Linux'

  let browser = 'Browser'
  if (/Edg\//.test(ua)) browser = 'Edge'
  else if (/OPR\//.test(ua)) browser = 'Opera'
  else if (/Chrome\//.test(ua)) browser = 'Chrome'
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = 'Safari'
  else if (/Firefox\//.test(ua)) browser = 'Firefox'

  return `${browser} on ${os}`
}

// ─── Participant placeholders (honest fallback) ───────────────────────────────

export function getParticipantPlaceholders(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `Participant ${i + 2}`)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export { getRoomUrl, isValidRoomId, normalizeRoomId }

export type RoomLiveState = {
  status?: 'open' | 'closed'
  updatedAt?: number
  presence: Record<
    string,
    {
      lastSeen?: number
      role?: RoomRole
      name?: string
      deviceLabel?: string
      fingerprint?: string
      sid: string
      instanceId?: string
    }
  >
}

export type Unsubscribe = () => void

function authHeaders(token: string, fingerprint: string): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
    'x-device-fingerprint': fingerprint,
  }
}

// ─── API calls ───────────────────────────────────────────────────────────────

/**
 * Fetch a full room snapshot (text, presence, devices).
 * Throws a typed error with `.status` on non-2xx responses.
 */
export async function fetchRoomSnapshot(
  roomId: string,
  token: string,
  fingerprint: string,
): Promise<RoomSnapshot> {
  const response = await fetch(`/api/rooms/${roomId}?token=${encodeURIComponent(token)}`, {
    headers: authHeaders(token, fingerprint),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload.error || 'Unable to connect') as Error & { status?: number }
    error.status = response.status
    throw error
  }
  return payload as RoomSnapshot
}

/**
 * Send a heartbeat to mark this device as active and update presence metadata.
 */
export async function sendPresence(
  roomId: string,
  token: string,
  fingerprint: string,
  deviceLabel: string,
  name: string,
  instanceId?: string,
): Promise<void> {
  await fetch(`/api/rooms/${roomId}?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { ...authHeaders(token, fingerprint), 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'presence', deviceLabel, name, instanceId }),
  })
}

/**
 * Persist updated clipboard text to the server.
 * Returns true on success, throws on error.
 */
export async function saveText(
  roomId: string,
  token: string,
  text: string,
  fingerprint: string,
): Promise<void> {
  const response = await fetch(`/api/rooms/${roomId}?token=${encodeURIComponent(token)}`, {
    method: 'PATCH',
    headers: { ...authHeaders(token, fingerprint), 'content-type': 'application/json' },
    body: JSON.stringify({ text: sanitizeClipboard(text) }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Unable to save text')
}

/**
 * Close the room (host-only action).
 */
export async function closeRoom(
  roomId: string,
  token: string,
  fingerprint: string,
): Promise<void> {
  const response = await fetch(`/api/rooms/${roomId}?token=${encodeURIComponent(token)}`, {
    method: 'DELETE',
    headers: { ...authHeaders(token, fingerprint), 'x-close-room': '1' },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Unable to close room')
}

/**
 * Leave the room as a participant (sends a keep-alive DELETE on page unload).
 */
export function sendLeaveBeacon(roomId: string, token: string, fingerprint: string) {
  const url = `/api/rooms/${roomId}?token=${encodeURIComponent(token)}`
  try {
    void fetch(url, {
      method: 'DELETE',
      headers: authHeaders(token, fingerprint),
      keepalive: true,
    })
  } catch {
    // Best-effort; ignore errors on tab close.
  }
}

/**
 * Obtain a signed room token. De-duplicates in-flight requests and reads from
 * sessionStorage cache. Also upgrades role to 'host' if the local fingerprint
 * matches a previously-stored host fingerprint (survives tab refresh).
 *
 * Enriches the join payload with the FingerprintJS visitorId when available.
 */
export async function getRoomToken(
  roomId: string,
  fingerprint: string,
  name: string,
  deviceLabel: string,
  forceFresh = false,
): Promise<RoomTokenPayload> {
  if (!forceFresh) {
    const cached = readCachedToken(roomId)
    if (cached) {
      // Re-apply host role from local storage if server returned stale participant token.
      if (cached.role !== 'host' && getStoredHostFingerprint(roomId) === fingerprint) {
        return { ...cached, role: 'host' }
      }
      return cached
    }

    const pending = pendingConnections.get(roomId)
    if (pending) return pending
  }

  // Kick off FingerprintJS in the background — we won't block on it.
  const visitorIdPromise = getVisitorId()

  const request = visitorIdPromise
    .then((visitorId) =>
      fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-device-fingerprint': fingerprint },
        body: JSON.stringify({ roomId, fingerprint, name, deviceLabel, visitorId }),
      }),
    )
    .then(async (response) => {
      const nextPayload = await response.json().catch(() => ({}))
      if (!response.ok) {
        const errorMsg = nextPayload.error || (response.status === 404 || response.status === 410 ? 'This room is expired' : 'Unable to connect to room')
        const err = new Error(errorMsg) as Error & { status?: number; expired?: boolean }
        err.status = response.status
        err.expired = Boolean(nextPayload.expired || response.status === 404 || response.status === 410 || errorMsg.toLowerCase().includes('expired'))
        throw err
      }
      const payload = nextPayload as RoomTokenPayload
      writeCachedToken(roomId, payload)
      return payload
    })
    .finally(() => {
      if (!forceFresh) pendingConnections.delete(roomId)
    })

  if (!forceFresh) {
    pendingConnections.set(roomId, request)
  }

  return request
}

export { signInToFirebaseRoom }

// ─── Username persistence ────────────────────────────────────────────────────

export function getSavedUsername(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('clipboard-username')
}

export function saveUsername(name: string) {
  localStorage.setItem('clipboard-username', name.trim().slice(0, 24))
}

export function clearUsername() {
  localStorage.removeItem('clipboard-username')
}

// ─── Re-export fingerprint helpers ───────────────────────────────────────────

export { getLocalFingerprint }
