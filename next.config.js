/** @type {import('next').NextConfig} */
const nextConfig = {
  // Removed 'output: export' to enable API routes
  images: {
    unoptimized: true,
  },
  // Optional: Add any other config you need
  reactStrictMode: true,
  swcMinify: true,
}

module.exports = nextConfig
