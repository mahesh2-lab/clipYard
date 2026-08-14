export type PeerStatus = 'connecting' | 'connected' | 'disconnected' | 'failed'

// DataChannel JSON messages
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

export type DataChannelMessage =
  | FileTransferMetadata
  | FileChunkHeader
  | FileTransferComplete
  | FileTransferCancel

// Local transfer state
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
  objectUrl?: string
  blob?: Blob
  createdAt: number
  error?: string
  speed?: number
  eta?: number
}

// Signaling payloads
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

export interface PeerConnectionInfo {
  peerId: string
  peerName: string
  status: PeerStatus
  connection: RTCPeerConnection
  channel: RTCDataChannel | null
}
