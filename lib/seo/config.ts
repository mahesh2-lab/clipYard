import type { Metadata } from 'next'

// Site defaults
const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://example.com'
const normalizedSiteUrl = rawSiteUrl.replace(/\/+$|\s+/g, '')
const siteUrl = normalizedSiteUrl || 'https://example.com'
const defaultTitle = `${process.env.NEXT_PUBLIC_SITE_NAME?.trim() || 'ClipYard'} — Real-Time Text Transfer`

function safeUrl(value: string): URL {
  try {
    return new URL(value)
  } catch {
    return new URL('https://example.com')
  }
}

function getAbsoluteUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const prefix = path.startsWith('/') ? '' : '/'
  return `${siteUrl}${prefix}${path}`
}

export const SITE_META = {
  name: process.env.NEXT_PUBLIC_SITE_NAME?.trim() || 'ClipYard',
  title: defaultTitle,
  description:
    process.env.NEXT_PUBLIC_SITE_DESCRIPTION?.trim() ||
    'A temporary clipboard for moving text between your laptop, phone, and desktop. No account. No setup.',
  url: siteUrl,
  themeColor: '#006a53',
  backgroundColor: '#f3fbf6',
  manifestPath: '/manifest.webmanifest',
  defaultOgImage: getAbsoluteUrl(
    `/og-image?title=${encodeURIComponent(process.env.NEXT_PUBLIC_SITE_NAME?.trim() || 'ClipYard')}&subtitle=${encodeURIComponent('Real-Time Text Transfer')}`,
  ),
} as const

const siteUrlObject = safeUrl(siteUrl)

// Root metadata config for Next.js layout
export function buildMetadata(): Metadata {
  return {
    title: {
      default: SITE_META.title,
      template: '%s | ClipYard',
    },
    description: SITE_META.description,
    applicationName: SITE_META.name,
    authors: [{ name: SITE_META.name }],
    publisher: SITE_META.name,
    creator: SITE_META.name,
    generator: 'Next.js',
    metadataBase: siteUrlObject,
    alternates: {
      canonical: SITE_META.url,
      languages: {
        'en-US': SITE_META.url,
      },
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
      },
    },
    // Favicons & Apple Touch icons
    icons: {
      icon: [
        { url: '/icon.svg', type: 'image/svg+xml' },
        { url: '/favicon.ico', sizes: 'any' },
      ],
      shortcut: '/icon.svg',
      apple: [
        { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
      ],
      other: [
        {
          rel: 'icon',
          url: '/icon-light-32x32.png',
          sizes: '32x32',
          media: '(prefers-color-scheme: light)',
        },
        {
          rel: 'icon',
          url: '/icon-dark-32x32.png',
          sizes: '32x32',
          media: '(prefers-color-scheme: dark)',
        },
      ],
    },
    manifest: SITE_META.manifestPath,
    openGraph: {
      type: 'website',
      title: SITE_META.title,
      description: SITE_META.description,
      siteName: SITE_META.name,
      url: SITE_META.url,
      locale: 'en_US',
      images: [
        {
          url: SITE_META.defaultOgImage,
          alt: `${SITE_META.name} preview image`,
          width: 1200,
          height: 630,
          type: 'image/png',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: SITE_META.title,
      description: SITE_META.description,
      images: [SITE_META.defaultOgImage],
    },
    verification: {
      google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
      other: process.env.BING_SITE_VERIFICATION
        ? { 'msvalidate.01': process.env.BING_SITE_VERIFICATION }
        : undefined,
    },
  }
}

// Room-specific metadata (keep rooms private & unindexed)
export function getRoomMetadata(roomId: string): Metadata {
  const title = `ClipYard room ${roomId}`
  const description = `Private ClipYard room ${roomId} for temporary text transfer between devices. This room is private and not indexed.`
  const roomUrl = `${SITE_META.url}/room/${encodeURIComponent(roomId)}`
  const roomImage = getAbsoluteUrl(
    `/og-image?title=${encodeURIComponent(title)}&subtitle=${encodeURIComponent('Private temporary clipboard')}`,
  )
  return {
    title,
    description,
    alternates: {
      canonical: roomUrl,
    },
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    },
    openGraph: {
      type: 'website',
      title,
      description,
      url: roomUrl,
      siteName: SITE_META.name,
      locale: 'en_US',
      images: [
        {
          url: roomImage,
          alt: `${SITE_META.name} room preview`,
          width: 1200,
          height: 630,
          type: 'image/png',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [roomImage],
    },
  }
}
