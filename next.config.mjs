/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Leaflet/map images hosted on external domains
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
}

export default nextConfig
