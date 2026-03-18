import * as SQLite from 'expo-sqlite';
import { getDeviceToken } from './secureStorage';
import { COACHFIT_API_BASE_URL } from '../constants/api';

const MAX_ATTEMPTS = 3;

let db: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('coachfit.db');
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        endpoint TEXT NOT NULL,
        payload TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
    `);
  }
  return db;
}

/** Add a failed request to the offline queue. */
export async function enqueue(endpoint: string, payload: object): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    'INSERT INTO sync_queue (endpoint, payload, created_at) VALUES (?, ?, ?)',
    [endpoint, JSON.stringify(payload), new Date().toISOString()]
  );
}

/** Get the number of pending items in the queue. */
export async function getQueueSize(): Promise<number> {
  const database = await getDb();
  const row = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM sync_queue WHERE attempts < ?',
    [MAX_ATTEMPTS]
  );
  return row?.count ?? 0;
}

export interface DrainResult {
  sent: number;
  failed: number;
  dropped: number;
}

/**
 * Attempt to send all queued requests.
 * Items that succeed are deleted. Items that fail get their attempt count
 * incremented. Items that exceed MAX_ATTEMPTS are dropped.
 */
export async function drainQueue(): Promise<DrainResult> {
  const token = await getDeviceToken();
  if (!token) return { sent: 0, failed: 0, dropped: 0 };

  const database = await getDb();
  const rows = await database.getAllAsync<{
    id: number;
    endpoint: string;
    payload: string;
    attempts: number;
  }>('SELECT id, endpoint, payload, attempts FROM sync_queue ORDER BY id ASC LIMIT 50');

  const result: DrainResult = { sent: 0, failed: 0, dropped: 0 };

  for (const row of rows) {
    // Drop items that have exceeded max attempts
    if (row.attempts >= MAX_ATTEMPTS) {
      await database.runAsync('DELETE FROM sync_queue WHERE id = ?', [row.id]);
      result.dropped++;
      continue;
    }

    try {
      const response = await fetch(`${COACHFIT_API_BASE_URL}${row.endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Pairing-Token': token,
        },
        body: row.payload,
      });

      if (response.ok) {
        await database.runAsync('DELETE FROM sync_queue WHERE id = ?', [row.id]);
        result.sent++;
      } else if (response.status === 401) {
        // Token revoked — clear entire queue, caller handles sign-out
        await database.runAsync('DELETE FROM sync_queue');
        return result;
      } else {
        await database.runAsync(
          'UPDATE sync_queue SET attempts = attempts + 1 WHERE id = ?',
          [row.id]
        );
        result.failed++;
      }
    } catch {
      // Network still down — stop draining, try again later
      result.failed++;
      break;
    }
  }

  return result;
}

/** Clear the entire queue (used on unpair/sign-out). */
export async function clearQueue(): Promise<void> {
  const database = await getDb();
  await database.runAsync('DELETE FROM sync_queue');
}
