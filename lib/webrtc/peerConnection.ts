'use client'

// ICE configuration and RTCPeerConnection factory
function getIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = []

  const stunUrl = process.env.NEXT_PUBLIC_STUN_SERVER || 'stun:stun.l.google.com:19302'
  servers.push({ urls: stunUrl })
  servers.push({ urls: 'stun:stun1.l.google.com:19302' })
  servers.push({ urls: 'stun:stun2.l.google.com:19302' })
  servers.push({ urls: 'stun:stun.cloudflare.com:3478' })

  const turnUrl = process.env.NEXT_PUBLIC_TURN_SERVER
  if (turnUrl) {
    const username = process.env.NEXT_PUBLIC_TURN_USERNAME || ''
    const credential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL || ''
    servers.push({ urls: turnUrl, username, credential })
  }

  return servers
}

export function createPeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection({
    iceServers: getIceServers(),
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    iceCandidatePoolSize: 4,
  })
}

export function isWebRTCSupported(): boolean {
  if (typeof window === 'undefined') return false
  return (
    typeof RTCPeerConnection !== 'undefined' &&
    typeof RTCDataChannel !== 'undefined'
  )
}
