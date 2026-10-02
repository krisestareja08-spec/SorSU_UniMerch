/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // allow accessing the dev server from other devices on the LAN (e.g. phone testing)
  allowedDevOrigins: ["192.168.56.1"],
}

export default nextConfig
