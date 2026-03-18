import { getClientId } from './secureStorage';
import { submitEntry } from './apiClient';
import { addScannedNutrition } from './dailyAccumulator';
import { AuthError } from './apiClient';
import type { Product } from '../types';

/**
 * Log a scanned product's nutrition and sync the accumulated daily totals
 * to the CoachFit platform.
 *
 * Flow:
 * 1. Calculate nutrition for the serving size
 * 2. Add to local daily accumulator (running total across all scans)
 * 3. Submit accumulated totals to /api/ingest/entry
 *
 * The ingest/entry endpoint uses fill-only merge on the backend,
 * but since we always send the full accumulated total it will
 * create on first call and the values stay correct.
 */
export async function syncScannedProduct(
  product: Product,
  servingGrams: number
): Promise<{ synced: boolean; error?: string }> {
  const clientId = await getClientId();
  if (!clientId) return { synced: false, error: 'Not paired' };

  const ratio = servingGrams / 100;
  const today = new Date().toISOString().split('T')[0];

  // Accumulate locally
  const totals = await addScannedNutrition(
    today,
    Math.round(product.caloriesPer100g * ratio),
    Math.round(product.proteinPer100g * ratio * 10) / 10,
    Math.round(product.carbsPer100g * ratio * 10) / 10,
    Math.round(product.fatPer100g * ratio * 10) / 10,
    Math.round(product.fiberPer100g * ratio * 10) / 10
  );

  // Sync accumulated totals to platform
  try {
    await submitEntry({
      client_id: clientId,
      date: today,
      calories: Math.round(totals.calories),
      proteinGrams: Math.round(totals.protein * 10) / 10,
      carbsGrams: Math.round(totals.carbs * 10) / 10,
      fatGrams: Math.round(totals.fat * 10) / 10,
      fiberGrams: Math.round(totals.fiber * 10) / 10,
    });
    return { synced: true };
  } catch (err) {
    // Don't throw on sync failure — local accumulation succeeded
    if (err instanceof AuthError) throw err; // Re-throw auth errors for sign-out handling
    const message = err instanceof Error ? err.message : 'Sync failed';
    return { synced: false, error: message };
  }
}
