'use client'

import Image from 'next/image'
import { useFileTransfer } from '@/modules/file-transfer'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useDebounce } from 'use-debounce'
import { QRCodeSVG } from 'qrcode.react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useTheme } from '@/components/ThemeProvider'
import { AudioAttachmentItem } from '@/components/AudioAttachmentItem'
import { DocumentAttachmentItem } from '@/components/DocumentAttachmentItem'
import { AudioPlayerDialog } from '@/components/AudioPlayerDialog'
import { CameraCaptureDialog } from '@/components/CameraCaptureDialog'
import type { DecodedAudioData } from '@/lib/audioWaveform'
import type { Transfer } from '@/lib/webrtc/types'
import {
  type Device,
  type RoomLiveState,
  type RoomRole,
  type RoomSnapshot,
  clearCachedToken,
  clearStoredHostFingerprint,
  clearUsername,
  closeRoom,
  fetchRoomSnapshot,
  getDeviceLabel,
  getParticipantPlaceholders,
  getRoomToken,
  getRoomUrl,
  getSavedUsername,
  getStoredHostFingerprint,
  isValidRoomId,
  saveText,
  saveUsername,
  sendLeaveBeacon,
  sendPresence,
  setStoredHostFingerprint,
  signInToFirebaseRoom,
  setupRoomPresenceOnDisconnect,
  subscribeToRoomClipUpdatedAt,
  subscribeToRoomPresence,
  subscribeToRoomStatus,
} from '@/services/room'
import { getLocalFingerprint } from '@/services/fingerprint'
import { PRESENCE_LIFESPAN_MS } from '@/lib/presence'
import { getFirebaseServices } from '@/lib/firebase-client'
import { cleanupSignaling } from '@/lib/webrtc/signaling'


/* ─────────────────────────────── styles ─────────────────────────────── */

const S = {
  /* layout */
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    fontFamily: 'Hanken Grotesk, sans-serif',
    color: 'var(--cy-text)',
    fontSize: '16px',
    lineHeight: '24px',
    WebkitFontSmoothing: 'antialiased',
  },
  /* header */
  header: {
    backgroundColor: 'var(--cy-surface)',
    borderBottom: '1.5px solid var(--cy-border-strong)',
    width: '100%',
    minHeight: '64px',
    padding: '12px 24px',
    maxWidth: '1280px',
    margin: '0 auto',
    boxSizing: 'border-box' as const,
  },
  logo: {
    fontFamily: 'Hanken Grotesk, sans-serif',
    fontSize: '24px',
    lineHeight: '32px',
    letterSpacing: '-0.01em',
    fontWeight: 700,
    color: 'var(--cy-primary-text)',
  },
  roomBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: 'var(--cy-surface-container)',
    padding: '4px 12px',
    borderRadius: '2px',
    border: '1.5px solid var(--cy-border)',
  },
  roomBadgeLabel: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '13px',
    lineHeight: '18px',
    color: 'var(--cy-text-secondary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  roomBadgeId: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '14px',
    lineHeight: '20px',
    letterSpacing: '0.02em',
    fontWeight: 500,
    color: 'var(--cy-text)',
  },
  connectedDot: { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--cy-primary)' },
  connectedLabel: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '13px',
    lineHeight: '18px',
    color: 'var(--cy-text-secondary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.02em',
  },
  shareBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    backgroundColor: 'transparent',
    border: '1.5px solid var(--cy-border)',
    borderRadius: '2px',
    color: 'var(--cy-text)',
    cursor: 'pointer',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '14px',
    letterSpacing: '0.02em',
    fontWeight: 500,
    transition: 'background-color 0.2s ease',
    whiteSpace: 'nowrap' as const,
  },
  /* main grid */
  main: {
    flexGrow: 1,
    maxWidth: '1280px',
    margin: '0 auto',
    width: '100%',
    padding: '32px 24px',
    gap: '24px',
    boxSizing: 'border-box' as const,
  },
  /* editor column */
  editorCol: { display: 'flex', flexDirection: 'column' as const, gap: '24px' },
  editorCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    backgroundColor: 'var(--cy-surface)',
    borderRadius: '4px',
    border: '1.5px solid var(--cy-border)',
    overflow: 'visible',
    boxShadow: '0 1px 2px 0 var(--cy-shadow)',
  },
  editorBody: {
    position: 'relative' as const,
    overflow: 'visible' as const,
  },
  textarea: {
    width: '100%',
    padding: '16px 16px 120px 16px',
    resize: 'none' as const,
    outline: 'none',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '13px',
    lineHeight: '20px',
    color: 'var(--cy-text)',
    backgroundColor: 'transparent',
    border: 'none',
    minHeight: '300px',
    height: '600px',
    maxHeight: '80vh',
    boxSizing: 'border-box' as const,
  },
  editorFooter: {
    padding: '10px 18px',
    borderTop: '1.5px solid var(--cy-border)',
    backgroundColor: 'var(--cy-surface-container)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '11px',
    lineHeight: '18px',
    color: 'var(--cy-text-secondary)',
    flexWrap: 'wrap' as const,
    gap: '10px',
    borderBottomLeftRadius: '3px',
    borderBottomRightRadius: '3px',
  },
  syncedDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: 'var(--cy-primary)',
    boxShadow: '0 0 6px var(--cy-primary)',
    transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
  },
  mediaDock: {
    position: 'relative' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-start',
    gap: '0',
    zIndex: 95,
  },
  mediaMenuOverlay: {
    position: 'fixed' as const,
    inset: '0',
    zIndex: 90,
    backgroundColor: 'transparent',
  },
  mediaOverlayRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  mediaStrip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    maxWidth: '360px',
    overflow: 'visible' as const,
    paddingBottom: '2px',
  },
  mediaMenuTrigger: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0',
    height: '40px',
    width: '40px',
    padding: '0',
    borderRadius: '8px',
    border: '1.5px solid var(--cy-border)',
    backgroundColor: 'var(--cy-surface-white)',
    color: 'var(--cy-text)',
    cursor: 'pointer',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '13px',
    letterSpacing: '0.04em',
    fontWeight: 500,
    textTransform: 'uppercase' as const,
    whiteSpace: 'nowrap' as const,
  },
  mediaThumbButton: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    border: '1.5px solid var(--cy-border)',
    backgroundColor: 'var(--cy-surface-white)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0',
    cursor: 'pointer',
    overflow: 'hidden',
    flexShrink: 0,
  },
  mediaImageThumbWrap: {
    position: 'relative' as const,
    width: '40px',
    height: '40px',
    flexShrink: 0,
    overflow: 'visible',
  },
  mediaUploadingThumb: {
    position: 'relative' as const,
    cursor: 'default',
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    border: '1.5px solid var(--cy-border)',
    backgroundColor: 'var(--cy-surface-white)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0',
    overflow: 'hidden',
    flexShrink: 0,
  },
  mediaDivider: {
    width: '1px',
    height: '24px',
    backgroundColor: 'var(--cy-border)',
    margin: '0 4px',
    flexShrink: 0,
    alignSelf: 'center' as const,
  },
  mediaProgressOverlay: {
    position: 'absolute' as const,
    inset: '0',
    display: 'grid',
    placeItems: 'center',
    backgroundColor: 'rgb(0 0 0 / 0.45)',
    pointerEvents: 'none' as const,
    borderRadius: '6px',
  },
  mediaProgressSvg: {
    width: '28px',
    height: '28px',
    transform: 'rotate(-90deg)',
  },
  mediaProgressLabel: {
    position: 'absolute' as const,
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '8px',
    fontWeight: 600,
    letterSpacing: '0.02em',
    color: '#fff',
  },
  mediaThumbImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
  },
  mediaDocThumb: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
    lineHeight: 1,
  },
  mediaDocExt: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '8px',
    letterSpacing: '0.04em',
    color: 'var(--cy-text-muted)',
    textTransform: 'uppercase' as const,
  },
  mediaDocDownloadBtn: {
    position: 'absolute' as const,
    inset: '0',
    width: '100%',
    height: '100%',
    border: 'none',
    backgroundColor: 'rgb(0 0 0 / 0.55)',
    color: '#fff',
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
  },
  mediaDialogOverlay: {
    position: 'fixed' as const,
    inset: '0',
    backgroundColor: 'rgb(0 0 0 / 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 60,
  },
  mediaDialogBox: {
    position: 'relative' as const,
    backgroundColor: 'var(--cy-surface)',
    border: '1.5px solid var(--cy-border)',
    borderRadius: '8px',
    padding: '12px',
    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.2), 0 4px 6px -4px rgb(0 0 0 / 0.2)',
    maxWidth: '90vw',
    maxHeight: '90vh',
  },
  mediaDialogImage: {
    display: 'block',
    maxWidth: '80vw',
    maxHeight: '80vh',
    borderRadius: '4px',
    objectFit: 'contain' as const,
  },
  mediaDialogClose: {
    position: 'absolute' as const,
    top: '-12px',
    right: '-12px',
    width: '28px',
    height: '28px',
    borderRadius: '9999px',
    border: '1.5px solid var(--cy-border)',
    backgroundColor: 'var(--cy-surface)',
    color: 'var(--cy-text)',
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
  },
  mediaDialogDownload: {
    position: 'absolute' as const,
    top: '-12px',
    left: '-12px',
    width: '28px',
    height: '28px',
    borderRadius: '9999px',
    border: '1.5px solid var(--cy-border)',
    backgroundColor: 'var(--cy-surface)',
    color: 'var(--cy-text)',
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
  },
  mediaMenu: {
    position: 'absolute' as const,
    left: '0',
    bottom: 'calc(100% + 8px)',
    minWidth: '220px',
    backgroundColor: 'var(--cy-surface)',
    border: '1.5px solid var(--cy-border)',
    borderRadius: '4px',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    padding: '4px',
    zIndex: 100,
  },
  mediaMenuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '6px 8px',
    borderRadius: '2px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--cy-text)',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '13px',
    textAlign: 'left' as const,
  },
  mediaMenuSeparator: {
    height: '1px',
    margin: '4px 0',
    backgroundColor: 'var(--cy-border)',
  },
  /* action buttons */
  actionRow: { display: 'flex', gap: '16px', flexWrap: 'wrap' as const },
  copyBtn: {
    flex: 1,
    backgroundColor: 'var(--cy-primary)',
    color: 'var(--cy-on-primary)',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '14px',
    letterSpacing: '0.05em',
    fontWeight: 500,
    padding: '12px 24px',
    borderRadius: '4px',
    border: '1.5px solid var(--cy-primary)',
    cursor: 'pointer',
    textTransform: 'uppercase' as const,
    transition: 'background-color 0.2s ease',
    minWidth: '120px',
  },
  clearBtn: {
    flex: 1,
    backgroundColor: 'var(--cy-surface-container)',
    color: 'var(--cy-secondary-text)',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '14px',
    letterSpacing: '0.05em',
    fontWeight: 500,
    padding: '12px 24px',
    borderRadius: '4px',
    border: '1.5px solid var(--cy-border)',
    cursor: 'pointer',
    textTransform: 'uppercase' as const,
    transition: 'background-color 0.2s ease',
    minWidth: '120px',
  },
  mediaImportBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderRadius: '999px',
    border: '1.5px solid var(--cy-border)',
    backgroundColor: 'var(--cy-surface-white)',
    color: 'var(--cy-text)',
    cursor: 'pointer',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '12px',
    letterSpacing: '0.05em',
    fontWeight: 500,
    textTransform: 'uppercase' as const,
    whiteSpace: 'nowrap' as const,
  },
  /* sidebar */
  sidebar: { display: 'flex', flexDirection: 'column' as const, gap: '24px' },
  sideCard: {
    backgroundColor: 'var(--cy-surface)',
    borderRadius: '4px',
    border: '1.5px solid var(--cy-border)',
    padding: '20px',
  },
  sideCardAlt: {
    backgroundColor: 'var(--cy-surface-white)',
    borderRadius: '4px',
    border: '1.5px solid var(--cy-border)',
    padding: '20px',
  },
  sideCardTitle: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '14px',
    lineHeight: '20px',
    letterSpacing: '0.08em',
    fontWeight: 500,
    color: 'var(--cy-text)',
    textTransform: 'uppercase' as const,
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  deviceItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '13px',
    lineHeight: '18px',
    color: 'var(--cy-text-secondary)',
  },
  deviceDot: { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--cy-primary)', flexShrink: 0 },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 0',
    borderBottom: '1.5px solid var(--cy-border)',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '13px',
    lineHeight: '18px',
    color: 'var(--cy-text-secondary)',
    flexWrap: 'wrap' as const,
    gap: '4px',
  },
  infoRowLast: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 0',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '13px',
    lineHeight: '18px',
    color: 'var(--cy-text-secondary)',
    flexWrap: 'wrap' as const,
    gap: '4px',
  },
  qrCard: {
    backgroundColor: 'var(--cy-surface)',
    borderRadius: '4px',
    border: '1.5px solid var(--cy-border)',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
  },
  qrTitle: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '14px',
    letterSpacing: '0.08em',
    fontWeight: 500,
    color: 'var(--cy-text)',
    textTransform: 'uppercase' as const,
    textAlign: 'center' as const,
  },
  qrFrame: {
    width: '192px',
    height: '192px',
    backgroundColor: 'var(--cy-surface-white)',
    border: '1.5px solid var(--cy-border)',
    padding: '8px',
    maxWidth: '100%',
  },
  /* footer */
  footer: {
    backgroundColor: 'var(--cy-surface)',
    borderTop: '1.5px solid var(--cy-border)',
    width: '100%',
    padding: '20px 0',
    marginTop: 'auto',
  },
  footerInner: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 24px',
    maxWidth: '1280px',
    margin: '0 auto',
    gap: '16px',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '12px',
    lineHeight: '18px',
    color: 'var(--cy-text-secondary)',
  },
  footerLink: {
    color: 'var(--cy-text-secondary)',
    textDecoration: 'none',
    transition: 'color 0.15s ease',
    fontSize: '12px',
    fontFamily: 'JetBrains Mono, monospace',
  },
}

/* ──────────────────────────────── page ──────────────────────────────── */

export default function RoomPage() {
  const params = useParams<{ roomId: string }>()
  const router = useRouter()
  const roomId = String(params.roomId || '').toLowerCase()
  const displayId = roomId.toUpperCase()

  const [text, setText] = useState('')
  const [debouncedText] = useDebounce(text, 1000)
  const [status, setStatus] = useState<'loading' | 'ready' | 'closed' | 'error' | 'expired'>('loading')
  const [connection, setConnection] = useState<'connecting' | 'connected' | 'offline'>('connecting')
  const [role, setRole] = useState<'host' | 'participant'>('participant')
  const [saved, setSaved] = useState(true)
  const [people, setPeople] = useState(1)
  const [notice, setNotice] = useState('')
  const [copied, setCopied] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [roomIdCopied, setRoomIdCopied] = useState(false)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [undoText, setUndoText] = useState<string | null>(null)
  const [fileWarning, setFileWarning] = useState<string | null>(null)
  const [mediaMenuOpen, setMediaMenuOpen] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [hoveredAttachmentId, setHoveredAttachmentId] = useState<string | null>(null)
  const [previewAttachment, setPreviewAttachment] = useState<Transfer | null>(null)
  const [activeAudioDialog, setActiveAudioDialog] = useState<{
    transfer: Transfer
    audioData: DecodedAudioData
    initialTime?: number
  } | null>(null)
  const [peerSummary, setPeerSummary] = useState('WAITING FOR PEERS')
  const [userName, setUserName] = useState<string | null | undefined>(undefined)
  const [nameDraft, setNameDraft] = useState('')
  const [lifespanMs, setLifespanMs] = useState<number>(PRESENCE_LIFESPAN_MS)
  const roomUrl = useMemo(() => getRoomUrl(roomId), [roomId])
  const fingerprintRef = useRef('')
  const deviceLabelRef = useRef('Browser')
  const tokenRef = useRef('')
  const dirtyRef = useRef(false)
  const textRef = useRef('')
  const lastKnownUpdatedAtRef = useRef<number | undefined>(undefined)
  
  const instanceId = useMemo(() => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID()
    }
    return Math.random().toString(36).substring(2, 15)
  }, [])

  const heartbeatTimerRef = useRef<number | null>(null)
  const lifespanTimerRef = useRef<number | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const latestPresenceRef = useRef<Record<string, any>>({})
  const firebaseUidRef = useRef('')
  const [localUid, setLocalUid] = useState('')
  const [presenceMap, setPresenceMap] = useState<Record<string, { name?: string; sid?: string; [key: string]: unknown }>>({})
  const photosInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)
  const documentInputRef = useRef<HTMLInputElement>(null)

  const [serverDevices, setServerDevices] = useState<Device[]>([])

  // Honest placeholders for other connected devices ("Participant 2", etc.) as fallback
  const otherDeviceNames = useMemo(
    () => getParticipantPlaceholders(Math.max(0, people - 1)),
    [people],
  )

  const {
    transfers,
    sendFile: sendFileToPeers,
    downloadFile,
  } = useFileTransfer({
    roomId,
    localUid,
    localName: userName ?? '',
    presence: presenceMap,
    enabled: Boolean(localUid && userName && status === 'ready'),
  })

  const receivedAttachments = useMemo(() => {
    const seen = new Set<string>()
    return transfers
      .filter((transfer) => {
        if (transfer.status !== 'completed') return false
        const key = transfer.batchId || `${transfer.fileName}-${transfer.fileSize}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(-8)
  }, [transfers])

  const uploadingItems = useMemo(() => {
    const activeSentTransfers = transfers.filter((transfer) =>
      transfer.direction === 'sent' &&
      (transfer.status === 'pending' || transfer.status === 'transferring'),
    )

    const grouped = new Map<string, {
      id: string
      fileName: string
      category: 'image' | 'video' | 'audio' | 'document' | 'file'
      objectUrl?: string
      progress: number
    }>()
    const progressBuckets = new Map<string, number[]>()

    for (const transfer of activeSentTransfers) {
      const groupId = transfer.batchId || transfer.id
      if (!grouped.has(groupId)) {
        grouped.set(groupId, {
          id: groupId,
          fileName: transfer.fileName,
          category: transfer.category,
          objectUrl: transfer.objectUrl,
          progress: Math.max(0, Math.min(100, transfer.progress || 0)),
        })
      }
      const bucket = progressBuckets.get(groupId) || []
      bucket.push(Math.max(0, Math.min(100, transfer.progress || 0)))
      progressBuckets.set(groupId, bucket)
    }

    for (const [groupId, item] of grouped) {
      const values = progressBuckets.get(groupId) || [0]
      const avg = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
      item.progress = avg
    }

    return Array.from(grouped.values()).slice(-4)
  }, [transfers])

  useEffect(() => {
    fingerprintRef.current = getLocalFingerprint()
    deviceLabelRef.current = getDeviceLabel()
    setUserName(getSavedUsername())
  }, [])

  function submitName() {
    const trimmed = nameDraft.trim().slice(0, 24)
    if (!trimmed) return
    saveUsername(trimmed)
    setUserName(trimmed)
  }

  function changeName() {
    clearUsername()
    setNameDraft('')
    setUserName(null)
  }

  useEffect(() => {
    if (!userName) return
    if (!isValidRoomId(roomId)) { router.replace('/'); return }
    let alive = true

    async function loadSnapshot() {
      try {
        const payload = await fetchRoomSnapshot(roomId, tokenRef.current, fingerprintRef.current)
        if (!alive) return
        if (payload.status === 'closed') {
          clearStoredHostFingerprint(roomId)
          clearCachedToken(roomId)
          setStatus('closed')
          return
        }
        setPeople(Math.max(1, payload.people || 1))
        if (Array.isArray(payload.devices)) {
          setServerDevices(payload.devices)
        }
        if (!dirtyRef.current && payload.text !== textRef.current) {
          textRef.current = payload.text
          setText(payload.text)
          setSaved(true)
        }
        setStatus('ready')
        setConnection('connected')
      } catch (error) {
        if (!alive) return
        const statusCode = error instanceof Error && 'status' in error
          ? Number((error as Error & { status?: number }).status) : 0
        if (statusCode === 404) {
          clearStoredHostFingerprint(roomId)
          clearCachedToken(roomId)
          setStatus('closed')
          return
        }
        setConnection('offline')
        throw error
      }
    }

    function handlePresence(presence: Record<string, any>) {
      if (!alive) return
      const now = Date.now()
      latestPresenceRef.current = presence || {}
      const presenceEntries = Object.entries(presence || {})

      const activeEntries = presenceEntries.filter(([_, entry]) => {
        const lastSeen = typeof entry?.lastSeen === 'number' ? entry.lastSeen : 0
        return now - lastSeen < PRESENCE_LIFESPAN_MS
      })

      setPeople(Math.max(1, activeEntries.length))
      setServerDevices(
        activeEntries.map(([sid, entry]) => ({
          sid,
          fingerprint: entry.fingerprint || sid,
          name: entry.name || (entry.role === 'host' ? 'Host' : 'Participant'),
          deviceLabel: entry.deviceLabel || 'Browser',
          role: entry.role || 'participant',
        })),
      )
      setPeerSummary(
        activeEntries.length > 1
          ? `${activeEntries.length - 1} PEER${activeEntries.length - 1 !== 1 ? 'S' : ''} CONNECTED`
          : 'WAITING FOR PEERS',
      )
      // Update presence map for WebRTC (keyed by uid)
      const pMap: Record<string, { name?: string; sid?: string; [key: string]: unknown }> = {}
      for (const [sid, entry] of activeEntries) {
        pMap[sid] = { ...(entry as Record<string, unknown>), sid }
      }
      setPresenceMap(pMap)
      setConnection('connected')
    }

    function handleClipUpdatedAt(updatedAt?: number) {
      if (!alive) return
      const previousUpdatedAt = lastKnownUpdatedAtRef.current
      if (previousUpdatedAt !== undefined && updatedAt !== undefined && updatedAt !== previousUpdatedAt) {
        if (!dirtyRef.current) {
          loadSnapshot().catch(() => undefined)
        }
      }
      lastKnownUpdatedAtRef.current = updatedAt
    }

    function handleStatus(roomStatus: 'open' | 'closed') {
      if (!alive) return
      if (roomStatus === 'closed') {
        clearStoredHostFingerprint(roomId)
        clearCachedToken(roomId)
        setStatus('expired')
        setNotice('This room is expired and no longer exists.')
      }
    }

    async function connect() {
      try {
        let payload = await getRoomToken(roomId, fingerprintRef.current, userName ?? '', deviceLabelRef.current)
        tokenRef.current = payload.token

        try {
          await signInToFirebaseRoom(payload.firebaseToken)
        } catch {
          clearCachedToken(roomId)
          payload = await getRoomToken(roomId, fingerprintRef.current, userName ?? '', deviceLabelRef.current, true)
          tokenRef.current = payload.token
          await signInToFirebaseRoom(payload.firebaseToken)
        }

        // Capture Firebase auth UID for WebRTC signaling
        const { auth: fbAuth } = getFirebaseServices()
        firebaseUidRef.current = fbAuth.currentUser?.uid || ''
        setLocalUid(firebaseUidRef.current)

        let effectiveRole = payload.role
        if (effectiveRole === 'host') {
          setStoredHostFingerprint(roomId, fingerprintRef.current)
        } else if (getStoredHostFingerprint(roomId) === fingerprintRef.current) {
          try {
            const reclaimResp = await fetch(`/api/rooms/${roomId}/reclaim?token=${encodeURIComponent(payload.token)}`, {
              method: 'POST',
              headers: { 'x-device-fingerprint': fingerprintRef.current },
            })
            if (reclaimResp.ok) {
              const body = await reclaimResp.json().catch(() => ({}))
              if (body?.token) {
                payload = { ...payload, token: body.token, role: 'host' }
                tokenRef.current = body.token
                try {
                  sessionStorage.setItem(`clipboard-token-${roomId}`, JSON.stringify(payload))
                } catch { }
                setStoredHostFingerprint(roomId, fingerprintRef.current)
                effectiveRole = 'host'
              }
            }
          } catch {
            // ignore reclaim errors — we'll continue as participant
          }
        }
        setRole(effectiveRole)
        setConnection('connected')
        await sendPresence(roomId, payload.token, fingerprintRef.current, deviceLabelRef.current, userName ?? '', instanceId)
        await loadSnapshot()

        const handleUnload = () => sendLeaveBeacon(roomId, tokenRef.current, fingerprintRef.current)

        window.addEventListener('pagehide', handleUnload)
        window.addEventListener('beforeunload', handleUnload)

        const cleanupPresenceOnDisconnect = setupRoomPresenceOnDisconnect(roomId)
        const presenceUnsubscribe = subscribeToRoomPresence(roomId, handlePresence)
        const statusUnsubscribe = subscribeToRoomStatus(roomId, handleStatus)
        const clipUnsubscribe = subscribeToRoomClipUpdatedAt(roomId, handleClipUpdatedAt)

        cleanupRef.current = () => {
          window.removeEventListener('pagehide', handleUnload)
          window.removeEventListener('beforeunload', handleUnload)
          presenceUnsubscribe()
          statusUnsubscribe()
          clipUnsubscribe()
          cleanupPresenceOnDisconnect()
          handleUnload()
          if (lifespanTimerRef.current !== null) window.clearInterval(lifespanTimerRef.current)
          // Clean up WebRTC signaling data
          if (firebaseUidRef.current) {
            cleanupSignaling(roomId, firebaseUidRef.current).catch(() => undefined)
          }
        }

        setConnection('connected')

        lifespanTimerRef.current = window.setInterval(() => {
          const now = Date.now()
          const activeEntries = Object.entries(latestPresenceRef.current).filter(([_, entry]) => {
            const lastSeen = typeof entry?.lastSeen === 'number' ? entry.lastSeen : 0
            return now - lastSeen < PRESENCE_LIFESPAN_MS
          })
          if (activeEntries.length > 0) {
            const nextLifespan = Math.max(
              0,
              PRESENCE_LIFESPAN_MS - (now - Math.min(...activeEntries.map(([_, entry]) => entry.lastSeen || now))),
            )
            setLifespanMs(nextLifespan)
          } else {
            setLifespanMs(0)
          }
        }, 1000)

        heartbeatTimerRef.current = window.setInterval(() => {
          sendPresence(roomId, payload.token, fingerprintRef.current, deviceLabelRef.current, userName ?? '', instanceId)
            .catch(() => setConnection('offline'))
        }, 5000)
      } catch (error: any) {
        if (!alive) return
        const isExpired = Boolean(
          error?.expired ||
          error?.status === 404 ||
          error?.status === 410 ||
          (typeof error?.message === 'string' && (
            error.message.toLowerCase().includes('expired') ||
            error.message.toLowerCase().includes('unavailable') ||
            error.message.toLowerCase().includes('closed')
          ))
        )
        if (isExpired) {
          clearStoredHostFingerprint(roomId)
          clearCachedToken(roomId)
          setStatus('expired')
          setNotice('This room is expired and no longer exists.')
        } else {
          setStatus('error')
          setNotice(error instanceof Error ? error.message : 'Unable to connect to room')
        }
      }
    }

    connect()

    return () => {
      alive = false
      cleanupRef.current?.()
      if (heartbeatTimerRef.current !== null) window.clearInterval(heartbeatTimerRef.current)
    }
  }, [roomId, router, userName])

  useEffect(() => {
    // Only auto-save if there's a local un-saved change and we have a token
    if (!userName || !dirtyRef.current || !tokenRef.current) return
    
    let alive = true
    saveText(roomId, tokenRef.current, debouncedText, fingerprintRef.current)
      .then(() => {
        if (!alive) return
        dirtyRef.current = false
        setSaved(true)
        setConnection('connected')
      })
      .catch(() => {
        if (!alive) return
        setConnection('offline')
      })
      
    return () => { alive = false }
  }, [debouncedText, roomId, userName])

  function handleTextChange(nextText: string) {
    textRef.current = nextText
    dirtyRef.current = true
    setText(nextText)
    setSaved(false)
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items
    if (!items) return
    const filesToUpload: File[] = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) {
          filesToUpload.push(file)
        }
      }
    }
    if (filesToUpload.length > 0) {
      e.preventDefault()
      sendSelectedFiles(filesToUpload)
    }
  }

  function handleTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      copyClipboard()
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'X' || e.key === 'x')) {
      e.preventDefault()
      clearWithUndo()
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && undoText !== null) {
      restoreUndo()
    }
  }

  function clearWithUndo() {
    if (!text) return
    const prev = text
    setUndoText(prev)
    handleTextChange('')
    setTimeout(() => setUndoText((cur) => (cur === prev ? null : cur)), 7000)
  }

  function restoreUndo() {
    if (undoText !== null) {
      handleTextChange(undoText)
      setUndoText(null)
    }
  }

  async function copyClipboard() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  async function copyRoomId() {
    await navigator.clipboard.writeText(displayId)
    setRoomIdCopied(true)
    setTimeout(() => setRoomIdCopied(false), 2000)
  }

  function openMediaInput(kind: 'photos' | 'camera' | 'audio' | 'document') {
    setMediaMenuOpen(false)
    if (kind === 'camera') {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
        setCameraOpen(true)
        return
      }
    }
    const inputMap = {
      photos: photosInputRef,
      camera: cameraInputRef,
      audio: audioInputRef,
      document: documentInputRef,
    }
    inputMap[kind].current?.click()
  }

  function sendSelectedFiles(files: FileList | File[] | null) {
    if (!files || (files instanceof FileList ? files.length === 0 : files.length === 0)) return
    setFileWarning(null)
    const fileArray = files instanceof FileList ? Array.from(files) : files
    for (const file of fileArray) {
      try {
        sendFileToPeers(file)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unable to send file'
        setFileWarning(errorMsg)
        setTimeout(() => setFileWarning((current) => (current === errorMsg ? null : current)), 5000)
      }
    }
  }

  function getDocExt(fileName: string) {
    const parts = fileName.split('.')
    if (parts.length < 2) return 'FILE'
    return parts[parts.length - 1].slice(0, 4).toUpperCase()
  }

  function isLikelyDocumentTransfer(fileName: string, mimeType: string) {
    const normalizedMime = (mimeType || '').toLowerCase()
    if (normalizedMime.startsWith('text/')) return true
    if (normalizedMime === 'application/pdf') return true
    if (normalizedMime.includes('word')) return true
    if (normalizedMime.includes('excel')) return true
    if (normalizedMime.includes('powerpoint')) return true
    if (normalizedMime.includes('spreadsheet')) return true
    if (normalizedMime.includes('presentation')) return true
    if (normalizedMime === 'text/csv') return true

    const lowerName = (fileName || '').toLowerCase()
    return /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|rtf|zip|rar|odt|odp|ods)$/.test(lowerName)
  }

  async function shareRoom() {
    await navigator.clipboard.writeText(roomUrl)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2000)
  }

  function openImagePreview(attachment: Transfer) {
    if (!attachment.objectUrl) return
    setPreviewAttachment(attachment)
  }

  function closeImagePreview() {
    setPreviewAttachment(null)
  }

  async function leave() {
    const token = tokenRef.current
    if (role === 'host' && token) {
      await closeRoom(roomId, token, fingerprintRef.current).catch(() => undefined)
    } else if (token) {
      sendLeaveBeacon(roomId, token, fingerprintRef.current)
    }
    clearStoredHostFingerprint(roomId)
    clearCachedToken(roomId)
    router.push('/')
  }

  /* ── name prompt ── */
  if (userName === undefined) {
    return <Shell><div /></Shell>
  }

  if (!userName) {
    return (
      <Shell>
        <div style={{ maxWidth: '360px', width: '100%', textAlign: 'center', padding: '0 16px' }}>
          <h1 style={{ fontFamily: 'Hanken Grotesk, sans-serif', fontSize: '24px', fontWeight: 700, color: 'var(--cy-text)', marginBottom: '8px' }}>
            What&apos;s your name?
          </h1>
          <p style={{ color: 'var(--cy-text-secondary)', marginBottom: '20px', fontSize: '14px' }}>
            Other people in this room will see this so they know it&apos;s you.
          </p>
          <input
            id="username-input"
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitName() }}
            placeholder="e.g. Sarah"
            maxLength={24}
            style={{
              width: '100%',
              padding: '12px 16px',
              marginBottom: '16px',
              borderRadius: '4px',
              border: '1.5px solid var(--cy-border)',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box' as const,
              backgroundColor: 'var(--cy-surface-white)',
              color: 'var(--cy-text)',
            }}
          />
          <button
            id="username-continue-btn"
            onClick={submitName}
            disabled={!nameDraft.trim()}
            style={{ ...S.copyBtn, flex: 'none', width: '100%', opacity: nameDraft.trim() ? 1 : 0.5, cursor: nameDraft.trim() ? 'pointer' : 'not-allowed' }}
          >
            Continue
          </button>
        </div>
      </Shell>
    )
  }

  /* ── loading / error states ── */
  if (status === 'loading') {
    return (
      <Shell>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: 'var(--cy-text-secondary)', letterSpacing: '0.05em' }}>
          CONNECTING TO ROOM…
        </div>
      </Shell>
    )
  }

  if (status === 'expired' || status === 'closed') {
    return (
      <Shell>
        <div style={{ maxWidth: '420px', textAlign: 'center', padding: '0 16px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: 'var(--cy-surface-container-high)',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 0 16px -4px var(--cy-warning)',
            }}
          >
            <span className="material-symbols-outlined" style={{ color: 'var(--cy-warning)', fontSize: '24px' }}>
              timer_off
            </span>
          </div>
          <h1
            style={{
              fontFamily: 'Hanken Grotesk, sans-serif',
              fontSize: '24px',
              fontWeight: 700,
              color: 'var(--cy-text)',
              marginBottom: '12px',
            }}
          >
            This room is expired
          </h1>
          <p style={{ color: 'var(--cy-text-secondary)', marginBottom: '28px', fontSize: '14px', lineHeight: '20px' }}>
            {notice || 'Rooms automatically expire and are deleted from the database after 24 hours.'}
          </p>
          <button
            id="back-home-btn"
            onClick={() => router.push('/')}
            style={{ ...S.copyBtn, flex: 'none', width: '100%', padding: '12px 20px' }}
          >
            Back to home
          </button>
        </div>
      </Shell>
    )
  }

  if (status === 'error') {
    return (
      <Shell>
        <div style={{ maxWidth: '420px', textAlign: 'center', padding: '0 16px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: 'var(--cy-surface-container-high)',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 0 16px -4px var(--cy-error)',
            }}
          >
            <span className="material-symbols-outlined" style={{ color: 'var(--cy-error)', fontSize: '24px' }}>
              sync_problem
            </span>
          </div>
          <h1
            style={{
              fontFamily: 'Hanken Grotesk, sans-serif',
              fontSize: '24px',
              fontWeight: 700,
              color: 'var(--cy-text)',
              marginBottom: '12px',
            }}
          >
            Connection error
          </h1>
          <p style={{ color: 'var(--cy-text-secondary)', marginBottom: '28px', fontSize: '14px', lineHeight: '20px' }}>
            {notice || 'Something went wrong while connecting to the room.'}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
            <button
              id="reload-btn"
              onClick={() => window.location.reload()}
              style={{
                ...S.copyBtn,
                flex: 'none',
                width: '100%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px 20px',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>refresh</span>
              <span>Reload</span>
            </button>
            <button
              id="back-home-secondary-btn"
              onClick={() => router.push('/')}
              style={{ ...S.clearBtn, flex: 'none', width: '100%', padding: '12px 20px' }}
            >
              Back to home
            </button>
          </div>
        </div>
      </Shell>
    )
  }

  const isConnected = connection === 'connected'
  const charCount = text.length

  /* ── main UI ── */
  return (
    <div style={S.page}>

      {/* ── Header ── */}
      <div style={{ backgroundColor: 'var(--cy-surface)', borderBottom: '1.5px solid var(--cy-border-strong)', position: 'sticky', top: 0, zIndex: 50 }}>
        <header className="cy-room-header" style={S.header}>
          {/* Left: logo + room badge + connected */}
          <div className="cy-room-header-left">
            <button onClick={leave} style={{ ...S.logo, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              ClipYard
            </button>

            <div
              style={{ ...S.roomBadge, cursor: 'pointer' }}
              onClick={copyRoomId}
              title="Click to copy Room ID"
            >
              <span style={S.roomBadgeLabel}>Room:</span>
              <span style={S.roomBadgeId}>{roomIdCopied ? 'COPIED!' : displayId}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ ...S.connectedDot, backgroundColor: isConnected ? 'var(--cy-primary)' : 'var(--cy-error)' }} />
              <span style={S.connectedLabel}>{isConnected ? 'Connected' : 'Offline'}</span>
            </div>
          </div>

          {/* Right: theme toggle + share */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ThemeToggle />
            <button
              id="share-btn"
              onClick={shareRoom}
              style={S.shareBtn}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--cy-surface-container)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>share</span>
              {shareCopied ? 'COPIED!' : 'SHARE'}
            </button>
          </div>
        </header>
      </div>

      {/* ── Main grid ── */}
      <main className="cy-room-grid" style={S.main}>
        {/* Editor column — 8 cols on desktop, full on mobile */}
        <div className="cy-room-editor" style={S.editorCol}>
          {/* Textarea card */}
          <div
            style={{ ...S.editorCard, position: 'relative' }}
            onDragOver={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsDraggingOver(true)
            }}
            onDragLeave={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (e.currentTarget.contains(e.relatedTarget as Node)) return
              setIsDraggingOver(false)
            }}
            onDrop={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsDraggingOver(false)
              if (e.dataTransfer.files?.length) {
                sendSelectedFiles(e.dataTransfer.files)
              }
            }}
          >
            {/* Drag & Drop Visual Overlay */}
            {isDraggingOver ? (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'color-mix(in srgb, var(--cy-surface) 88%, transparent)',
                  backdropFilter: 'blur(8px)',
                  border: '2px dashed var(--cy-primary)',
                  borderRadius: '4px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  zIndex: 100,
                  pointerEvents: 'none',
                  animation: 'cy-fade-in 0.15s ease-out',
                }}
              >
                <div
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--cy-primary)',
                    color: 'var(--cy-on-primary)',
                    display: 'grid',
                    placeItems: 'center',
                    boxShadow: '0 0 20px -2px var(--cy-primary)',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '26px' }}>upload_file</span>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '14px', fontWeight: 600, color: 'var(--cy-text)' }}>
                    Drop files to send to room
                  </p>
                  <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: 'var(--cy-text-secondary)', marginTop: '3px' }}>
                    Images, videos, audio, or documents
                  </p>
                </div>
              </div>
            ) : null}

            <div style={S.editorBody}>
              <textarea
                id="clipboard-textarea"
                value={text}
                onChange={(e) => handleTextChange(e.target.value)}
                onPaste={handlePaste}
                onKeyDown={handleTextareaKeyDown}
                placeholder="Paste, drag files, or type text here..."
                spellCheck={false}
                style={S.textarea}
              />

              {/* Frosted gradient fade & blur over bottom area */}
              <div className="cy-textarea-bottom-fade" aria-hidden="true" />

              <div style={{ position: 'absolute', left: '16px', bottom: '16px', zIndex: 30 }}>
                {mediaMenuOpen ? (
                  <button
                    type="button"
                    aria-label="Close media menu"
                    style={S.mediaMenuOverlay}
                    onClick={() => setMediaMenuOpen(false)}
                  />
                ) : null}
                <div style={S.mediaOverlayRow}>
                  <div style={S.mediaDock}>
                    <button
                      type="button"
                      onClick={() => setMediaMenuOpen((current) => !current)}
                      style={S.mediaMenuTrigger}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--cy-surface-container)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--cy-surface-white)')}
                      aria-haspopup="menu"
                      aria-expanded={mediaMenuOpen}
                      aria-label="Import media"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>add</span>
                    </button>
                    {mediaMenuOpen && (
                      <div
                        className="cy-media-dropdown-menu"
                        style={S.mediaMenu}
                        role="menu"
                        aria-label="Import media options"
                      >
                        {[
                          { label: 'Photos & videos', icon: 'image', kind: 'photos' as const },
                          { label: 'Camera', icon: 'photo_camera', kind: 'camera' as const },
                          { label: 'Audio', icon: 'music_note', kind: 'audio' as const },
                          { label: 'Document', icon: 'description', kind: 'document' as const },
                        ].map((item, index) => (
                          <div key={item.label}>
                            <button
                              type="button"
                              role="menuitem"
                              style={S.mediaMenuItem}
                              onClick={() => openMediaInput(item.kind)}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--cy-surface-container)')}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--cy-text-secondary)' }}>
                                {item.icon}
                              </span>
                              {item.label}
                            </button>
                            {index === 1 ? <div style={S.mediaMenuSeparator} /> : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={S.mediaStrip}>
                    {uploadingItems.map((uploadingItem) => {
                      const radius = 11
                      const circumference = 2 * Math.PI * radius
                      const dashOffset = circumference - (uploadingItem.progress / 100) * circumference
                      const isImage = uploadingItem.category === 'image' && uploadingItem.objectUrl
                      const isAudio = uploadingItem.category === 'audio'

                      return (
                        <div
                          key={`uploading-${uploadingItem.id}`}
                          style={S.mediaUploadingThumb}
                          title={`Uploading ${uploadingItem.fileName}`}
                        >
                          {isImage ? (
                            <img
                              src={uploadingItem.objectUrl}
                              alt={uploadingItem.fileName}
                              style={S.mediaThumbImage}
                            />
                          ) : isAudio ? (
                            <span style={S.mediaDocThumb}>
                              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--cy-text-secondary)' }}>
                                music_note
                              </span>
                              <span style={S.mediaDocExt}>AUD</span>
                            </span>
                          ) : (
                            <span style={S.mediaDocThumb}>
                              <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--cy-text-secondary)' }}>
                                description
                              </span>
                              <span style={S.mediaDocExt}>{getDocExt(uploadingItem.fileName)}</span>
                            </span>
                          )}
                          <span style={S.mediaProgressOverlay}>
                            <svg viewBox="0 0 28 28" style={S.mediaProgressSvg} aria-hidden="true">
                              <circle cx="14" cy="14" r={radius} stroke="rgb(255 255 255 / 0.35)" strokeWidth="3" fill="none" />
                              <circle
                                cx="14"
                                cy="14"
                                r={radius}
                                stroke="var(--cy-primary)"
                                strokeWidth="3"
                                fill="none"
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                strokeDashoffset={dashOffset}
                              />
                            </svg>
                            <span style={S.mediaProgressLabel}>{uploadingItem.progress}%</span>
                          </span>
                        </div>
                      )
                    })}

                    {uploadingItems.length > 0 && receivedAttachments.length > 0 ? (
                      <div style={S.mediaDivider} aria-hidden="true" />
                    ) : null}

                    {receivedAttachments.map((transfer) => {
                      if (transfer.category === 'image' && transfer.objectUrl) {
                        return (
                          <div
                            key={transfer.id}
                            className="cy-image-slot"
                          >
                            <div className="cy-slot-popover" role="tooltip" aria-hidden="true">
                              <img
                                src={transfer.objectUrl}
                                alt={transfer.fileName}
                                className="cy-slot-popover-img"
                              />
                            </div>
                            <button
                              type="button"
                              style={S.mediaThumbButton}
                              onClick={() => openImagePreview(transfer)}
                              aria-label={`Preview ${transfer.fileName}`}
                            >
                              <img src={transfer.objectUrl} alt={transfer.fileName} style={S.mediaThumbImage} />
                            </button>
                          </div>
                        )
                      }

                      if (transfer.category === 'audio') {
                        return (
                          <AudioAttachmentItem
                            key={transfer.id}
                            transfer={transfer}
                            onOpenDialog={(t, d, initTime) =>
                              setActiveAudioDialog({ transfer: t, audioData: d, initialTime: initTime })
                            }
                          />
                        )
                      }

                      return (
                        <DocumentAttachmentItem
                          key={transfer.id}
                          transfer={transfer}
                          onDownload={downloadFile}
                        />
                      )
                    })}
                  </div>
                </div>

                {fileWarning ? (
                  <div className="cy-file-warning-pill" role="alert">
                    <div className="cy-warning-dot" aria-hidden="true" />
                    <span className="cy-warning-text" title={fileWarning}>
                      {fileWarning}
                    </span>
                    <button
                      type="button"
                      className="cy-warning-close"
                      onClick={() => setFileWarning(null)}
                      aria-label="Dismiss message"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>close</span>
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            <div style={S.editorFooter}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--cy-text-muted)' }}>
                  format_size
                </span>
                <span>{charCount.toLocaleString()} CHARACTERS</span>
              </div>

              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '3px 10px',
                  borderRadius: '9999px',
                  backgroundColor: 'var(--cy-surface)',
                  border: '1px solid var(--cy-border)',
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                }}
              >
                <div style={{ ...S.syncedDot, backgroundColor: saved ? 'var(--cy-primary)' : 'var(--cy-warning)' }} />
                <span style={{ color: saved ? 'var(--cy-text)' : 'var(--cy-warning)', textTransform: 'uppercase' }}>
                  {saved ? 'SYNCED' : 'SAVING…'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: '14px', color: isConnected ? 'var(--cy-primary)' : 'var(--cy-text-muted)' }}
                >
                  {isConnected ? 'sensors' : 'sensors_off'}
                </span>
                <span>{peerSummary}</span>
              </div>
            </div>

            {/* Hidden file inputs for attachment menu */}
            <input
              ref={photosInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => {
                sendSelectedFiles(e.target.files)
                e.currentTarget.value = ''
              }}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={(e) => {
                sendSelectedFiles(e.target.files)
                e.currentTarget.value = ''
              }}
            />
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => {
                sendSelectedFiles(e.target.files)
                e.currentTarget.value = ''
              }}
            />
            <input
              ref={documentInputRef}
              type="file"
              accept="*"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => {
                sendSelectedFiles(e.target.files)
                e.currentTarget.value = ''
              }}
            />
          </div>

          {/* Action buttons */}
          <div style={S.actionRow}>
            <button
              id="copy-clipboard-btn"
              onClick={copyClipboard}
              style={{
                ...S.copyBtn,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--cy-primary-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--cy-primary)')}
              title="Copy to clipboard (Ctrl + Enter)"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                {copied ? 'check' : 'content_copy'}
              </span>
              <span>{copied ? 'COPIED TO CLIPBOARD' : 'COPY CLIPBOARD'}</span>
              <span style={{ fontSize: '10px', opacity: 0.75, marginLeft: '4px', letterSpacing: '0.04em' }}>⌘↵</span>
            </button>
            <button
              id="clear-btn"
              onClick={clearWithUndo}
              style={S.clearBtn}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--cy-surface-container-high)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--cy-surface-container)')}
              title="Clear text (Ctrl + Shift + X)"
            >
              CLEAR
            </button>
          </div>

          {/* Undo Toast Notification */}
          {undoText !== null ? (
            <div
              style={{
                marginTop: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                padding: '8px 16px',
                borderRadius: '6px',
                backgroundColor: 'var(--cy-surface-white)',
                border: '1.5px solid var(--cy-border)',
                boxShadow: '0 4px 12px -2px rgb(0 0 0 / 0.2)',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '12px',
                animation: 'cy-fade-in 0.15s ease-out',
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              <span style={{ color: 'var(--cy-text)' }}>Text cleared from room.</span>
              <button
                type="button"
                onClick={restoreUndo}
                style={{
                  background: 'var(--cy-primary)',
                  color: 'var(--cy-on-primary)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 10px',
                  fontWeight: 600,
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  letterSpacing: '0.04em',
                }}
              >
                UNDO (Ctrl+Z)
              </button>
            </div>
          ) : null}

        </div>

        {/* Sidebar — 4 cols on desktop, full on mobile */}
        <div className="cy-room-sidebar" style={S.sidebar}>

          {/* Connected Devices */}
          <div style={S.sideCard}>
            <h3 style={S.sideCardTitle}>Connected Devices</h3>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '12px', listStyle: 'none', padding: 0, margin: 0 }}>
              <li style={S.deviceItem}>
                <div style={S.deviceDot} />
                <span>
                  {userName}
                  <span style={{ color: 'var(--cy-text-muted)' }}> · {deviceLabelRef.current}</span>
                  &nbsp;<span style={{ color: 'var(--cy-text-muted)' }}>({role === 'host' ? 'HOST' : 'YOU'})</span>
                </span>
              </li>
              {serverDevices.length > 0
                ? serverDevices
                  .filter((dev) => dev.fingerprint !== fingerprintRef.current)
                  .map((dev, idx) => (
                    <li key={dev.sid || idx} style={S.deviceItem}>
                      <div style={S.deviceDot} />
                      <span>
                        {dev.name || `Participant ${idx + 2}`}
                        {dev.deviceLabel ? <span style={{ color: 'var(--cy-text-muted)' }}> · {dev.deviceLabel}</span> : null}
                        &nbsp;<span style={{ color: 'var(--cy-text-muted)' }}>({dev.role === 'host' ? 'HOST' : 'CONNECTED'})</span>
                      </span>
                    </li>
                  ))
                : otherDeviceNames.map((name) => (
                  <li key={name} style={S.deviceItem}>
                    <div style={S.deviceDot} />
                    {name}&nbsp;
                    <span style={{ color: 'var(--cy-text-muted)' }}>(CONNECTED)</span>
                  </li>
                ))}
            </ul>
            <button
              id="change-name-btn"
              onClick={changeName}
              style={{
                marginTop: '12px',
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'var(--cy-primary)',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '12px',
                letterSpacing: '0.02em',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Not you? Change name
            </button>
          </div>

          {/* Room Info */}
          <div style={S.sideCardAlt}>
            <h3 style={S.sideCardTitle}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--cy-text-secondary)' }}>info</span>
              Room Info
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={S.infoRow}>
                <span>ROOM:</span>
                <span style={{ fontWeight: 700, color: 'var(--cy-text)' }}>{displayId}</span>
              </div>
              <div style={S.infoRow}>
                <span>STATUS:</span>
                <span>{people} DEVICE{people !== 1 ? 'S' : ''} CONNECTED</span>
              </div>
              {/* <div style={S.infoRowLast}>
                <span>LIFESPAN:</span>
                <span style={{ color: 'var(--cy-lifespan)' }}>
                  {lifespanMs > 0
                    ? `EXPIRES IN ${String(Math.floor(lifespanMs / 60000)).padStart(2, '0')}:${String(
                        Math.floor((lifespanMs % 60000) / 1000),
                      ).padStart(2, '0')}`
                    : 'EXPIRED'}
                </span>
              </div> */}
            </div>
          </div>

          {/* QR Code */}
          <QrCard roomUrl={roomUrl} />

        </div>
      </main>

      {previewAttachment?.objectUrl ? (
        <div style={S.mediaDialogOverlay} onClick={closeImagePreview}>
          <div style={S.mediaDialogBox} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              style={S.mediaDialogDownload}
              onClick={() => downloadFile(previewAttachment)}
              aria-label={`Download ${previewAttachment.fileName}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>download</span>
            </button>
            <button type="button" style={S.mediaDialogClose} onClick={closeImagePreview} aria-label="Close preview">
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
            </button>
            <img src={previewAttachment.objectUrl} alt={previewAttachment.fileName} style={S.mediaDialogImage} />
          </div>
        </div>
      ) : null}

      {activeAudioDialog ? (
        <AudioPlayerDialog
          transfer={activeAudioDialog.transfer}
          audioData={activeAudioDialog.audioData}
          initialTime={activeAudioDialog.initialTime}
          onClose={() => setActiveAudioDialog(null)}
          onDownload={downloadFile}
        />
      ) : null}

      {cameraOpen ? (
        <CameraCaptureDialog
          onCapture={(file) => {
            sendSelectedFiles([file])
          }}
          onClose={() => setCameraOpen(false)}
        />
      ) : null}

      {/* ── Footer ── */}
      <footer style={S.footer}>
        <div className="cy-footer-inner" style={S.footerInner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--cy-text)', fontWeight: 600 }}>ClipYard</span>
            <span style={{ color: 'var(--cy-border)' }}>/</span>
            <span style={{ color: 'var(--cy-text-muted)' }}>P2P WebRTC</span>
            <span style={{ color: 'var(--cy-border)' }}>•</span>
            <span style={{ color: 'var(--cy-text-muted)' }}>© {new Date().getFullYear()}</span>
          </div>

          <div className="cy-footer-links" style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
            <a
              href="#"
              style={S.footerLink}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--cy-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--cy-text-secondary)')}
            >
              Docs
            </a>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--cy-primary)',
                  boxShadow: '0 0 6px var(--cy-primary)',
                }}
              />
              <span style={{ color: 'var(--cy-text-secondary)', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace' }}>
                Operational
              </span>
            </div>
            <a
              href="#"
              style={S.footerLink}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--cy-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--cy-text-secondary)')}
            >
              Privacy
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              style={S.footerLink}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--cy-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--cy-text-secondary)')}
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ── QR Card extracted so it can access useTheme ── */
function QrCard({ roomUrl }: { roomUrl: string }) {
  const { theme } = useTheme()
  return (
    <div style={S.qrCard}>
      <span style={S.qrTitle}>Scan to Join</span>
      <div style={{ ...S.qrFrame, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {roomUrl ? (
          <QRCodeSVG
            value={roomUrl}
            size={176}
            fgColor={theme === 'dark' ? '#78d8b9' : '#006a53'}
            bgColor={theme === 'dark' ? '#1c1c1c' : '#ffffff'}
            level="M"
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <Image
            src="/qr-placeholder.png"
            alt="QR code to join this room"
            width={176}
            height={176}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
      </div>
    </div>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main style={{
      display: 'grid',
      minHeight: '100vh',
      placeItems: 'center',
      backgroundColor: 'var(--cy-surface)',
      padding: '20px',
    }}>
      {children}
    </main>
  )
}