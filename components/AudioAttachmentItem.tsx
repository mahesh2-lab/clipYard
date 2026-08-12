'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Transfer } from '@/lib/webrtc/types'
import {
  type DecodedAudioData,
  processAudioBlob,
  drawWaveform,
  formatAudioTime,
} from '@/lib/audioWaveform'

interface AudioAttachmentItemProps {
  transfer: Transfer
  onOpenDialog: (transfer: Transfer, audioData: DecodedAudioData, initialTime?: number) => void
}

export function AudioAttachmentItem({ transfer, onOpenDialog }: AudioAttachmentItemProps) {
  const [audioData, setAudioData] = useState<DecodedAudioData | null>(null)
  const slotCanvasRef = useRef<HTMLCanvasElement>(null)
  const popoverCanvasRef = useRef<HTMLCanvasElement>(null)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isHoveredRef = useRef(false)

  // Ensure a reliable object URL
  const audioUrl = useMemo(() => {
    if (transfer.objectUrl) return transfer.objectUrl
    if (transfer.blob) return URL.createObjectURL(transfer.blob)
    return ''
  }, [transfer.objectUrl, transfer.blob])

  // Decode audio data for waveform peaks
  useEffect(() => {
    let alive = true

    async function loadAudio() {
      try {
        let blob = transfer.blob
        if (!blob && audioUrl) {
          const resp = await fetch(audioUrl)
          blob = await resp.blob()
        }
        if (!blob) return

        const data = await processAudioBlob(blob, transfer.id || audioUrl)
        if (!alive) return
        setAudioData(data)
      } catch (err) {
        console.error('[AudioAttachmentItem] Failed to process audio:', transfer.fileName, err)
      }
    }

    loadAudio()

    return () => {
      alive = false
    }
  }, [transfer.blob, transfer.id, audioUrl, transfer.fileName])

  // Draw initial waveforms when canvas & data are ready
  useEffect(() => {
    if (!audioData) return

    if (slotCanvasRef.current) {
      drawWaveform(slotCanvasRef.current, audioData.peaksSmall, 0)
    }
    if (popoverCanvasRef.current) {
      drawWaveform(popoverCanvasRef.current, audioData.peaksLarge, 0)
    }
  }, [audioData])

  const handleMouseEnter = () => {
    isHoveredRef.current = true
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)

    hoverTimeoutRef.current = setTimeout(() => {
      if (!isHoveredRef.current || !audioElementRef.current || !audioUrl) return
      const audio = audioElementRef.current
      try {
        audio.currentTime = 0
      } catch {}
      const p = audio.play()
      if (p && p.catch) {
        p.catch((err) => {
          console.warn('[AudioAttachmentItem] Hover play prevented by browser policy (click to play):', err)
        })
      }
    }, 250)
  }

  const handleMouseLeave = () => {
    isHoveredRef.current = false
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)

    if (audioElementRef.current) {
      audioElementRef.current.pause()
      try {
        audioElementRef.current.currentTime = 0
      } catch {}
    }
    if (popoverCanvasRef.current && audioData) {
      drawWaveform(popoverCanvasRef.current, audioData.peaksLarge, 0)
    }
  }

  const handleTimeUpdate = () => {
    if (!isHoveredRef.current || !popoverCanvasRef.current || !audioData || !audioElementRef.current) return
    const audio = audioElementRef.current
    const progress = audio.duration ? audio.currentTime / audio.duration : 0
    drawWaveform(popoverCanvasRef.current, audioData.peaksLarge, progress)
  }

  const handleEnded = () => {
    if (popoverCanvasRef.current && audioData) {
      drawWaveform(popoverCanvasRef.current, audioData.peaksLarge, 0)
    }
  }

  const handleClick = () => {
    const currentPlayTime = audioElementRef.current ? audioElementRef.current.currentTime : 0
    if (audioElementRef.current) {
      audioElementRef.current.pause()
    }
    if (audioData) {
      onOpenDialog(transfer, audioData, currentPlayTime)
    }
  }

  return (
    <div
      className="cy-audio-slot"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`Play audio ${transfer.fileName}`}
    >
      <audio
        ref={audioElementRef}
        src={audioUrl}
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        style={{ display: 'none' }}
      />

      <canvas ref={slotCanvasRef} className="cy-audio-slot-canvas" width={40} height={40} />

      <div className="cy-audio-play-badge" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>

      <div className="cy-audio-popover" role="tooltip" aria-hidden="true">
        <canvas ref={popoverCanvasRef} className="cy-audio-popover-canvas" width={320} height={80} />
        <div className="cy-audio-popover-meta">
          <span className="cy-audio-popover-name" title={transfer.fileName}>
            {transfer.fileName}
          </span>
          <span className="cy-audio-popover-duration">
            {audioData ? formatAudioTime(audioData.duration) : '--:--'}
          </span>
        </div>
      </div>
    </div>
  )
}
