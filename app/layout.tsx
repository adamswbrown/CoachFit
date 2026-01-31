import type { Metadata, Viewport } from "next"
import Script from "next/script"
import { SpeedInsights } from "@vercel/speed-insights/next"
import "./globals.css"
import { SessionProvider } from "@/components/SessionProvider"
import { RoleProvider } from "@/contexts/RoleContext"
import { PWAProvider } from "@/components/PWAProvider"
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt"
import { OfflineIndicator } from "@/components/OfflineIndicator"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1E3A8A" },
    { media: "(prefers-color-scheme: dark)", color: "#1E3A8A" },
  ],
}

export const metadata: Metadata = {
  title: "CoachFit",
  description: "Fitness data tracking for coaches and clients",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CoachFit",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="font-sans">
        <Script
          id="suppress-extension-errors"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Suppress browser extension errors that can't be caught by React
                const originalError = window.onerror;
                window.onerror = function(message, source, lineno, colno, error) {
                  if (
                    typeof message === 'string' && (
                      message.includes('tab.id') ||
                      message.includes('webkit-masked-url') ||
                      (source && (
                        source.includes('webkit-masked-url') ||
                        source.includes('chrome-extension') ||
                        source.includes('moz-extension') ||
                        source.includes('safari-extension')
                      ))
                    )
                  ) {
                    console.warn('Suppressed browser extension error:', message);
                    return true; // Prevent default error handling
                  }
                  if (originalError) {
                    return originalError.apply(this, arguments);
                  }
                  return false;
                };
                
                window.addEventListener('error', function(event) {
                  if (
                    (event.message && (
                      event.message.includes('tab.id') ||
                      event.message.includes('webkit-masked-url')
                    )) ||
                    (event.filename && (
                      event.filename.includes('webkit-masked-url') ||
                      event.filename.includes('chrome-extension') ||
                      event.filename.includes('moz-extension') ||
                      event.filename.includes('safari-extension')
                    ))
                  ) {
                    console.warn('Suppressed browser extension error:', event.message);
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();
                  }
                }, true);
                
                window.addEventListener('unhandledrejection', function(event) {
                  const reason = event.reason?.message || String(event.reason || '');
                  const stack = event.reason?.stack || '';
                  if (
                    reason.includes('tab.id') ||
                    reason.includes('webkit-masked-url') ||
                    stack.includes('webkit-masked-url') ||
                    reason.includes('Extension context invalidated')
                  ) {
                    console.warn('Suppressed browser extension promise rejection:', reason);
                    event.preventDefault();
                    event.stopPropagation();
                  }
                });
              })();
            `,
          }}
        />
        <SessionProvider>
          <RoleProvider>
            <PWAProvider>
              <OfflineIndicator />
              {children}
              <PWAInstallPrompt />
            </PWAProvider>
          </RoleProvider>
        </SessionProvider>
        <SpeedInsights />
      </body>
    </html>
  )
}
