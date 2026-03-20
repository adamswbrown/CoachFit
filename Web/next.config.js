/** @type {import('next').NextConfig} */

// Security headers configuration
const securityHeaders = [
  // Prevent clickjacking
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  // Prevent MIME type sniffing
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  // Control referrer information
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  // XSS protection (legacy but still useful)
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  // Permissions policy (disable unused features)
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // HSTS - only in production
  ...(process.env.NODE_ENV === "production"
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
]

const nextConfig = {
  // Use Turbopack (default in Next.js 16)
  // Browser extension errors are handled by ErrorBoundary component
  turbopack: {
    root: __dirname,
  },
  // Disable dev overlay in production
  devIndicators: {
    buildActivity: false,
    buildActivityPosition: "bottom-right",
  },
  // Logging configuration
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  outputFileTracingRoot: __dirname,

  // Security headers for all routes
  async headers() {
    return [
      {
        // Apply to all routes
        source: "/:path*",
        headers: securityHeaders,
      },
    ]
  },
}

module.exports = nextConfig
