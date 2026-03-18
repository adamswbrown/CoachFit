import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import type { Product } from '../types';
import { saveProduct } from '../services/database';
import { colors, spacing, fontSize, borderRadius } from '../constants/theme';

interface Props {
  barcode: string;
  onProductSaved: (product: Product) => void;
  onCancel: () => void;
}

export function ManualProductEntry({ barcode, onProductSaved, onCancel }: Props) {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [servingSize, setServingSize] = useState('');
  const [perServing, setPerServing] = useState(false);
  const [caloriesInput, setCaloriesInput] = useState('');
  const [proteinInput, setProteinInput] = useState('');
  const [fatInput, setFatInput] = useState('');
  const [carbsInput, setCarbsInput] = useState('');
  const [saving, setSaving] = useState(false);

  const brandRef = useRef<TextInput>(null);
  const servingRef = useRef<TextInput>(null);
  const calRef = useRef<TextInput>(null);
  const proteinRef = useRef<TextInput>(null);
  const fatRef = useRef<TextInput>(null);
  const carbsRef = useRef<TextInput>(null);

  const canSave = name.trim() !== '' && servingSize.trim() !== '' && caloriesInput.trim() !== '';

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);

    const servingSizeGrams = parseFloat(servingSize) || 100;
    const rawCalories = parseFloat(caloriesInput) || 0;
    const rawProtein = parseFloat(proteinInput) || 0;
    const rawFat = parseFloat(fatInput) || 0;
    const rawCarbs = parseFloat(carbsInput) || 0;

    // Convert to per-100g if user entered per-serving
    const caloriesPer100g = perServing
      ? (rawCalories / servingSizeGrams) * 100
      : rawCalories;
    const proteinPer100g = perServing
      ? (rawProtein / servingSizeGrams) * 100
      : rawProtein;
    const fatPer100g = perServing
      ? (rawFat / servingSizeGrams) * 100
      : rawFat;
    const carbsPer100g = perServing
      ? (rawCarbs / servingSizeGrams) * 100
      : rawCarbs;

    const product: Product = {
      barcode,
      name: name.trim(),
      brand: brand.trim() || 'Unknown',
      servingSizeLabel: `${servingSizeGrams}g`,
      servingSizeGrams,
      packageSizeGrams: 0,
      caloriesPer100g: Math.round(caloriesPer100g),
      caloriesPerServing: Math.round((caloriesPer100g * servingSizeGrams) / 100),
      caloriesPerPackage: null,
      proteinPer100g: Math.round(proteinPer100g * 10) / 10,
      fatPer100g: Math.round(fatPer100g * 10) / 10,
      carbsPer100g: Math.round(carbsPer100g * 10) / 10,
      sugarsPer100g: 0,
      fiberPer100g: 0,
      sodiumPer100g: 0,
      scannedAt: new Date().toISOString(),
      source: 'manual',
    };

    await saveProduct(product);
    setSaving(false);
    onProductSaved(product);
  }

  const unitLabel = perServing ? 'per serving' : 'per 100g';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Add Product Manually</Text>
        <Text style={styles.subheading}>Barcode: {barcode}</Text>
        <Text style={styles.hint}>
          Enter values from the nutrition label
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>Product Name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Peanut Butter"
            placeholderTextColor={colors.textSecondary}
            returnKeyType="next"
            onSubmitEditing={() => brandRef.current?.focus()}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Brand</Text>
          <TextInput
            ref={brandRef}
            style={styles.input}
            value={brand}
            onChangeText={setBrand}
            placeholder="e.g. Pics (optional)"
            placeholderTextColor={colors.textSecondary}
            returnKeyType="next"
            onSubmitEditing={() => servingRef.current?.focus()}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Serving Size (grams) *</Text>
          <TextInput
            ref={servingRef}
            style={styles.input}
            value={servingSize}
            onChangeText={setServingSize}
            placeholder="e.g. 32"
            placeholderTextColor={colors.textSecondary}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => calRef.current?.focus()}
          />
        </View>

        {/* Toggle: per 100g vs per serving */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleButton, !perServing && styles.toggleActive]}
            onPress={() => setPerServing(false)}
          >
            <Text style={[styles.toggleText, !perServing && styles.toggleTextActive]}>
              Per 100g
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, perServing && styles.toggleActive]}
            onPress={() => setPerServing(true)}
          >
            <Text style={[styles.toggleText, perServing && styles.toggleTextActive]}>
              Per Serving
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Calories ({unitLabel}) *</Text>
          <TextInput
            ref={calRef}
            style={styles.input}
            value={caloriesInput}
            onChangeText={setCaloriesInput}
            placeholder="e.g. 588"
            placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad"
            returnKeyType="next"
            onSubmitEditing={() => proteinRef.current?.focus()}
          />
        </View>

        <View style={styles.macroRow}>
          <View style={styles.macroField}>
            <Text style={styles.label}>Protein (g)</Text>
            <TextInput
              ref={proteinRef}
              style={styles.input}
              value={proteinInput}
              onChangeText={setProteinInput}
              placeholder="0"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
              returnKeyType="next"
              onSubmitEditing={() => fatRef.current?.focus()}
            />
          </View>
          <View style={styles.macroField}>
            <Text style={styles.label}>Fat (g)</Text>
            <TextInput
              ref={fatRef}
              style={styles.input}
              value={fatInput}
              onChangeText={setFatInput}
              placeholder="0"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
              returnKeyType="next"
              onSubmitEditing={() => carbsRef.current?.focus()}
            />
          </View>
          <View style={styles.macroField}>
            <Text style={styles.label}>Carbs (g)</Text>
            <TextInput
              ref={carbsRef}
              style={styles.input}
              value={carbsInput}
              onChangeText={setCarbsInput}
              placeholder="0"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
              returnKeyType="done"
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, (!canSave || saving) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!canSave || saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save Product'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelText}>Scan Another</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  heading: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: colors.text,
  },
  subheading: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontFamily: 'monospace',
    marginTop: spacing.xs,
  },
  hint: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  field: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: fontSize.lg,
    color: colors.text,
  },
  toggleRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  toggleActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: colors.textLight,
  },
  macroRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  macroField: {
    flex: 1,
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: colors.textLight,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  cancelText: {
    color: colors.primary,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
});
