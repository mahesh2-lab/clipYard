'use client'

import type { DataChannelMessage } from './types'

const CHANNEL_LABEL = 'file-transfer'

// Initiator channel setup
export function createImageChannel(pc: RTCPeerConnection): RTCDataChannel {
  const channel = pc.createDataChannel(CHANNEL_LABEL, { ordered: true })
  channel.binaryType = 'arraybuffer'
  return channel
}

// Receiver channel setup
export function setupReceivedChannel(channel: RTCDataChannel): void {
  channel.binaryType = 'arraybuffer'
}

// Send control messages over the data channel
export function sendControlMessage(
  channel: RTCDataChannel,
  message: DataChannelMessage,
): void {
  channel.send(JSON.stringify(message))
}

// Parse string control JSON vs binary chunk data
export function parseIncomingMessage(
  data: string | ArrayBuffer,
):
  | { kind: 'control'; message: DataChannelMessage }
  | { kind: 'binary'; data: ArrayBuffer } {
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data) as DataChannelMessage
      return { kind: 'control', message: parsed }
    } catch {
      console.warn('[WebRTC] Received unparseable string message')
      return { kind: 'control', message: { type: 'file-cancel', transferId: '' } }
    }
  }
  return { kind: 'binary', data }
}
