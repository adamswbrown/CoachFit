import React, { useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useProductLookup } from '../hooks/useProductLookup';
import { NutritionCard } from '../components/NutritionCard';
import { ServingCalculator } from '../components/ServingCalculator';
import { ManualProductEntry } from '../components/ManualProductEntry';
import { writeScannedProduct } from '../services/health';
import { syncScannedProduct } from '../services/nutritionSync';
import { logFood } from '../services/foodLog';
import { useAuth } from '../contexts/AuthContext';
import { colors, spacing, fontSize, borderRadius } from '../constants/theme';
import type { Product } from '../types';

type RouteType = RouteProp<RootStackParamList, 'Product'>;
type Nav = NativeStackNavigationProp<RootStackParamList, 'Product'>;

export function ProductScreen() {
  const route = useRoute<RouteType>();
  const navigation = useNavigation<Nav>();
  const { barcode } = route.params;
  const lookupState = useProductLookup(barcode);
  const [manualProduct, setManualProduct] = useState<Product | null>(null);
  const state = manualProduct ? { status: 'found' as const, product: manualProduct } : lookupState;
  const { auth } = useAuth();
  const [healthLogged, setHealthLogged] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'failed'>('idle');
  const [servingGrams, setServingGrams] = useState(0);

  async function handleLogFood() {
    if (state.status !== 'found') return;
    const grams = servingGrams > 0 ? servingGrams : state.product.servingSizeGrams;
    const cals = Math.round((state.product.caloriesPer100g * grams) / 100);

    try {
      // Log to food diary
      await logFood(state.product, grams);

      // Write to HealthKit (optional — don't block on failure)
      try {
        await writeScannedProduct(state.product, grams);
      } catch {
        // HealthKit not connected
      }

      setHealthLogged(true);

      // Sync to CoachFit platform if paired
      if (auth.status === 'paired') {
        setSyncStatus('syncing');
        const result = await syncScannedProduct(state.product, grams);
        setSyncStatus(result.synced ? 'synced' : 'failed');
      }

      Alert.alert('Logged', `${state.product.name} logged (${cals} kcal)`);
    } catch {
      Alert.alert('Error', 'Could not log food. Please try again.');
    }
  }

  if (state.status === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Looking up product...</Text>
        <Text style={styles.barcodeText}>{barcode}</Text>
      </View>
    );
  }

  if (state.status === 'not_found') {
    return (
      <ManualProductEntry
        barcode={barcode}
        onProductSaved={(product) => setManualProduct(product)}
        onCancel={() => navigation.navigate('Scanner')}
      />
    );
  }

  if (state.status === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{state.message}</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Scanner')}
        >
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <NutritionCard product={state.product} />
      <ServingCalculator product={state.product} onServingChange={setServingGrams} />
      <TouchableOpacity
        style={[styles.healthButton, healthLogged && styles.healthButtonLogged]}
        onPress={handleLogFood}
        disabled={healthLogged}
      >
        <Text style={styles.healthButtonText}>
          {healthLogged ? 'Logged' : 'Log Food'}
        </Text>
      </TouchableOpacity>
      {syncStatus !== 'idle' && (
        <Text style={[
          styles.syncStatus,
          syncStatus === 'synced' && styles.syncStatusSuccess,
          syncStatus === 'failed' && styles.syncStatusError,
        ]}>
          {syncStatus === 'syncing' && 'Syncing to CoachFit...'}
          {syncStatus === 'synced' && 'Synced to CoachFit'}
          {syncStatus === 'failed' && 'Sync failed - will retry later'}
        </Text>
      )}
      <TouchableOpacity
        style={styles.scanAgainButton}
        onPress={() => navigation.navigate('Scanner')}
      >
        <Text style={styles.scanAgainText}>Scan Another</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing.xl,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  loadingText: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  barcodeText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    fontFamily: 'monospace',
  },
  errorText: {
    fontSize: fontSize.lg,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
  },
  buttonText: {
    color: colors.textLight,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  healthButton: {
    backgroundColor: '#E91E63',
    paddingVertical: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  healthButtonLogged: {
    backgroundColor: colors.textSecondary,
  },
  healthButtonText: {
    color: colors.textLight,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  syncStatus: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginHorizontal: spacing.md,
  },
  syncStatusSuccess: {
    color: colors.primary,
  },
  syncStatusError: {
    color: colors.accent,
  },
  scanAgainButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  scanAgainText: {
    color: colors.textLight,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
});
