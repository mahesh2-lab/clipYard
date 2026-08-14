// Audio decoding and waveform canvas rendering

let sharedAudioCtx: AudioContext | null = null

export function getAudioContext(): AudioContext {
  if (!sharedAudioCtx && typeof window !== 'undefined') {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (AudioCtx) {
      sharedAudioCtx = new AudioCtx()
    }
  }
  return sharedAudioCtx as AudioContext
}

export function unlockAudio() {
  if (typeof window === 'undefined') return
  const ctx = getAudioContext()
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }
}

// Unlock audio context and autoplay permissions on first user gesture
if (typeof window !== 'undefined') {
  const onUserGesture = () => {
    unlockAudio()
    window.removeEventListener('click', onUserGesture)
    window.removeEventListener('touchstart', onUserGesture)
    window.removeEventListener('pointerdown', onUserGesture)
    window.removeEventListener('keydown', onUserGesture)
  }
  window.addEventListener('click', onUserGesture, { once: true, passive: true })
  window.addEventListener('touchstart', onUserGesture, { once: true, passive: true })
  window.addEventListener('pointerdown', onUserGesture, { once: true, passive: true })
  window.addEventListener('keydown', onUserGesture, { once: true, passive: true })
}

export function mixToMono(audioBuffer: AudioBuffer): Float32Array {
  if (audioBuffer.numberOfChannels === 1) {
    return audioBuffer.getChannelData(0)
  }
  const ch0 = audioBuffer.getChannelData(0)
  const ch1 = audioBuffer.getChannelData(1)
  const out = new Float32Array(ch0.length)
  for (let i = 0; i < ch0.length; i++) {
    out[i] = (ch0[i] + ch1[i]) / 2
  }
  return out
}

export function computePeaks(audioBuffer: AudioBuffer, numPeaks: number): number[] {
  const data = mixToMono(audioBuffer)
  const blockSize = Math.max(1, Math.floor(data.length / numPeaks))
  const peaks = new Array(numPeaks).fill(0)

  for (let i = 0; i < numPeaks; i++) {
    const start = i * blockSize
    let max = 0
    for (let j = 0; j < blockSize; j++) {
      const v = Math.abs(data[start + j] || 0)
      if (v > max) max = v
    }
    peaks[i] = max
  }
  return peaks
}

export interface DecodedAudioData {
  duration: number
  peaksSmall: number[]
  peaksLarge: number[]
}

const audioCache = new Map<string, DecodedAudioData>()

export async function processAudioBlob(blobOrFile: Blob, cacheKey?: string): Promise<DecodedAudioData> {
  if (cacheKey && audioCache.has(cacheKey)) {
    return audioCache.get(cacheKey)!
  }

  const arrayBuffer = await blobOrFile.arrayBuffer()
  const ctx = getAudioContext()
  if (!ctx) {
    throw new Error('AudioContext not supported')
  }

  // decodeAudioData detaches the buffer in some browsers, so pass a slice
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0))
  const data: DecodedAudioData = {
    duration: audioBuffer.duration,
    peaksSmall: computePeaks(audioBuffer, 20),
    peaksLarge: computePeaks(audioBuffer, 90),
  }

  if (cacheKey) {
    audioCache.set(cacheKey, data)
  }

  return data
}

export function formatAudioTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export interface DrawWaveformOptions {
  activeColor?: string
  mutedColor?: string
  gap?: number
}

export function drawWaveform(
  canvas: HTMLCanvasElement,
  peaks: number[],
  progress: number = 0,
  options?: DrawWaveformOptions,
) {
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  const cssW = canvas.clientWidth || canvas.width
  const cssH = canvas.clientHeight || canvas.height

  if (cssW === 0 || cssH === 0) return

  if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, cssW, cssH)

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  const defaultMuted = isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.35)'
  const defaultActive = isDark ? '#78d8b9' : '#006a53'

  const mutedColor = options?.mutedColor || defaultMuted
  const activeColor = options?.activeColor || defaultActive
  const gap = options?.gap ?? 1.5
  const barWidth = Math.max(1, cssW / peaks.length - gap)
  const progressIndex = Math.floor(Math.min(1, Math.max(0, progress)) * peaks.length)

  peaks.forEach((p, i) => {
    const barH = Math.max(2, p * cssH)
    const x = i * (barWidth + gap)
    const y = (cssH - barH) / 2
    ctx.fillStyle = i <= progressIndex ? activeColor : mutedColor
    ctx.fillRect(x, y, barWidth, barH)
  })
}
