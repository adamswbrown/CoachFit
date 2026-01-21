import type { Metadata } from "next"
import Script from "next/script"
import { SpeedInsights } from "@vercel/speed-insights/next"
import "./globals.css"
import { SessionProvider } from "@/components/SessionProvider"
import { RoleProvider } from "@/contexts/RoleContext"

export const metadata: Metadata = {
  title: "CoachFit",
  description: "Fitness data tracking for coaches and clients",
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
          <RoleProvider>{children}</RoleProvider>
        </SessionProvider>
        <SpeedInsights />
      </body>
    </html>
  )
}
