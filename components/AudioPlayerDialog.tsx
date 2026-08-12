'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Transfer } from '@/lib/webrtc/types'
import {
  type DecodedAudioData,
  drawWaveform,
  formatAudioTime,
} from '@/lib/audioWaveform'

interface AudioPlayerDialogProps {
  transfer: Transfer
  audioData: DecodedAudioData
  initialTime?: number
  onClose: () => void
  onDownload: (transfer: Transfer) => void
}

export function AudioPlayerDialog({
  transfer,
  audioData,
  initialTime = 0,
  onClose,
  onDownload,
}: AudioPlayerDialogProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(initialTime || 0)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null)
  const waveformWrapRef = useRef<HTMLDivElement>(null)

  const audioUrl = useMemo(() => {
    if (transfer.objectUrl) return transfer.objectUrl
    if (transfer.blob) return URL.createObjectURL(transfer.blob)
    return ''
  }, [transfer.objectUrl, transfer.blob])

  // Draw initial waveform on mount reflecting initialTime position
  useEffect(() => {
    if (waveformCanvasRef.current && audioData) {
      const progress = initialTime && audioData.duration ? initialTime / audioData.duration : 0
      drawWaveform(waveformCanvasRef.current, audioData.peaksLarge, progress)
    }
  }, [audioData, initialTime])

  // Set initial seek time and start playing
  useEffect(() => {
    const audio = audioElementRef.current
    if (audio && audioUrl) {
      if (initialTime && initialTime > 0) {
        audio.currentTime = initialTime
        setCurrentTime(initialTime)
      }
      const p = audio.play()
      if (p && p.catch) {
        p.catch((err) => {
          console.warn('[AudioPlayerDialog] Autoplay prevented, click play button:', err)
        })
      }
    }
  }, [audioUrl, initialTime])

  const togglePlayPause = () => {
    const audio = audioElementRef.current
    if (!audio) return

    if (audio.paused) {
      const p = audio.play()
      if (p && p.catch) {
        p.catch((err) => console.error('[AudioPlayerDialog] Play error:', err))
      }
    } else {
      audio.pause()
    }
  }

  const handleTimeUpdate = () => {
    const audio = audioElementRef.current
    if (!audio || !audioData) return

    setCurrentTime(audio.currentTime)
    if (waveformCanvasRef.current) {
      const progress = audio.duration ? audio.currentTime / audio.duration : 0
      drawWaveform(waveformCanvasRef.current, audioData.peaksLarge, progress)
    }
  }

  const handleEnded = () => {
    setIsPlaying(false)
    setCurrentTime(0)
    if (waveformCanvasRef.current && audioData) {
      drawWaveform(waveformCanvasRef.current, audioData.peaksLarge, 0)
    }
  }

  // Click-to-seek on waveform
  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioElementRef.current
    if (!waveformWrapRef.current || !audio || !audioData) return

    const rect = waveformWrapRef.current.getBoundingClientRect()
    const fraction = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    const totalDuration = audio.duration || audioData.duration
    const seekTime = fraction * totalDuration

    audio.currentTime = seekTime
    setCurrentTime(seekTime)
    if (waveformCanvasRef.current) {
      drawWaveform(waveformCanvasRef.current, audioData.peaksLarge, fraction)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgb(0 0 0 / 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
      }}
      onClick={onClose}
    >
      <audio
        ref={audioElementRef}
        src={audioUrl}
        preload="auto"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
      />

      <div
        style={{
          position: 'relative',
          backgroundColor: 'var(--cy-surface)',
          border: '1.5px solid var(--cy-border)',
          borderRadius: '8px',
          padding: '16px',
          boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.3), 0 4px 6px -4px rgb(0 0 0 / 0.2)',
          maxWidth: '90vw',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onDownload(transfer)}
          style={{
            position: 'absolute',
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
            boxShadow: '0 2px 4px rgb(0 0 0 / 0.15)',
          }}
          aria-label={`Download ${transfer.fileName}`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>download</span>
        </button>

        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
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
            boxShadow: '0 2px 4px rgb(0 0 0 / 0.15)',
          }}
          aria-label="Close audio player"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
        </button>

        <div className="cy-audio-player-dialog">
          <div className="cy-audio-player-name" title={transfer.fileName}>
            {transfer.fileName}
          </div>

          <div
            ref={waveformWrapRef}
            className="cy-audio-waveform-wrap"
            onClick={handleWaveformClick}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={audioData.duration}
            aria-valuenow={currentTime}
            aria-label="Seek audio"
            tabIndex={0}
          >
            <canvas ref={waveformCanvasRef} width={720} height={160} />
          </div>

          <div className="cy-audio-controls-row">
            <button
              type="button"
              className="cy-audio-play-btn"
              onClick={togglePlayPause}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                {isPlaying ? 'pause' : 'play_arrow'}
              </span>
            </button>
            <span className="cy-audio-time">
              {formatAudioTime(currentTime)} / {formatAudioTime(audioData.duration)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
