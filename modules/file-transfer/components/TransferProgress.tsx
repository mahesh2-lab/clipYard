'use client'

import type { CSSProperties } from 'react'

// Props
interface TransferProgressProps {
  progress: number
  bytesSent?: number
  totalBytes: number
  direction: 'sent' | 'received'
  speed?: number
  eta?: number
  onCancel?: () => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatSpeed(bytesPerSec?: number): string {
  if (!bytesPerSec) return ''
  return `${formatBytes(bytesPerSec)}/s`
}

function formatETA(seconds?: number): string {
  if (seconds === undefined || seconds < 0) return ''
  if (seconds < 60) return `${Math.ceil(seconds)}s left`
  return `${Math.ceil(seconds / 60)}m left`
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    width: '100%',
  },
  label: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '12px',
    lineHeight: '16px',
    color: 'var(--cy-text-secondary)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    letterSpacing: '0.02em',
  },
  metrics: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '11px',
    color: 'var(--cy-text-muted)',
  },
  barTrack: {
    width: '100%',
    height: '6px',
    backgroundColor: 'var(--cy-surface-container-high)',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: 'var(--cy-primary)',
    borderRadius: '3px',
    transition: 'width 0.3s ease, box-shadow 0.3s ease',
  },
  cancelBtn: {
    background: 'none',
    border: 'none',
    padding: '2px 6px',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '11px',
    color: 'var(--cy-error)',
    cursor: 'pointer',
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
  },
}

export const TransferProgress = ({
  progress,
  bytesSent,
  totalBytes,
  direction,
  speed,
  eta,
  onCancel,
}: TransferProgressProps) => {
  const clampedProgress = Math.min(100, Math.max(0, progress))
  const sent = bytesSent ?? Math.round((totalBytes * clampedProgress) / 100)

  return (
    <div style={styles.container}>
      <div style={styles.label}>
        <span>
          {direction === 'sent' ? 'Sending…' : 'Receiving…'} {clampedProgress}%
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>
            {formatBytes(sent)} / {formatBytes(totalBytes)}
          </span>
          {direction === 'sent' && onCancel && clampedProgress < 100 && (
            <button
              onClick={onCancel}
              style={styles.cancelBtn}
              type="button"
            >
              Cancel
            </button>
          )}
        </span>
      </div>
      {(speed !== undefined || eta !== undefined) && (
        <div style={styles.metrics}>
          {speed !== undefined && <span>{formatSpeed(speed)}</span>}
          {speed !== undefined && eta !== undefined && <span>·</span>}
          {eta !== undefined && <span>{formatETA(eta)}</span>}
        </div>
      )}
      <div style={styles.barTrack}>
        <div
          style={{
            ...styles.barFill,
            width: `${clampedProgress}%`,
            boxShadow: clampedProgress > 0 && clampedProgress < 100
              ? '0 0 8px var(--cy-primary)'
              : 'none',
          }}
        />
      </div>
    </div>
  )
}
