import * as SQLite from 'expo-sqlite';
import type { Product } from '../types';

export interface FoodLogEntry {
  id: number;
  date: string;
  barcode: string;
  name: string;
  brand: string;
  servingGrams: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  loggedAt: string;
}

export interface DayTotal {
  date: string;
  totalCalories: number;
  totalProtein: number;
  totalFat: number;
  totalCarbs: number;
  itemCount: number;
}

let db: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('coachfit.db');
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS food_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        barcode TEXT NOT NULL,
        name TEXT NOT NULL,
        brand TEXT NOT NULL,
        serving_grams REAL NOT NULL,
        calories REAL NOT NULL,
        protein REAL NOT NULL DEFAULT 0,
        fat REAL NOT NULL DEFAULT 0,
        carbs REAL NOT NULL DEFAULT 0,
        logged_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_food_log_date ON food_log(date);
    `);
  }
  return db;
}

/** Log a food item for a given serving size. */
export async function logFood(
  product: Product,
  servingGrams: number,
): Promise<FoodLogEntry> {
  const database = await getDb();
  const ratio = servingGrams / 100;
  const date = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();

  const calories = Math.round(product.caloriesPer100g * ratio);
  const protein = Math.round(product.proteinPer100g * ratio * 10) / 10;
  const fat = Math.round(product.fatPer100g * ratio * 10) / 10;
  const carbs = Math.round(product.carbsPer100g * ratio * 10) / 10;

  const result = await database.runAsync(
    `INSERT INTO food_log (date, barcode, name, brand, serving_grams, calories, protein, fat, carbs, logged_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [date, product.barcode, product.name, product.brand, servingGrams, calories, protein, fat, carbs, now],
  );

  return {
    id: result.lastInsertRowId,
    date,
    barcode: product.barcode,
    name: product.name,
    brand: product.brand,
    servingGrams,
    calories,
    protein,
    fat,
    carbs,
    loggedAt: now,
  };
}

/** Get all food log entries for a specific date. */
export async function getDayLog(date: string): Promise<FoodLogEntry[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<{
    id: number;
    date: string;
    barcode: string;
    name: string;
    brand: string;
    serving_grams: number;
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    logged_at: string;
  }>('SELECT * FROM food_log WHERE date = ? ORDER BY logged_at DESC', [date]);

  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    barcode: r.barcode,
    name: r.name,
    brand: r.brand,
    servingGrams: r.serving_grams,
    calories: r.calories,
    protein: r.protein,
    fat: r.fat,
    carbs: r.carbs,
    loggedAt: r.logged_at,
  }));
}

/** Get daily totals for the last N days. */
export async function getWeekTotals(days: number = 7): Promise<DayTotal[]> {
  const database = await getDb();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));
  const startStr = startDate.toISOString().split('T')[0];

  const rows = await database.getAllAsync<{
    date: string;
    total_calories: number;
    total_protein: number;
    total_fat: number;
    total_carbs: number;
    item_count: number;
  }>(
    `SELECT date,
            SUM(calories) as total_calories,
            SUM(protein) as total_protein,
            SUM(fat) as total_fat,
            SUM(carbs) as total_carbs,
            COUNT(*) as item_count
     FROM food_log
     WHERE date >= ?
     GROUP BY date
     ORDER BY date DESC`,
    [startStr],
  );

  return rows.map((r) => ({
    date: r.date,
    totalCalories: Math.round(r.total_calories),
    totalProtein: Math.round(r.total_protein * 10) / 10,
    totalFat: Math.round(r.total_fat * 10) / 10,
    totalCarbs: Math.round(r.total_carbs * 10) / 10,
    itemCount: r.item_count,
  }));
}

/** Get total calories for a specific date. */
export async function getDayCalories(date: string): Promise<number> {
  const database = await getDb();
  const row = await database.getFirstAsync<{ total: number }>(
    'SELECT COALESCE(SUM(calories), 0) as total FROM food_log WHERE date = ?',
    [date],
  );
  return Math.round(row?.total ?? 0);
}

/** Delete a food log entry by ID. */
export async function deleteLogEntry(id: number): Promise<void> {
  const database = await getDb();
  await database.runAsync('DELETE FROM food_log WHERE id = ?', [id]);
}
