// app/api/rooms/join/route.ts

import { NextResponse } from 'next/server'
import { getFirebaseAdmin, mintRoomAuthToken } from '@/lib/firebase-admin'
import { isValidRoomId, normalizeRoomId } from '@/lib/clipboard'
import { signRoomToken } from '@/lib/room-token'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const roomId = normalizeRoomId(typeof body.roomId === 'string' ? body.roomId : '')
    if (!isValidRoomId(roomId)) return NextResponse.json({ error: 'Enter a valid room code' }, { status: 400 })
    const { database } = getFirebaseAdmin()
    const [metaSnapshot, presenceSnapshot] = await Promise.all([
      database.ref(`rooms/${roomId}/meta`).get(),
      database.ref(`rooms/${roomId}/presence`).get()
    ])

    const meta = metaSnapshot.val()
    if (!meta) {
      return NextResponse.json({ error: 'This room is expired', expired: true }, { status: 404 })
    }

    const now = Date.now()
    const createdAt = typeof meta.createdAt === 'number' ? meta.createdAt : 0
    const expiresAt = typeof meta.expiresAt === 'number' ? meta.expiresAt : (createdAt ? createdAt + 24 * 60 * 60 * 1000 : 0)

    if ((expiresAt > 0 && now > expiresAt) || meta.status === 'closed') {
      // Room expired or closed — delete from Firebase Realtime Database
      try {
        await database.ref(`rooms/${roomId}`).remove()
      } catch (e) {
        console.error(`Failed to delete expired room ${roomId}:`, e)
      }
      return NextResponse.json({ error: 'This room is expired', expired: true }, { status: 410 })
    }

    if (meta.status !== 'open') {
      return NextResponse.json({ error: 'This room is expired', expired: true }, { status: 404 })
    }

    const presence = presenceSnapshot.val() || {}
    const activeUsersCount = Object.keys(presence).length
    if (activeUsersCount >= 5) {
      return NextResponse.json({ error: 'Room is full (max 5 users)' }, { status: 403 })
    }
    const participantUid = crypto.randomUUID()

    const [token, firebaseToken] = await Promise.all([
      signRoomToken({ roomId, role: 'participant', sid: participantUid }),
      mintRoomAuthToken(participantUid, roomId),
    ])

    return NextResponse.json({ roomId, token, firebaseToken, role: 'participant' })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to join room' }, { status: 503 })
  }
}
