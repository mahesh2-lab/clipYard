'use client'

import { useState, type CSSProperties } from 'react'
import type { Transfer } from '@/lib/webrtc/types'
import { TransferProgress } from './TransferProgress'

// Props
interface FileTransferCardProps {
  transfer: Transfer
  onCancel?: (transferId: string) => void
  onRetry?: (transfer: Transfer) => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getIconForCategory(category: string): string {
  switch (category) {
    case 'image': return 'image'
    case 'video': return 'movie'
    case 'document': return 'description'
    default: return 'insert_drive_file'
  }
}

const S: Record<string, CSSProperties> = {
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '12px 16px',
    backgroundColor: 'var(--cy-surface)',
    borderWidth: '1.5px',
    borderStyle: 'solid',
    borderColor: 'var(--cy-border)',
    borderRadius: '4px',
    transition: 'border-color 0.2s ease, transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  icon: {
    fontSize: '18px',
    color: 'var(--cy-text-muted)',
    flexShrink: 0,
  },
  info: {
    flex: 1,
    overflow: 'hidden',
  },
  fileName: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '13px',
    lineHeight: '18px',
    color: 'var(--cy-text)',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  meta: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '11px',
    lineHeight: '14px',
    color: 'var(--cy-text-muted)',
    letterSpacing: '0.02em',
  },
  error: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '12px',
    lineHeight: '16px',
    color: 'var(--cy-error)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  retryBtn: {
    background: 'none',
    border: '1.5px solid var(--cy-border)',
    borderRadius: '4px',
    padding: '4px 10px',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '11px',
    color: 'var(--cy-text-secondary)',
    cursor: 'pointer',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    whiteSpace: 'nowrap',
    transition: 'background-color 0.2s ease',
  },
}

export const FileTransferCard = ({
  transfer,
  onCancel,
  onRetry,
}: FileTransferCardProps) => {
  const [isHovered, setIsHovered] = useState(false)

  const directionLabel = transfer.direction === 'sent'
    ? `To ${transfer.peerName}`
    : `From ${transfer.peerName}`

  return (
    <div
      style={{
        ...S.card,
        borderColor: isHovered ? 'var(--cy-border-strong)' : 'var(--cy-border)',
        transform: isHovered ? 'translateY(-1px)' : 'translateY(0)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={S.header}>
        <span className="material-symbols-outlined" style={S.icon}>
          {getIconForCategory(transfer.category)}
        </span>
        <div style={S.info}>
          <div style={S.fileName} title={transfer.fileName}>
            {transfer.fileName}
          </div>
          <div style={S.meta}>
            {formatBytes(transfer.fileSize)} · {directionLabel}
          </div>
        </div>
      </div>

      {transfer.status === 'transferring' && (
        <TransferProgress
          progress={transfer.progress}
          totalBytes={transfer.fileSize}
          direction={transfer.direction}
          speed={transfer.speed}
          eta={transfer.eta}
          onCancel={
            transfer.direction === 'sent' && onCancel
              ? () => onCancel(transfer.id)
              : undefined
          }
        />
      )}

      {transfer.status === 'failed' && (
        <div style={S.error}>
          <span>{transfer.error || 'Transfer failed'}</span>
          {onRetry && (
            <button
              onClick={() => onRetry(transfer)}
              style={S.retryBtn}
              type="button"
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--cy-surface-container)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {transfer.status === 'cancelled' && (
        <div style={S.meta}>
          <span style={{ color: 'var(--cy-text-muted)' }}>Cancelled</span>
        </div>
      )}
    </div>
  )
}
