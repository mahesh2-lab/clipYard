/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["firebase-admin", "jwks-rsa", "jose"],
  allowedDevOrigins: ['10.211.195.85'],
}

export default nextConfig
