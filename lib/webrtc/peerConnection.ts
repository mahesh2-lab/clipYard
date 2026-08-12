/**
 * lib/webrtc/peerConnection.ts
 *
 * Factory for RTCPeerConnection instances with centralized ICE server config.
 * STUN/TURN servers are configured via environment variables so a TURN server
 * can be added without code changes.
 */

'use client'

function getIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = []

  // Primary STUN from env or default
  const stunUrl = process.env.NEXT_PUBLIC_STUN_SERVER || 'stun:stun.l.google.com:19302'
  servers.push({ urls: stunUrl })

  // Additional public STUN servers for redundancy
  servers.push({ urls: 'stun:stun1.l.google.com:19302' })
  servers.push({ urls: 'stun:stun2.l.google.com:19302' })
  servers.push({ urls: 'stun:stun.cloudflare.com:3478' })

  // Optional TURN server from env
  const turnUrl = process.env.NEXT_PUBLIC_TURN_SERVER
  if (turnUrl) {
    const username = process.env.NEXT_PUBLIC_TURN_USERNAME || ''
    const credential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL || ''
    servers.push({ urls: turnUrl, username, credential })
  }

  return servers
}

/**
 * Creates a new RTCPeerConnection with the configured ICE servers.
 * Uses bundlePolicy='max-bundle' and iceCandidatePoolSize for faster
 * candidate gathering.
 */
export function createPeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection({
    iceServers: getIceServers(),
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    iceCandidatePoolSize: 4,
  })
}

/**
 * Checks whether the current browser supports the WebRTC APIs
 * required for P2P image sharing.
 */
export function isWebRTCSupported(): boolean {
  if (typeof window === 'undefined') return false
  return (
    typeof RTCPeerConnection !== 'undefined' &&
    typeof RTCDataChannel !== 'undefined'
  )
}
