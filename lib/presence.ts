// Shared presence configuration
export const PRESENCE_LIFESPAN_MS = 15000 // how long (ms) since lastSeen to consider a device active
export const ROOM_MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours room lifespan

export function isRoomExpired(createdAt?: number | null): boolean {
  if (!createdAt || typeof createdAt !== 'number') return false
  return Date.now() - createdAt > ROOM_MAX_AGE_MS
}

