import * as SQLite from 'expo-sqlite';

export interface DailyTotals {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

let db: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('coachfit.db');
  }
  return db;
}

/**
 * Add scanned nutrition to today's running totals.
 * Returns the new accumulated totals for the date.
 */
export async function addScannedNutrition(
  date: string,
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
  fiber: number
): Promise<DailyTotals> {
  const database = await getDb();
  const now = new Date().toISOString();

  await database.runAsync(
    `INSERT INTO daily_nutrition (date, calories, protein, carbs, fat, fiber, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       calories = calories + excluded.calories,
       protein = protein + excluded.protein,
       carbs = carbs + excluded.carbs,
       fat = fat + excluded.fat,
       fiber = fiber + excluded.fiber,
       updated_at = excluded.updated_at`,
    [date, calories, protein, carbs, fat, fiber, now]
  );

  return getDailyTotals(date) as Promise<DailyTotals>;
}

/** Get accumulated nutrition totals for a given date. */
export async function getDailyTotals(date: string): Promise<DailyTotals | null> {
  const database = await getDb();
  const row = await database.getFirstAsync<{
    date: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  }>('SELECT date, calories, protein, carbs, fat, fiber FROM daily_nutrition WHERE date = ?', [
    date,
  ]);

  return row ?? null;
}

/** Clear accumulated totals for a given date. */
export async function clearDay(date: string): Promise<void> {
  const database = await getDb();
  await database.runAsync('DELETE FROM daily_nutrition WHERE date = ?', [date]);
}
