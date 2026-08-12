/**
 * lib/webrtc/fileTransfer.ts
 *
 * Chunked file transfer engine for WebRTC DataChannel.
 *
 * Sending: slices a File into chunks with backpressure control.
 * Receiving: collects chunks keyed by transferId and reconstructs a Blob.
 */

'use client'

import {
  type FileTransferMetadata,
  type FileTransferComplete,
  type FileTransferCancel,
  type FileChunkHeader,
  type DataChannelMessage,
} from './types'
import { sendControlMessage } from './dataChannel'
import { FILE_TRANSFER_CONFIG } from './config'

// ─── Validation & Categorization ────────────────────────────────────────────

export function getNormalizedMimeType(file: { type?: string; name?: string }): string {
  if (file.type && file.type.trim() !== '' && file.type !== 'application/octet-stream') {
    return file.type
  }
  const ext = file.name ? file.name.split('.').pop()?.toLowerCase() || '' : ''
  const mimeMap: Record<string, string> = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    ogg: 'audio/ogg',
    oga: 'audio/ogg',
    opus: 'audio/opus',
    flac: 'audio/flac',
    weba: 'audio/webm',
    wma: 'audio/x-ms-wma',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    pdf: 'application/pdf',
    txt: 'text/plain',
    csv: 'text/csv',
  }
  return mimeMap[ext] || file.type || 'application/octet-stream'
}

export function getFileCategory(mimeType: string, fileName?: string): 'image' | 'video' | 'audio' | 'document' | 'file' {
  const normalizedMime = (mimeType || '').toLowerCase()
  const ext = fileName ? fileName.split('.').pop()?.toLowerCase() || '' : ''

  if (
    normalizedMime.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'].includes(ext)
  ) {
    return 'image'
  }

  if (
    normalizedMime.startsWith('video/') ||
    ['mp4', 'webm', 'mov', 'mkv', 'avi', 'wmv', 'flv'].includes(ext)
  ) {
    return 'video'
  }

  if (
    normalizedMime.startsWith('audio/') ||
    ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'oga', 'weba', 'flac', 'opus', 'wma', 'aiff', 'alac', 'mid', 'midi'].includes(ext)
  ) {
    return 'audio'
  }

  if (
    normalizedMime.startsWith('text/') ||
    normalizedMime === 'application/pdf' ||
    normalizedMime.includes('word') ||
    normalizedMime.includes('excel') ||
    normalizedMime.includes('powerpoint') ||
    normalizedMime.includes('document') ||
    normalizedMime.includes('spreadsheet') ||
    normalizedMime.includes('presentation') ||
    normalizedMime === 'text/csv' ||
    ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'rtf', 'odt', 'ods', 'odp'].includes(ext)
  ) {
    return 'document'
  }

  return 'file'
}
  
export function validateFile(file: File): { valid: boolean; error?: string } {
  const category = getFileCategory(file.type, file.name)
  console.log('[FileTransfer] validateFile check:', {
    name: file.name,
    rawType: file.type,
    normalizedType: getNormalizedMimeType(file),
    category,
    size: file.size,
  })
  
  if (!FILE_TRANSFER_CONFIG.ALLOWED_CATEGORIES.includes(category)) {
    const error = `Unsupported file category: ${category}. Allowed: ${FILE_TRANSFER_CONFIG.ALLOWED_CATEGORIES.join(', ')}.`
    console.warn('[FileTransfer] Validation error:', error)
    return {
      valid: false,
      error,
    }
  }

  if (file.size > FILE_TRANSFER_CONFIG.MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1)
    const limitMB = (FILE_TRANSFER_CONFIG.MAX_FILE_SIZE / (1024 * 1024)).toFixed(0)
    const error = `File is too large (${sizeMB} MB). Maximum allowed size is ${limitMB} MB.`
    console.warn('[FileTransfer] Validation error:', error)
    return {
      valid: false,
      error,
    }
  }

  if (file.size === 0) {
    console.warn('[FileTransfer] Validation error: File is empty')
    return { valid: false, error: 'File is empty.' }
  }

  console.log('[FileTransfer] File validation successful:', file.name)
  return { valid: true }
}

// ─── Transfer ID ────────────────────────────────────────────────────────────

export function generateTransferId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

// ─── Sending ────────────────────────────────────────────────────────────────

export interface SendFileOptions {
  channel: RTCDataChannel
  file: File
  transferId: string
  senderName: string
  onProgress?: (bytesSent: number, totalBytes: number) => void
  abortSignal?: AbortSignal
}

/**
 * Send a file over a DataChannel using chunked transfer with backpressure.
 *
 * Protocol:
 *   1. JSON metadata message (file-start)
 *   2. For each chunk: JSON header (file-chunk) + binary ArrayBuffer
 *   3. JSON completion message (file-complete)
 */
export async function sendFile({
  channel,
  file,
  transferId,
  senderName,
  onProgress,
  abortSignal,
}: SendFileOptions): Promise<void> {
  const totalChunks = Math.ceil(file.size / FILE_TRANSFER_CONFIG.CHUNK_SIZE)
  const category = getFileCategory(file.type, file.name)
  const mimeType = getNormalizedMimeType(file)

  console.log('[FileTransfer] Starting sendFile:', {
    transferId,
    fileName: file.name,
    size: file.size,
    category,
    mimeType,
    totalChunks,
    channelLabel: channel.label,
    channelState: channel.readyState,
  })

  // 1. Send metadata
  const metadata: FileTransferMetadata = {
    type: 'file-start',
    transferId,
    fileName: file.name || 'file',
    mimeType,
    size: file.size,
    totalChunks,
    senderName,
    category,
  }
  console.log('[FileTransfer] Sending file-start control message:', metadata)
  sendControlMessage(channel, metadata)

  let offset = 0
  let chunkIndex = 0

  while (offset < file.size) {
    // Check for cancellation
    if (abortSignal?.aborted) {
      console.warn('[FileTransfer] Send aborted by user for transferId:', transferId)
      const cancel: FileTransferCancel = { type: 'file-cancel', transferId }
      sendControlMessage(channel, cancel)
      throw new DOMException('Transfer cancelled', 'AbortError')
    }

    // Check channel state
    if (channel.readyState !== 'open') {
      console.error('[FileTransfer] DataChannel closed during transfer:', { transferId, state: channel.readyState })
      throw new Error('DataChannel closed during transfer')
    }

    // Backpressure: wait if buffer is too full
    // 2MB backpressure threshold limit
    const MAX_BUFFERED_AMOUNT = 2 * 1024 * 1024
    if (channel.bufferedAmount > MAX_BUFFERED_AMOUNT) {
      console.log(`[FileTransfer] Backpressure buffer full (${channel.bufferedAmount} bytes). Waiting for drain...`)
      await waitForBufferDrain(channel, MAX_BUFFERED_AMOUNT)
      console.log(`[FileTransfer] Buffer drained. Continuing transfer for ${transferId}...`)
    }

    const end = Math.min(offset + FILE_TRANSFER_CONFIG.CHUNK_SIZE, file.size)
    const chunkBlob = file.slice(offset, end)
    const chunkData = await chunkBlob.arrayBuffer()

    // Send chunk header (JSON)
    const chunkHeader: FileChunkHeader = {
      type: 'file-chunk',
      transferId,
      index: chunkIndex,
    }
    sendControlMessage(channel, chunkHeader)

    // Send chunk data (binary)
    channel.send(chunkData)

    offset = end
    chunkIndex++
    if (chunkIndex === 1 || chunkIndex === totalChunks || chunkIndex % 20 === 0) {
      console.log(`[FileTransfer] Sent chunk ${chunkIndex}/${totalChunks} (${offset}/${file.size} bytes) for ${transferId}`)
    }
    onProgress?.(offset, file.size)
  }

  // 3. Send completion
  const complete: FileTransferComplete = { type: 'file-complete', transferId }
  console.log('[FileTransfer] Sending file-complete control message:', complete)
  sendControlMessage(channel, complete)
  console.log('[FileTransfer] File transfer finished successfully:', { transferId, fileName: file.name })
}

/**
 * Returns a promise that resolves when the DataChannel's bufferedAmount
 * drops below the threshold, using the `bufferedamountlow` event.
 * Times out after 30 seconds to prevent hanging on a stalled channel.
 */
function waitForBufferDrain(channel: RTCDataChannel, maxBufferedAmount: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    channel.bufferedAmountLowThreshold = maxBufferedAmount / 2

    let settled = false
    const settle = (fn: () => void) => {
      if (settled) return
      settled = true
      clearInterval(pollTimer)
      clearTimeout(timeoutTimer)
      channel.removeEventListener('bufferedamountlow', handler)
      fn()
    }

    const handler = () => settle(resolve)
    channel.addEventListener('bufferedamountlow', handler)

    // Fallback: poll in case the bufferedamountlow event doesn't fire (some browser edge cases)
    const pollTimer = setInterval(() => {
      if (channel.bufferedAmount <= maxBufferedAmount / 2) {
        settle(resolve)
      }
    }, 100)

    // Safety timeout: if drain takes >30s the channel is effectively dead
    const timeoutTimer = setTimeout(() => {
      settle(() => reject(new Error('DataChannel buffer drain timed out after 30s')))
    }, 30_000)
  })
}

// ─── Receiving ──────────────────────────────────────────────────────────────

export interface IncomingTransfer {
  metadata: FileTransferMetadata
  chunks: ArrayBuffer[]
  receivedChunks: number
  bytesReceived: number
  /** The next expected chunk header (index). */
  nextExpectedIndex: number
}

export interface FileReceiverCallbacks {
  onTransferStart: (metadata: FileTransferMetadata) => void
  onProgress: (transferId: string, bytesReceived: number, totalBytes: number) => void
  onComplete: (transferId: string, blob: Blob, metadata: FileTransferMetadata) => void
  onError: (transferId: string, error: string) => void
  onCancelled: (transferId: string) => void
}

/**
 * Stateful receiver that collects incoming chunks and reconstructs files.
 * Create one instance per peer DataChannel.
 */
export class FileReceiver {
  private transfers = new Map<string, IncomingTransfer>()
  /** Tracks whether we're expecting a binary chunk for a specific transferId. */
  private pendingBinaryFor: string | null = null
  private callbacks: FileReceiverCallbacks

  constructor(callbacks: FileReceiverCallbacks) {
    this.callbacks = callbacks
  }

  /**
   * Handle an incoming control message.
   */
  handleControlMessage(message: DataChannelMessage): void {
    console.log('[FileReceiver] Received control message:', message.type, message)
    switch (message.type) {
      case 'file-start':
        this.handleStart(message as unknown as FileTransferMetadata)
        break
      case 'file-chunk':
        this.handleChunkHeader(message as unknown as FileChunkHeader)
        break
      case 'file-complete':
        this.handleComplete(message as unknown as FileTransferComplete)
        break
      case 'file-cancel':
        this.handleCancel(message as unknown as FileTransferCancel)
        break
    }
  }

  /**
   * Handle incoming binary data (a chunk payload).
   */
  handleBinaryData(data: ArrayBuffer): void {
    const transferId = this.pendingBinaryFor
    if (!transferId) {
      console.warn('[FileReceiver] Received binary data without pending chunk header (size:', data.byteLength, ')')
      return
    }
    this.pendingBinaryFor = null

    const transfer = this.transfers.get(transferId)
    if (!transfer) {
      console.warn(`[FileReceiver] No active transfer found for id: ${transferId}`)
      return
    }

    transfer.chunks.push(data)
    transfer.receivedChunks++
    transfer.bytesReceived += data.byteLength

    if (transfer.receivedChunks === 1 || transfer.receivedChunks === transfer.metadata.totalChunks || transfer.receivedChunks % 20 === 0) {
      console.log(`[FileReceiver] Received chunk ${transfer.receivedChunks}/${transfer.metadata.totalChunks} (${transfer.bytesReceived}/${transfer.metadata.size} bytes) for ${transferId}`)
    }

    this.callbacks.onProgress(
      transferId,
      transfer.bytesReceived,
      transfer.metadata.size,
    )
  }

  /**
   * Clean up all active transfers. Called when the channel closes.
   */
  cleanup(): void {
    console.log('[FileReceiver] Cleaning up receiver active transfers:', Array.from(this.transfers.keys()))
    for (const [transferId] of this.transfers) {
      this.callbacks.onError(transferId, 'Connection lost during transfer')
    }
    this.transfers.clear()
    this.pendingBinaryFor = null
  }

  private handleStart(metadata: FileTransferMetadata): void {
    console.log('[FileReceiver] Starting incoming transfer:', metadata)
    // Guard against duplicate transfer IDs
    if (this.transfers.has(metadata.transferId)) {
      console.warn(`[FileReceiver] Duplicate transferId received: ${metadata.transferId}`)
      return
    }

    this.transfers.set(metadata.transferId, {
      metadata,
      chunks: [],
      receivedChunks: 0,
      bytesReceived: 0,
      nextExpectedIndex: 0,
    })

    this.callbacks.onTransferStart(metadata)
  }

  private handleChunkHeader(header: FileChunkHeader): void {
    const transfer = this.transfers.get(header.transferId)
    if (!transfer) {
      console.warn(`[FileReceiver] Chunk header for unknown transfer: ${header.transferId}`)
      return
    }
    // Mark that the next binary message belongs to this transfer
    this.pendingBinaryFor = header.transferId
    transfer.nextExpectedIndex = header.index + 1
  }

  private handleComplete(msg: FileTransferComplete): void {
    console.log('[FileReceiver] Received file-complete for transferId:', msg.transferId)
    const transfer = this.transfers.get(msg.transferId)
    if (!transfer) {
      console.warn('[FileReceiver] file-complete for unknown transfer:', msg.transferId)
      return
    }

    try {
      const blob = new Blob(transfer.chunks, { type: transfer.metadata.mimeType })
      console.log('[FileReceiver] Assembled file Blob:', {
        transferId: msg.transferId,
        fileName: transfer.metadata.fileName,
        size: blob.size,
        mimeType: blob.type,
        category: transfer.metadata.category,
      })

      // Clear chunks from memory quickly after blob creation
      transfer.chunks = []
      this.transfers.delete(msg.transferId)

      this.callbacks.onComplete(msg.transferId, blob, transfer.metadata)
    } catch (err) {
      console.error('[FileReceiver] Error creating blob:', err)
      this.callbacks.onError(msg.transferId, 'Failed to assemble file - it may be too large for browser memory')
      this.transfers.delete(msg.transferId)
    }
  }

  private handleCancel(msg: FileTransferCancel): void {
    console.log('[FileReceiver] Handling file-cancel for transferId:', msg.transferId)
    if (this.transfers.has(msg.transferId)) {
      this.transfers.delete(msg.transferId)
      this.callbacks.onCancelled(msg.transferId)
    }
  }
}
