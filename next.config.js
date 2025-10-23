/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for smaller Docker images
  output: 'standalone',
  // Removed 'output: export' to enable API routes
  images: {
    unoptimized: true,
  },
  // Optional: Add any other config you need
  reactStrictMode: true,
  swcMinify: true,
}

module.exports = nextConfig
