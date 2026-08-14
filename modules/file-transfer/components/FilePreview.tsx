'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { WebRTCPeer } from '@/hooks/useWebRTC'
import { getFileCategory } from '@/lib/webrtc/fileTransfer'

// Props
interface FilePreviewProps {
  file: File
  onRemove: () => void
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
    transition: 'border-color 0.2s ease',
  },
  imageContainer: {
    width: '100%',
    maxHeight: '140px',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--cy-surface-container)',
    position: 'relative',
  },
  img: {
    maxWidth: '100%',
    maxHeight: '140px',
    objectFit: 'cover',
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  genericIcon: {
    fontSize: '48px',
    color: 'var(--cy-text-muted)',
  },
  meta: {
    padding: '8px 12px',
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
  fileInfo: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '11px',
    lineHeight: '14px',
    color: 'var(--cy-text-muted)',
    letterSpacing: '0.02em',
  },
  actions: {
    display: 'flex',
    padding: '6px 12px',
    borderTop: '1.5px solid var(--cy-border)',
    backgroundColor: 'var(--cy-surface-container)',
  },
  removeBtn: {
    flex: 1,
    backgroundColor: 'transparent',
    color: 'var(--cy-secondary-text)',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '11px',
    letterSpacing: '0.05em',
    fontWeight: 500,
    padding: '6px',
    borderRadius: '4px',
    border: '1.5px solid var(--cy-border)',
    cursor: 'pointer',
    textTransform: 'uppercase',
    transition: 'background-color 0.2s ease',
  },
}

export const FilePreview = ({
  file,
  onRemove,
}: FilePreviewProps) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isHovered, setIsHovered] = useState(false)
  const category = getFileCategory(file.type)
  const urlRef = useRef<string | null>(null)

  useEffect(() => {
    if (category === 'image' || category === 'video') {
      const url = URL.createObjectURL(file)
      urlRef.current = url
      setPreviewUrl(url)
      return () => {
        URL.revokeObjectURL(url)
        urlRef.current = null
      }
    }
  }, [file, category])

  return (
    <div
      style={{
        ...S.card,
        borderColor: isHovered ? 'var(--cy-border-strong)' : 'var(--cy-border)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={S.imageContainer}>
        {previewUrl && category === 'image' ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={previewUrl}
            alt={`Preview of ${file.name}`}
            style={S.img}
          />
        ) : previewUrl && category === 'video' ? (
          <video
            src={previewUrl}
            style={S.img}
          />
        ) : (
          <span className="material-symbols-outlined" style={S.genericIcon}>
            {getIconForCategory(category)}
          </span>
        )}
      </div>

      <div style={S.meta}>
        <div style={S.fileName} title={file.name}>{file.name || 'file'}</div>
        <div style={S.fileInfo}>{formatBytes(file.size)}</div>
      </div>

      <div style={S.actions}>
        <button
          onClick={onRemove}
          style={S.removeBtn}
          type="button"
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--cy-surface-container)' }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
        >
          Remove
        </button>
      </div>
    </div>
  )
}
