import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  isPaired as checkIsPaired,
  getClientId,
  getClientName,
  getCoachName,
  clearAll,
} from '../services/secureStorage';
import { pair as apiPair, onTokenRevoked } from '../services/apiClient';
import { clearQueue } from '../services/offlineQueue';
import type { PairResponse } from '../types/api';

type AuthState =
  | { status: 'loading' }
  | { status: 'unpaired' }
  | {
      status: 'paired';
      clientId: string;
      clientName: string | null;
      coachName: string | null;
    };

interface AuthContextValue {
  auth: AuthState;
  pair: (code: string) => Promise<PairResponse>;
  unpair: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' });

  // Check secure storage on mount
  useEffect(() => {
    (async () => {
      try {
        const paired = await checkIsPaired();
        if (paired) {
          const [clientId, clientName, coachName] = await Promise.all([
            getClientId(),
            getClientName(),
            getCoachName(),
          ]);
          setAuth({
            status: 'paired',
            clientId: clientId!,
            clientName,
            coachName,
          });
        } else {
          setAuth({ status: 'unpaired' });
        }
      } catch {
        setAuth({ status: 'unpaired' });
      }
    })();
  }, []);

  // Listen for token revocation (401 from API)
  useEffect(() => {
    return onTokenRevoked(() => {
      setAuth({ status: 'unpaired' });
    });
  }, []);

  const pair = useCallback(async (code: string): Promise<PairResponse> => {
    const response = await apiPair(code);
    setAuth({
      status: 'paired',
      clientId: response.client_id,
      clientName: response.client?.name ?? null,
      coachName: response.coach?.name ?? null,
    });
    return response;
  }, []);

  const unpair = useCallback(async () => {
    await clearAll();
    await clearQueue();
    setAuth({ status: 'unpaired' });
  }, []);

  return (
    <AuthContext.Provider value={{ auth, pair, unpair }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
