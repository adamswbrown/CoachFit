import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { drainQueue } from '../services/offlineQueue';

/**
 * Monitors network connectivity by pinging the API on foreground.
 * When connectivity is restored after being offline, drains the
 * offline sync queue automatically.
 */
export function useNetworkStatus() {
  const [online, setOnline] = useState(true);
  const wasOffline = useRef(false);

  useEffect(() => {
    // Check connectivity on app foreground
    const subscription = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') return;

      try {
        // Simple connectivity check — HEAD request with short timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        await fetch('https://clients3.google.com/generate_204', {
          method: 'HEAD',
          signal: controller.signal,
        });
        clearTimeout(timeout);

        setOnline(true);

        // If we were offline and are now back, drain the queue
        if (wasOffline.current) {
          wasOffline.current = false;
          drainQueue().catch(() => {}); // Best-effort
        }
      } catch {
        setOnline(false);
        wasOffline.current = true;
      }
    });

    return () => subscription.remove();
  }, []);

  return { online };
}
