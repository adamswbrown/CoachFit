import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * Calls `callback` when the app transitions from background to foreground.
 * Does NOT fire on initial mount — only on subsequent foreground events.
 */
export function useAppForeground(callback: () => void) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    let previous: AppStateStatus = AppState.currentState;

    const subscription = AppState.addEventListener('change', (next) => {
      if (previous.match(/inactive|background/) && next === 'active') {
        callbackRef.current();
      }
      previous = next;
    });

    return () => subscription.remove();
  }, []);
}
