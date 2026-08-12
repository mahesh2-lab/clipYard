import { NextResponse } from 'next/server'
import { getFirebaseAdmin, mintRoomAuthToken } from '@/lib/firebase-admin'
import { isValidRoomId, normalizeRoomId } from '@/lib/clipboard'
import { signRoomToken } from '@/lib/room-token'
import { isRoomExpired } from '@/lib/presence'

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

    if (isRoomExpired(meta.createdAt)) {
      // Room has exceeded 24 hours — delete from Firebase
      await database.ref(`rooms/${roomId}`).remove().catch(() => undefined)
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
