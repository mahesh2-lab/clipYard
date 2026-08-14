'use client'

import { getFirebaseServices } from '@/lib/firebase-client'
import {
  ref,
  set,
  push,
  remove,
  onValue,
  onChildAdded,
  type Unsubscribe,
} from 'firebase/database'
import type { SignalingOffer, SignalingAnswer, SignalingCandidate } from './types'

// Firebase signaling path helper
function signalingPath(roomId: string, fromUid: string, toUid: string) {
  return `rooms/${roomId}/presence/${fromUid}/signalingOutbox/${toUid}`
}

export async function clearSignalingOutbox(roomId: string, fromUid: string, toUid: string): Promise<void> {
  const { database } = getFirebaseServices()
  const outboxRef = ref(database, signalingPath(roomId, fromUid, toUid))
  await remove(outboxRef).catch(() => undefined)
}

export async function sendOffer(
  roomId: string,
  fromUid: string,
  toUid: string,
  sdp: string,
): Promise<void> {
  const { database } = getFirebaseServices()
  const offerRef = ref(database, `${signalingPath(roomId, fromUid, toUid)}/offer`)
  await set(offerRef, { type: 'offer', sdp } satisfies SignalingOffer)
}

export async function sendAnswer(
  roomId: string,
  fromUid: string,
  toUid: string,
  sdp: string,
): Promise<void> {
  const { database } = getFirebaseServices()
  const answerRef = ref(database, `${signalingPath(roomId, fromUid, toUid)}/answer`)
  await set(answerRef, { type: 'answer', sdp } satisfies SignalingAnswer)
}

export async function sendCandidate(
  roomId: string,
  fromUid: string,
  toUid: string,
  candidate: RTCIceCandidate,
): Promise<void> {
  const { database } = getFirebaseServices()
  const candidatesRef = ref(database, `${signalingPath(roomId, fromUid, toUid)}/candidates`)
  await push(candidatesRef, {
    candidate: candidate.candidate,
    sdpMid: candidate.sdpMid,
    sdpMLineIndex: candidate.sdpMLineIndex,
  } satisfies SignalingCandidate)
}

export function listenForOffer(
  roomId: string,
  localUid: string,
  remoteUid: string,
  callback: (offer: SignalingOffer) => void,
): Unsubscribe {
  const { database } = getFirebaseServices()
  const offerRef = ref(database, `${signalingPath(roomId, remoteUid, localUid)}/offer`)
  return onValue(offerRef, (snapshot) => {
    const data = snapshot.val()
    if (data && data.type === 'offer' && typeof data.sdp === 'string') {
      callback(data as SignalingOffer)
    }
  })
}

export function listenForAnswer(
  roomId: string,
  localUid: string,
  remoteUid: string,
  callback: (answer: SignalingAnswer) => void,
): Unsubscribe {
  const { database } = getFirebaseServices()
  const answerRef = ref(database, `${signalingPath(roomId, remoteUid, localUid)}/answer`)
  return onValue(answerRef, (snapshot) => {
    const data = snapshot.val()
    if (data && data.type === 'answer' && typeof data.sdp === 'string') {
      callback(data as SignalingAnswer)
    }
  })
}

export function listenForCandidates(
  roomId: string,
  localUid: string,
  remoteUid: string,
  callback: (candidate: SignalingCandidate) => void,
): Unsubscribe {
  const { database } = getFirebaseServices()
  const candidatesRef = ref(
    database,
    `${signalingPath(roomId, remoteUid, localUid)}/candidates`,
  )
  return onChildAdded(candidatesRef, (snapshot) => {
    const data = snapshot.val()
    if (data && typeof data.candidate === 'string') {
      callback(data as SignalingCandidate)
    }
  })
}

// Cleanup signaling on disconnect
export async function cleanupSignaling(roomId: string, uid: string): Promise<void> {
  const { database } = getFirebaseServices()
  const outgoingRef = ref(database, `rooms/${roomId}/presence/${uid}/signalingOutbox`)
  await remove(outgoingRef).catch(() => undefined)
}

export async function cleanupPeerSignaling(
  roomId: string,
  localUid: string,
  remoteUid: string,
): Promise<void> {
  const { database } = getFirebaseServices()
  await Promise.all([
    remove(ref(database, `${signalingPath(roomId, localUid, remoteUid)}`)).catch(() => undefined),
    remove(ref(database, `${signalingPath(roomId, remoteUid, localUid)}`)).catch(() => undefined),
  ])
}
