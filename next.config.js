/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use Turbopack (default in Next.js 16)
  // Browser extension errors are handled by ErrorBoundary component
  turbopack: {},
  // Logging configuration
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
}

module.exports = nextConfig
