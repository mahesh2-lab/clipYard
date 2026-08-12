'use client'

import type { Transfer } from '@/lib/webrtc/types'

interface DocumentAttachmentItemProps {
  transfer: Transfer
  onDownload: (transfer: Transfer) => void
}

export function DocumentAttachmentItem({ transfer, onDownload }: DocumentAttachmentItemProps) {
  const getExtension = (fileName: string) => {
    const parts = fileName.split('.')
    if (parts.length < 2) return 'FILE'
    return parts[parts.length - 1].slice(0, 4).toUpperCase()
  }

  const ext = getExtension(transfer.fileName)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDownload(transfer)
  }

  return (
    <div
      className="cy-document-slot"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      title={transfer.fileName}
      aria-label={`Download document ${transfer.fileName}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onDownload(transfer)
        }
      }}
    >
      <svg
        className="cy-doc-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>

      <span className="cy-doc-ext">{ext}</span>

      <button
        type="button"
        className="cy-doc-download-btn"
        onClick={handleClick}
        aria-label={`Download ${transfer.fileName}`}
        tabIndex={-1}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </button>
    </div>
  )
}
