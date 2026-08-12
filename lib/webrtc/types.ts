/**
 * lib/webrtc/types.ts
 *
 * Shared TypeScript types and constants for the WebRTC file-transfer system.
 * Consumed by the core library, hooks, and UI components.
 */

// ─── Peer connection status ─────────────────────────────────────────────────

/** Current connection state of a WebRTC peer */
export type PeerStatus = 'connecting' | 'connected' | 'disconnected' | 'failed'

// ─── Transfer protocol messages (sent as JSON over DataChannel) ─────────────

export interface FileTransferMetadata {
  type: 'file-start'
  transferId: string
  fileName: string
  mimeType: string
  size: number
  totalChunks: number
  senderName: string
  category: 'image' | 'video' | 'audio' | 'document' | 'file'
}

export interface FileChunkHeader {
  type: 'file-chunk'
  transferId: string
  index: number
}

export interface FileTransferComplete {
  type: 'file-complete'
  transferId: string
}

export interface FileTransferCancel {
  type: 'file-cancel'
  transferId: string
}

/** Discriminated union of all JSON control messages flowing through the DataChannel. */
export type DataChannelMessage =
  | FileTransferMetadata
  | FileChunkHeader
  | FileTransferComplete
  | FileTransferCancel

// ─── Local transfer state ───────────────────────────────────────────────────

export type TransferDirection = 'sent' | 'received'
export type TransferStatus = 'pending' | 'transferring' | 'completed' | 'failed' | 'cancelled'

export interface Transfer {
  id: string
  batchId?: string
  fileName: string
  fileSize: number
  mimeType: string
  category: 'image' | 'video' | 'audio' | 'document' | 'file'
  direction: TransferDirection
  peerId: string
  peerName: string
  status: TransferStatus
  progress: number
  /** Object URL for completed received files (e.g. image/video preview). */
  objectUrl?: string
  /** Blob for completed received files (used for download). */
  blob?: Blob
  createdAt: number
  error?: string
  /** Optional metrics */
  speed?: number // bytes per second
  eta?: number // seconds remaining
}

// ─── WebRTC signaling messages (stored in Firebase) ─────────────────────────

export interface SignalingOffer {
  type: 'offer'
  sdp: string
}

export interface SignalingAnswer {
  type: 'answer'
  sdp: string
}

export interface SignalingCandidate {
  candidate: string
  sdpMid: string | null
  sdpMLineIndex: number | null
}

export type WebRTCSignalingMessage = SignalingOffer | SignalingAnswer | SignalingCandidate

// ─── Per-peer state tracked by useWebRTC ────────────────────────────────────

export interface PeerConnectionInfo {
  peerId: string
  peerName: string
  status: PeerStatus
  connection: RTCPeerConnection
  channel: RTCDataChannel | null
}
