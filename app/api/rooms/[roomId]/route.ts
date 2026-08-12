// app/api/rooms/[roomId]/route.ts

import { NextResponse } from 'next/server'
import { ServerValue } from 'firebase-admin/database'
import { getFirebaseAdmin } from '@/lib/firebase-admin'
import { PRESENCE_LIFESPAN_MS } from '@/lib/presence'
import { sanitizeClipboard } from '@/lib/clipboard'
import { verifyRoomToken } from '@/lib/room-token'
import { decryptRoomText, encryptRoomText } from '@/lib/room-data'

function getBearerToken(request: Request) {
  const header = request.headers.get('authorization') || ''
  const queryToken = new URL(request.url).searchParams.get('token') || ''
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim()
  return queryToken
}

async function getRoomContext(request: Request, roomId: string) {
  const token = getBearerToken(request)
  const payload = await verifyRoomToken(token)
  if (!payload || payload.roomId !== roomId) return null
  return payload
}

export async function GET(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const resolvedParams = await params
  const roomId = String(resolvedParams.roomId || '').toLowerCase()
  const payload = await getRoomContext(request, roomId)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { database } = getFirebaseAdmin()
  const roomSnapshot = await database.ref(`rooms/${roomId}`).get()
  const room = roomSnapshot.val()
  if (!room?.meta) {
    return NextResponse.json({ error: 'This room is expired', expired: true }, { status: 404 })
  }

  const now = Date.now()
  const createdAt = typeof room.meta.createdAt === 'number' ? room.meta.createdAt : 0
  const expiresAt = typeof room.meta.expiresAt === 'number' ? room.meta.expiresAt : (createdAt ? createdAt + 24 * 60 * 60 * 1000 : 0)

  if ((expiresAt > 0 && now > expiresAt) || room.meta.status === 'closed') {
    if (expiresAt > 0 && now > expiresAt) {
      try {
        await database.ref(`rooms/${roomId}`).remove()
      } catch (e) {
        console.error(`Failed to delete expired room ${roomId}:`, e)
      }
      return NextResponse.json({ error: 'This room is expired', expired: true }, { status: 410 })
    }
    return NextResponse.json({ roomId, status: 'closed', text: '', people: 0, role: payload.role, devices: [] })
  }
  const presence = (room.presence || {}) as Record<string, any>
  const activeEntries = Object.entries(presence).filter(([_, entry]) => {
    const lastSeen = typeof entry?.lastSeen === 'number' ? entry.lastSeen : 0
    return now - lastSeen < PRESENCE_LIFESPAN_MS
  })

  const people = activeEntries.length || 1

  const devices = activeEntries.map(([sid, entry]) => ({
    sid,
    fingerprint: entry.fingerprint || sid,
    name: entry.name || (entry.role === 'host' ? 'Host' : 'Participant'),
    deviceLabel: entry.deviceLabel || 'Browser',
    role: entry.role || 'participant',
  }))

  return NextResponse.json({
    roomId,
    status: room.meta.status,
    text: typeof room.clip?.text === 'string' ? decryptRoomText(room.clip.text) : '',
    people,
    role: payload.role,
    devices,
  })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const resolvedParams = await params
    const roomId = String(resolvedParams.roomId || '').toLowerCase()
    const payload = await getRoomContext(request, roomId)
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const nextText = sanitizeClipboard(typeof body.text === 'string' ? body.text : '')

    const { database } = getFirebaseAdmin()
    const roomSnapshot = await database.ref(`rooms/${roomId}/meta`).get()
    const meta = roomSnapshot.val()
    if (!meta || meta.status === 'closed') {
      return NextResponse.json({ error: 'This room is expired', expired: true }, { status: 404 })
    }

    await database.ref(`rooms/${roomId}/clip`).update({
      text: encryptRoomText(nextText),
      updatedAt: ServerValue.TIMESTAMP,
      updatedBy: payload.sid,
    })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    if (error?.code === 'ECONNRESET' || error?.message === 'aborted') {
      return new Response(null, { status: 499 }) // Client Closed Request
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const resolvedParams = await params
    const roomId = String(resolvedParams.roomId || '').toLowerCase()
    const payload = await getRoomContext(request, roomId)
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const fingerprint = request.headers.get('x-device-fingerprint') || payload.sid
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 24) : ''
    const deviceLabel = typeof body.deviceLabel === 'string' ? body.deviceLabel.trim() : ''
    const instanceId = typeof body.instanceId === 'string' ? body.instanceId : null

    const { database } = getFirebaseAdmin()
    const presenceData: any = {
      lastSeen: ServerValue.TIMESTAMP,
      role: payload.role,
      name,
      deviceLabel,
      fingerprint,
      sid: payload.sid,
    }
    if (instanceId) {
      presenceData.instanceId = instanceId
    }

    await database.ref(`rooms/${roomId}/presence/${payload.sid}`).set(presenceData)

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    if (error?.code === 'ECONNRESET' || error?.message === 'aborted') {
      return new Response(null, { status: 499 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const resolvedParams = await params
  const roomId = String(resolvedParams.roomId || '').toLowerCase()
  const payload = await getRoomContext(request, roomId)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { database } = getFirebaseAdmin()
  const forceClose = request.headers.get('x-close-room') === '1'

  // By default DELETE removes only the caller's presence entry. To avoid
  // accidental full-room deletion on page unload (which calls DELETE via
  // keepalive), require an explicit `x-close-room: 1` header and host role to
  // remove the entire room.
  if (!forceClose) {
    await database.ref(`rooms/${roomId}/presence/${payload.sid}`).remove()
    return NextResponse.json({ ok: true })
  }

  if (payload.role !== 'host') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const roomSnapshot = await database.ref(`rooms/${roomId}/meta`).get()
  const meta = roomSnapshot.val()
  if (!meta) return NextResponse.json({ error: 'That room is unavailable' }, { status: 404 })

  await database.ref(`rooms/${roomId}`).remove()

  return NextResponse.json({ ok: true })
}
