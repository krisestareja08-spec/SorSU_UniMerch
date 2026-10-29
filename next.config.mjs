/** Security headers on every response. Data is encrypted in transit (HTTPS/TLS, enforced by HSTS)
 *  and at rest by Supabase (AES-256 on the database and storage). */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nobody may embed UniMerch in a frame (clickjacking)
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
]

// Product photos, logos and banners live in the project's Supabase Storage
const storageHost = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname } catch { return "" }
})()

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Only Storage photos are optimized (components/ui/smart-image.tsx leaves other hosts as they are)
    remotePatterns: storageHost ? [{ protocol: "https", hostname: storageHost, pathname: "/storage/v1/object/public/**" }] : [],
    // Every upload gets a new file name, so a resized copy never goes stale: keep it 31 days
    minimumCacheTTL: 2678400,
  },
  // allow accessing the dev server from other devices on the LAN (e.g. phone testing)
  allowedDevOrigins: ["192.168.56.1"],
  experimental: {
    // PWA: detect lost connections, retry navigations / Server Actions when back online (useOffline hook)
    useOffline: true,
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // The service worker must never be cached, or installed apps keep running an old version
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ]
  },
}

export default nextConfig
