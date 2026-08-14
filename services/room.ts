'use client'

import { sanitizeClipboard, getRoomUrl, isValidRoomId, normalizeRoomId } from '@/lib/clipboard'
import { getLocalFingerprint, getVisitorId } from '@/services/fingerprint'
import { getFirebaseServices, signInToFirebaseRoom } from '@/lib/firebase-client'
import { onDisconnect, onValue, ref } from 'firebase/database'

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

// In-flight connection deduplication
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

// Host fingerprint storage (preserves host role across refreshes)
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

  // Retry on transient permission race after token auth
  let cancelled = false
  const delays = [0, 600, 1400]
  const attempt = (index: number) => {
    const delay = delays[index] ?? 0
    const timer = setTimeout(() => {
      if (cancelled) return
      onDisconnectRef.remove().catch((error: unknown) => {
        const isPermission = error instanceof Error &&
          (error.message.includes('PERMISSION_DENIED') || error.message.includes('permission'))
        if (isPermission && index < delays.length - 1) {
          attempt(index + 1)
        } else if (!isPermission) {
          console.error('Failed to register room presence onDisconnect', roomId, error)
        }
      })
    }, delay)
    return timer
  }

  const firstTimer = attempt(0)

  return () => {
    cancelled = true
    clearTimeout(firstTimer)
    onDisconnectRef.cancel().catch(() => undefined)
  }
}

export function subscribeToRoomPresence(
  roomId: string,
  onPresence: (presence: RoomLiveState['presence']) => void,
): Unsubscribe {
  const { database } = getFirebaseServices()
  const presenceRef = ref(database, `rooms/${roomId}/presence`)

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

export function getParticipantPlaceholders(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `Participant ${i + 2}`)
}

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

// Beacon cleanup when tab unloads
export function sendLeaveBeacon(roomId: string, token: string, fingerprint: string) {
  const url = `/api/rooms/${roomId}?token=${encodeURIComponent(token)}`
  try {
    void fetch(url, {
      method: 'DELETE',
      headers: authHeaders(token, fingerprint),
      keepalive: true,
    })
  } catch {
    // Best-effort cleanup on close
  }
}

// Fetch or reuse room token and check host role
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
      if (cached.role !== 'host' && getStoredHostFingerprint(roomId) === fingerprint) {
        return { ...cached, role: 'host' }
      }
      return cached
    }

    const pending = pendingConnections.get(roomId)
    if (pending) return pending
  }

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
        const error = new Error(errorMsg) as Error & { status?: number; expired?: boolean }
        error.status = response.status
        error.expired = nextPayload.expired || response.status === 404 || response.status === 410
        throw error
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

export { getLocalFingerprint }
