'use client'

import { useCallback, useState, type CSSProperties } from 'react'
import { useFileTransfer } from '../hooks/useFileTransfer'
import { FileUploader } from './FileUploader'
import { FilePreview } from './FilePreview'
import { FileTransferCard } from './FileTransferCard'
import { ReceivedFileCard } from './ReceivedFileCard'
import { FileModal } from './FileModal'
import type { Transfer } from '@/lib/webrtc/types'
import { FILE_TRANSFER_CONFIG } from '@/lib/webrtc/config'

// Props
interface FileSharePanelProps {
  roomId: string
  localUid: string
  localName: string
  presence: Record<string, { name?: string; sid?: string; [key: string]: unknown }>
}

const S: Record<string, CSSProperties> = {
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  title: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '14px',
    lineHeight: '20px',
    letterSpacing: '0.08em',
    fontWeight: 500,
    color: 'var(--cy-text)',
    textTransform: 'uppercase',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '11px',
    lineHeight: '14px',
    letterSpacing: '0.04em',
    padding: '3px 10px',
    borderRadius: '2px',
    border: '1.5px solid var(--cy-border)',
    backgroundColor: 'var(--cy-surface-container)',
    color: 'var(--cy-text-secondary)',
    textTransform: 'uppercase',
  },
  dot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  unsupported: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '13px',
    lineHeight: '18px',
    color: 'var(--cy-text-secondary)',
    textAlign: 'center',
    padding: '24px 16px',
    backgroundColor: 'var(--cy-surface)',
    border: '1.5px solid var(--cy-border)',
    borderRadius: '4px',
  },
  transfersSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  subTitle: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '11px',
    lineHeight: '14px',
    letterSpacing: '0.08em',
    fontWeight: 500,
    color: 'var(--cy-text-muted)',
    textTransform: 'uppercase',
  },
  receivedGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '12px',
  },
  error: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '12px',
    lineHeight: '16px',
    color: 'var(--cy-error)',
    padding: '8px 12px',
    backgroundColor: 'var(--cy-surface)',
    border: '1.5px solid var(--cy-error)',
    borderRadius: '4px',
  },
  previewGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: '12px',
  },
}

export const FileSharePanel = ({
  roomId,
  localUid,
  localName,
  presence,
}: FileSharePanelProps) => {
  const {
    transfers,
    peers,
    isSupported,
    sendFile,
    cancelTransfer,
    downloadFile,
    connectedPeerCount,
  } = useFileTransfer({
    roomId,
    localUid,
    localName,
    presence,
    enabled: true,
  })

  // We could stage multiple files, but for simplicity of the prompt,
  // queueFile directly handles it in useFileTransfer. However, the user might want to 
  // review them first like before. But in FileUploader we added multiple. Let's send directly on drop for testing ease, or hold in state?
  // Let's hold in state if they want. Or just send immediately for better UX. Let's send immediately.
  const handleFileSelected = useCallback((file: File) => {
    sendFile(file)
  }, [sendFile])

  const [viewingFile, setViewingFile] = useState<Transfer | null>(null)

  const handleCancelBatch = useCallback((batchId: string) => {
    transfers.filter((t) => t.batchId === batchId || t.id === batchId).forEach((t) => {
      cancelTransfer(t.id)
    })
  }, [transfers, cancelTransfer])

  // Categorize transfers
  const activeTransfers = transfers.filter(
    (t) => t.status === 'transferring' || t.status === 'pending',
  )
  const completedReceived = transfers.filter(
    (t) => t.status === 'completed' && t.direction === 'received',
  )
  const failedTransfers = transfers.filter((t) => t.status === 'failed')
  
  // Aggregate completed sent transfers by batchId so the summary count is accurate
  const completedSent = transfers.filter(
    (t) => t.status === 'completed' && t.direction === 'sent',
  )
  const uniqueCompletedSentBatches = new Set(
    completedSent.map((t) => t.batchId || t.id)
  )

  // Group active sent transfers by batchId
  const activeSentGroups = new Map<string, Transfer[]>()
  const activeReceived: Transfer[] = []
  
  for (const t of activeTransfers) {
    if (t.direction === 'sent') {
      const bId = t.batchId || t.id
      const group = activeSentGroups.get(bId) || []
      group.push(t)
      activeSentGroups.set(bId, group)
    } else {
      activeReceived.push(t)
    }
  }

  // Create aggregated transfers for rendering
  const aggregatedActiveTransfers = [
    ...activeReceived,
    ...Array.from(activeSentGroups.values()).map(group => {
      // Calculate aggregate progress
      const totalProgress = group.reduce((sum, t) => sum + t.progress, 0)
      const avgProgress = Math.round(totalProgress / group.length)
      
      // Calculate max eta and sum speed
      const totalSpeed = group.reduce((sum, t) => sum + (t.speed || 0), 0)
      const maxEta = Math.max(...group.map(t => t.eta || 0), 0)

      return {
        ...group[0],
        id: group[0].batchId || group[0].id, 
        progress: avgProgress,
        speed: totalSpeed > 0 ? totalSpeed : undefined,
        eta: maxEta > 0 ? maxEta : undefined,
        peerName: `Everyone (${group.length})`,
      }
    })
  ]

  // Connection status
  const hasAnyPeer = peers.length > 0
  const statusColor = connectedPeerCount > 0
    ? 'var(--cy-primary)'
    : hasAnyPeer
      ? 'var(--cy-warning)'
      : 'var(--cy-text-muted)'
  const statusLabel = connectedPeerCount > 0
    ? `P2P Connected (${connectedPeerCount})`
    : hasAnyPeer
      ? 'Connecting…'
      : 'Waiting for peers'

  if (!isSupported) {
    return (
      <div style={S.section}>
        <div style={S.title}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--cy-text-secondary)' }}>
            folder_zip
          </span>
          File Sharing
        </div>
        <div style={S.unsupported}>
          Your browser does not support peer-to-peer file sharing.
        </div>
      </div>
    )
  }

  return (
    <div style={S.section}>
      {/* Header */}
      <div style={S.sectionHeader}>
        <div style={S.title}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--cy-text-secondary)' }}>
            folder_zip
          </span>
          File Sharing
        </div>
        <div style={S.statusBadge}>
          <div style={{ ...S.dot, backgroundColor: statusColor }} />
          {statusLabel}
        </div>
      </div>

      {/* Uploader */}
      <FileUploader
        onFileSelected={handleFileSelected}
      />

      {/* Active transfers */}
      {aggregatedActiveTransfers.length > 0 && (
        <div style={S.transfersSection}>
          <div style={S.subTitle}>Active Transfers</div>
          {aggregatedActiveTransfers.map((t) => (
            <FileTransferCard
              key={t.id}
              transfer={t}
              onCancel={t.direction === 'sent' ? handleCancelBatch : cancelTransfer}
            />
          ))}
        </div>
      )}

      {/* Failed transfers */}
      {failedTransfers.length > 0 && (
        <div style={S.transfersSection}>
          {failedTransfers.map((t) => (
            <FileTransferCard
              key={t.id}
              transfer={t}
            />
          ))}
        </div>
      )}

      {/* Received files */}
      {completedReceived.length > 0 && (
        <div style={S.transfersSection}>
          <div style={S.subTitle}>Received Files</div>
          <div style={S.receivedGrid}>
            {completedReceived.map((t) => (
              <ReceivedFileCard
                key={t.id}
                transfer={t}
                onDownload={downloadFile}
                onView={setViewingFile}
              />
            ))}
          </div>
        </div>
      )}

      {/* Sent summary */}
      {uniqueCompletedSentBatches.size > 0 && (
        <div style={S.transfersSection}>
          <div style={S.subTitle}>
            {uniqueCompletedSentBatches.size} file{uniqueCompletedSentBatches.size !== 1 ? 's' : ''} sent
          </div>
        </div>
      )}

      {/* Full screen modal */}
      {viewingFile && viewingFile.objectUrl && (
        <FileModal
          url={viewingFile.objectUrl}
          fileName={viewingFile.fileName}
          mimeType={viewingFile.mimeType}
          onClose={() => setViewingFile(null)}
        />
      )}
    </div>
  )
}
