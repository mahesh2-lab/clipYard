'use client'

import { useState, type CSSProperties } from 'react'
import type { Transfer } from '@/lib/webrtc/types'

// Props
interface ReceivedFileCardProps {
  transfer: Transfer
  onDownload: (transfer: Transfer) => void
  onView: (transfer: Transfer) => void
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
    backgroundColor: 'var(--cy-surface)',
    borderWidth: '1.5px',
    borderStyle: 'solid',
    borderColor: 'var(--cy-border)',
    borderRadius: '4px',
    overflow: 'hidden',
    transition: 'border-color 0.2s ease, transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  previewContainer: {
    width: '100%',
    height: '140px',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--cy-surface-container)',
    cursor: 'pointer',
    position: 'relative',
  },
  previewMedia: {
    maxWidth: '100%',
    maxHeight: '140px',
    objectFit: 'cover',
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  genericIcon: {
    fontSize: '48px',
    color: 'var(--cy-text-muted)',
  },
  body: {
    padding: '10px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
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
  actions: {
    display: 'flex',
    gap: '6px',
    padding: '8px 14px',
    borderTop: '1.5px solid var(--cy-border)',
    backgroundColor: 'var(--cy-surface-container)',
  },
  actionBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    backgroundColor: 'var(--cy-primary)',
    color: 'var(--cy-on-primary)',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '11px',
    letterSpacing: '0.05em',
    fontWeight: 500,
    padding: '6px 12px',
    borderRadius: '4px',
    border: '1.5px solid var(--cy-primary)',
    cursor: 'pointer',
    textTransform: 'uppercase',
    transition: 'background-color 0.2s ease',
  },
  secondaryBtn: {
    backgroundColor: 'transparent',
    color: 'var(--cy-secondary-text)',
    borderColor: 'var(--cy-border)',
  }
}

export const ReceivedFileCard = ({
  transfer,
  onDownload,
  onView,
}: ReceivedFileCardProps) => {
  const [isHovered, setIsHovered] = useState(false)
  const [isPreviewHovered, setIsPreviewHovered] = useState(false)

  const handleOpen = () => {
    if (transfer.category === 'image' || transfer.category === 'video') {
      onView(transfer)
    } else {
      onDownload(transfer) // Documents/Files usually just download on click
    }
  }

  return (
    <div
      style={{
        ...S.card,
        borderColor: isHovered ? 'var(--cy-border-strong)' : 'var(--cy-border)',
        transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        style={S.previewContainer}
        onClick={handleOpen}
        title={transfer.category === 'image' || transfer.category === 'video' ? "Click to open full size" : "Click to download"}
        onMouseEnter={() => setIsPreviewHovered(true)}
        onMouseLeave={() => setIsPreviewHovered(false)}
      >
        {transfer.objectUrl && transfer.category === 'image' ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={transfer.objectUrl}
            alt={transfer.fileName}
            style={{
              ...S.previewMedia,
              transform: isPreviewHovered ? 'scale(1.05)' : 'scale(1)',
            }}
          />
        ) : transfer.objectUrl && transfer.category === 'video' ? (
          <video
            src={transfer.objectUrl}
            style={{
              ...S.previewMedia,
              transform: isPreviewHovered ? 'scale(1.05)' : 'scale(1)',
            }}
          />
        ) : (
          <span className="material-symbols-outlined" style={{
            ...S.genericIcon,
            transform: isPreviewHovered ? 'scale(1.1)' : 'scale(1)',
            transition: 'transform 0.3s ease',
          }}>
            {getIconForCategory(transfer.category)}
          </span>
        )}
      </div>

      <div style={S.body}>
        <div style={S.fileName} title={transfer.fileName}>
          {transfer.fileName}
        </div>
        <div style={S.meta}>
          {formatBytes(transfer.fileSize)} · From {transfer.peerName}
        </div>
      </div>

      <div style={S.actions}>
        <button
          onClick={() => onDownload(transfer)}
          style={S.actionBtn}
          type="button"
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--cy-primary-hover)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--cy-primary)'
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
            download
          </span>
          Download
        </button>
        {(transfer.category === 'image' || transfer.category === 'video') && (
          <button
            onClick={handleOpen}
            style={{ ...S.actionBtn, ...S.secondaryBtn }}
            type="button"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--cy-surface-container)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
              open_in_new
            </span>
            Open
          </button>
        )}
      </div>
    </div>
  )
}
