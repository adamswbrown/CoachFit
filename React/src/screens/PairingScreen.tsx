import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { colors, spacing, fontSize, borderRadius } from '../constants/theme';

// Valid pairing code characters (excludes ambiguous O, I, 0, 1)
const VALID_CHARS = /^[A-HJ-NP-Z2-9]*$/i;
const CODE_LENGTH = 8;

export function PairingScreen() {
  const { pair } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);

  function handleCodeChange(text: string) {
    // Filter to valid characters only
    const filtered = text.replace(/[^A-HJ-NP-Z2-9]/gi, '').toUpperCase();
    if (filtered.length <= CODE_LENGTH) {
      setCode(filtered);
      setError(null);
    }
  }

  async function handlePair() {
    if (code.length !== CODE_LENGTH) {
      setError(`Code must be ${CODE_LENGTH} characters`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await pair(code);
      // AuthContext updates state → App.tsx navigates automatically
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pairing failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>CoachFit</Text>
          <Text style={styles.subtitle}>Connect to your coach</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.instructions}>
            Enter the 8-character pairing code from your coach to connect your device.
          </Text>

          <TextInput
            ref={inputRef}
            style={[styles.codeInput, error ? styles.codeInputError : null]}
            value={code}
            onChangeText={handleCodeChange}
            placeholder="A1B2C3D4"
            placeholderTextColor={colors.border}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={CODE_LENGTH}
            returnKeyType="done"
            onSubmitEditing={handlePair}
            editable={!loading}
            textAlign="center"
          />

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[
              styles.button,
              (code.length !== CODE_LENGTH || loading) && styles.buttonDisabled,
            ]}
            onPress={handlePair}
            disabled={code.length !== CODE_LENGTH || loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.textLight} />
            ) : (
              <Text style={styles.buttonText}>Connect</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.helpText}>
          Ask your coach to generate a pairing code from the CoachFit dashboard.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: fontSize.hero,
    fontWeight: '700',
    color: colors.primary,
  },
  subtitle: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  instructions: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  codeInput: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: fontSize.xxl,
    fontWeight: '700',
    letterSpacing: 4,
    color: colors.text,
    backgroundColor: colors.background,
    marginBottom: spacing.md,
  },
  codeInputError: {
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    backgroundColor: colors.border,
  },
  buttonText: {
    color: colors.textLight,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  helpText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 18,
  },
});
