// IndexedDB storage for received files
const DB_NAME = 'ClipYardDB'
const DB_VERSION = 2
const STORE_NAME = 'files'

export interface StoredFile {
  id: string
  roomId: string
  fileName: string
  fileSize: number
  mimeType: string
  blob: Blob
  createdAt: number
  peerId: string
  peerName: string
  category?: 'image' | 'video' | 'audio' | 'document' | 'file'
}

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('roomId', 'roomId', { unique: false })
      }
    }
  })
}

export async function saveFileToDB(file: StoredFile): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.put(file)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function getFilesByRoom(roomId: string): Promise<StoredFile[]> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('roomId')
    const request = index.getAll(roomId)

    request.onsuccess = () => {
      const results = (request.result as StoredFile[]).sort(
        (a, b) => b.createdAt - a.createdAt
      )
      resolve(results)
    }
    request.onerror = () => reject(request.error)
  })
}
