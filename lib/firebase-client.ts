'use client'

import { getApp, getApps, initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { getAuth, signInWithCustomToken, signOut } from 'firebase/auth'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

export function getFirebaseApp() {
  return getApps().length ? getApp() : initializeApp(firebaseConfig)
}

export function getFirebaseServices() {
  const app = getFirebaseApp()
  return { auth: getAuth(app), database: getDatabase(app) }
}

export async function signInToFirebaseRoom(firebaseToken: string) {
  const { auth } = getFirebaseServices()

  // Ignore transient RTDB closing errors during tab focus switches
  const isClosingError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err)
    return msg.toLowerCase().includes('closing') || msg.toLowerCase().includes('hidden')
  }

  try {
    await signOut(auth).catch((err) => {
      if (!isClosingError(err)) throw err
    })
    await signInWithCustomToken(auth, firebaseToken)
    const user = auth.currentUser
    if (user) {
      await user.getIdTokenResult(true)
    }
  } catch (err) {
    if (isClosingError(err)) return
    throw err
  }
}
