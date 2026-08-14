
import { getWebsiteStructuredData } from '@/lib/seo/structured-data'
import { SITE_META } from '@/lib/seo/config'
import { Metadata } from "next";
import HomePageClient from "./page.client";
import { Analytics } from "@vercel/analytics/next"

export const metadata: Metadata = {
  title: 'ClipYard — Real-Time Text Transfer',
  description:
    'A temporary clipboard for moving text between your laptop, phone, and desktop. No account. No setup.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    title: 'ClipYard — Real-Time Text Transfer',
    description:
      'A temporary clipboard for moving text between your laptop, phone, and desktop. No account. No setup.',
    url: SITE_META.url,
    siteName: SITE_META.name,
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
    title: 'ClipYard — Real-Time Text Transfer',
    description:
      'A temporary clipboard for moving text between your laptop, phone, and desktop. No account. No setup.',
    images: [SITE_META.defaultOgImage],
  },
}
const structuredData = getWebsiteStructuredData()


export default function Page() {

  return (
    <>
    <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <HomePageClient/>
      <Analytics/>
    </>
  );
}
