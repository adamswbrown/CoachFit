import { COACHFIT_API_BASE_URL } from '../constants/api';
import {
  getDeviceToken,
  setDeviceToken,
  setClientId,
  setClientName,
  setCoachName,
  clearAll,
} from './secureStorage';
import { enqueue } from './offlineQueue';
import type {
  PairResponse,
  IngestEntryPayload,
  IngestWorkoutsPayload,
  IngestSleepPayload,
  IngestStepsPayload,
  IngestProfilePayload,
  IngestResponse,
} from '../types/api';

const REQUEST_TIMEOUT_MS = 15_000;

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/** Listeners notified when the device token is revoked (401 from server). */
const tokenRevokedListeners: Array<() => void> = [];

export function onTokenRevoked(listener: () => void): () => void {
  tokenRevokedListeners.push(listener);
  return () => {
    const idx = tokenRevokedListeners.indexOf(listener);
    if (idx >= 0) tokenRevokedListeners.splice(idx, 1);
  };
}

function notifyTokenRevoked() {
  tokenRevokedListeners.forEach((fn) => fn());
}

async function authenticatedFetch(
  path: string,
  options?: { method?: string; body?: object }
): Promise<Response> {
  const token = await getDeviceToken();
  if (!token) throw new AuthError('Not paired');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${COACHFIT_API_BASE_URL}${path}`, {
      method: options?.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Pairing-Token': token,
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    if (response.status === 401) {
      await clearAll();
      notifyTokenRevoked();
      throw new AuthError(
        'Your device was disconnected. Please ask your coach for a new pairing code.'
      );
    }

    return response;
  } catch (err) {
    // On network/timeout error for POST requests, queue for offline retry
    if (err instanceof AuthError) throw err;
    if (options?.method === 'POST' && options.body) {
      await enqueue(path, options.body);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Pair this device with a coach using an 8-character pairing code.
 * Stores device token and client/coach info in secure storage.
 */
export async function pair(code: string): Promise<PairResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${COACHFIT_API_BASE_URL}/api/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.toUpperCase().trim() }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `Pairing failed (${response.status})`);
    }

    const data: PairResponse = await response.json();

    // Persist credentials
    await setDeviceToken(data.device_token);
    await setClientId(data.client_id);
    if (data.client?.name) await setClientName(data.client.name);
    if (data.coach?.name) await setCoachName(data.coach.name);

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

/** Submit a daily nutrition/check-in entry. */
export async function submitEntry(payload: IngestEntryPayload): Promise<IngestResponse> {
  const res = await authenticatedFetch('/api/ingest/entry', {
    method: 'POST',
    body: payload,
  });
  return res.json();
}

/** Submit HealthKit workouts. */
export async function submitWorkouts(payload: IngestWorkoutsPayload): Promise<IngestResponse> {
  const res = await authenticatedFetch('/api/ingest/workouts', {
    method: 'POST',
    body: payload,
  });
  return res.json();
}

/** Submit sleep records. */
export async function submitSleep(payload: IngestSleepPayload): Promise<IngestResponse> {
  const res = await authenticatedFetch('/api/ingest/sleep', {
    method: 'POST',
    body: payload,
  });
  return res.json();
}

/** Submit step counts. */
export async function submitSteps(payload: IngestStepsPayload): Promise<IngestResponse> {
  const res = await authenticatedFetch('/api/ingest/steps', {
    method: 'POST',
    body: payload,
  });
  return res.json();
}

/** Submit body metrics (weight, height, body fat, lean mass). */
export async function submitProfile(payload: IngestProfilePayload): Promise<IngestResponse> {
  const res = await authenticatedFetch('/api/ingest/profile', {
    method: 'POST',
    body: payload,
  });
  return res.json();
}
