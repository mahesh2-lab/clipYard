// App configuration
export const publicConfig = {
  firebase: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ?? '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
  },
} as const

// Server-side environment variables
export function getServerConfig() {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY
  const privateKey = rawPrivateKey?.replace(/\\n/g, '\n') ?? ''

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing required Firebase server credentials in .env.local (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).',
    )
  }

  const roomDataSecret = process.env.ROOM_DATA_SECRET?.trim() || rawPrivateKey?.trim()
  if (!roomDataSecret) {
    throw new Error('Missing ROOM_DATA_SECRET in .env.local.')
  }

  const jwtSecret = process.env.JWT_SECRET?.trim() || rawPrivateKey?.trim()
  if (!jwtSecret) {
    throw new Error('Missing JWT_SECRET in .env.local.')
  }

  return {
    firebase: {
      projectId,
      clientEmail,
      privateKey,
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ?? '',
    },
    roomDataSecret,
    jwtSecret,
  }
}
