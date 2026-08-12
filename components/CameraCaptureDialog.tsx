'use client'

import { useEffect, useRef, useState } from 'react'

interface CameraCaptureDialogProps {
  onCapture: (file: File) => void
  onClose: () => void
}

export function CameraCaptureDialog({ onCapture, onClose }: CameraCaptureDialogProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  useEffect(() => {
    let alive = true

    async function startCamera() {
      setIsReady(false)
      setErrorMsg(null)
      stopStream()

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera not supported in this browser')
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        })

        if (!alive) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
        setIsReady(true)

        // Check if device has multiple cameras
        if (navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices()
          const videoInputs = devices.filter((d) => d.kind === 'videoinput')
          if (alive) {
            setHasMultipleCameras(videoInputs.length > 1)
          }
        }
      } catch (err: unknown) {
        if (!alive) return
        console.error('[Camera] Access error:', err)
        const error = err as { name?: string }
        if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
          setErrorMsg('Camera access was denied. Please allow camera access in your browser settings.')
        } else if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
          setErrorMsg('No camera device was found.')
        } else {
          setErrorMsg('Unable to access camera on this device.')
        }
      }
    }

    startCamera()

    return () => {
      alive = false
      stopStream()
    }
  }, [facingMode])

  // Escape key to close
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const handleCapture = () => {
    const video = videoRef.current
    if (!video || !streamRef.current) return

    const width = video.videoWidth || 1280
    const height = video.videoHeight || 720
    if (!width || !height) return

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Mirror if user front camera
    if (facingMode === 'user') {
      ctx.translate(width, 0)
      ctx.scale(-1, 1)
    }

    ctx.drawImage(video, 0, 0, width, height)

    canvas.toBlob((blob) => {
      if (!blob) return
      const file = new File([blob], `photo-${Date.now()}.png`, { type: 'image/png' })
      stopStream()
      onCapture(file)
      onClose()
    }, 'image/png')
  }

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'))
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgb(0 0 0 / 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'relative',
          backgroundColor: 'var(--cy-surface)',
          border: '1.5px solid var(--cy-border)',
          borderRadius: '8px',
          padding: '16px',
          boxShadow: '0 12px 30px -5px rgb(0 0 0 / 0.35)',
          maxWidth: '90vw',
        }}
        onClick={(e) => e.stopPropagation()}
      >
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
          aria-label="Close camera"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
        </button>

        <div className="cy-camera-dialog-box">
          <div className={`cy-camera-video-wrap ${facingMode === 'environment' ? 'rear' : ''}`}>
            {errorMsg ? (
              <div className="cy-camera-hint">
                <span className="material-symbols-outlined" style={{ fontSize: '24px', marginBottom: '8px', display: 'block', color: 'var(--cy-error)' }}>
                  videocam_off
                </span>
                <p>{errorMsg}</p>
              </div>
            ) : (
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
              />
            )}
          </div>

          <div className="cy-camera-controls-row">
            {hasMultipleCameras ? (
              <button
                type="button"
                className="cy-camera-switch-btn"
                onClick={toggleCamera}
                title="Flip Camera"
                aria-label="Flip camera"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  flip_camera_ios
                </span>
              </button>
            ) : (
              <div style={{ width: '36px' }} />
            )}

            <button
              type="button"
              className="cy-camera-shutter-btn"
              onClick={handleCapture}
              disabled={!isReady || Boolean(errorMsg)}
              aria-label="Take Photo"
              title="Take Photo"
            >
              <div className="cy-shutter-inner" />
            </button>

            <div style={{ width: '36px' }} />
          </div>
        </div>
      </div>
    </div>
  )
}
