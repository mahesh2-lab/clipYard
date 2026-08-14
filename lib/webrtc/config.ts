// WebRTC file transfer limits and chunk sizing
export const FILE_TRANSFER_CONFIG = {
  TESTING_MODE: true,
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50 MB limit
  ALLOWED_CATEGORIES: ['image', 'video', 'audio', 'document', 'file'] as const,
  CHUNK_SIZE: 64 * 1024, // 64 KB
}
