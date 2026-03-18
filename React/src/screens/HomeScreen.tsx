import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  StyleSheet,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList, Product } from '../types';
import { getHistory } from '../services/database';
import { useAuth } from '../contexts/AuthContext';
import { colors, spacing, fontSize, borderRadius } from '../constants/theme';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { auth, unpair } = useAuth();
  const [recentScans, setRecentScans] = useState<Product[]>([]);

  function handleDisconnect() {
    Alert.alert(
      'Disconnect',
      'This will remove the connection to your coach. You can re-pair later with a new code.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disconnect', style: 'destructive', onPress: unpair },
      ]
    );
  }

  useFocusEffect(
    useCallback(() => {
      getHistory(5).then(setRecentScans).catch(() => {});
    }, [])
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>CoachFit</Text>
          {auth.status === 'paired' && (
            <TouchableOpacity onPress={handleDisconnect}>
              <Text style={styles.disconnectText}>Disconnect</Text>
            </TouchableOpacity>
          )}
        </View>
        {auth.status === 'paired' ? (
          <View style={styles.connectionBanner}>
            <View style={styles.connectedDot} />
            <Text style={styles.connectionText}>
              {auth.clientName ? `${auth.clientName} ` : ''}
              {auth.coachName ? `\u00B7 Coach: ${auth.coachName}` : 'Connected'}
            </Text>
          </View>
        ) : (
          <Text style={styles.subtitle}>Scan a barcode to get nutrition info</Text>
        )}
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => navigation.navigate('Scanner')}
        >
          <Text style={styles.scanIcon}>[ ]</Text>
          <Text style={styles.scanButtonText}>Scan Barcode</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.healthButton}
          onPress={() => navigation.navigate('HealthDashboard')}
        >
          <Text style={styles.healthButtonText}>Health Data</Text>
        </TouchableOpacity>
      </View>

      {recentScans.length > 0 && (
        <View style={styles.recentSection}>
          <View style={styles.recentHeader}>
            <Text style={styles.recentTitle}>Recent Scans</Text>
            <TouchableOpacity onPress={() => navigation.navigate('History')}>
              <Text style={styles.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={recentScans}
            keyExtractor={(item) => item.barcode}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.recentItem}
                onPress={() => navigation.navigate('Product', { barcode: item.barcode })}
              >
                <View style={styles.recentInfo}>
                  <Text style={styles.recentName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.recentBrand}>{item.brand}</Text>
                </View>
                <View style={styles.recentCalories}>
                  <Text style={styles.recentCalValue}>
                    {item.caloriesPerServing}
                  </Text>
                  <Text style={styles.recentCalUnit}>kcal/srv</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.primary,
    paddingTop: 60,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
    color: colors.textLight,
  },
  disconnectText: {
    fontSize: fontSize.sm,
    color: colors.primaryLight,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.primaryLight,
    marginTop: spacing.xs,
  },
  connectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  connectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#81C784',
    marginRight: spacing.sm,
  },
  connectionText: {
    fontSize: fontSize.md,
    color: colors.primaryLight,
  },
  buttonRow: {
    marginHorizontal: spacing.lg,
    marginTop: -spacing.md,
  },
  scanButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  healthButton: {
    backgroundColor: '#E91E63',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  healthButtonText: {
    color: colors.textLight,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  scanIcon: {
    fontSize: fontSize.hero,
    color: colors.textLight,
    marginBottom: spacing.xs,
  },
  scanButtonText: {
    color: colors.textLight,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  recentSection: {
    flex: 1,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  recentTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  viewAll: {
    fontSize: fontSize.md,
    color: colors.primary,
    fontWeight: '600',
  },
  recentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  recentInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  recentName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  recentBrand: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  recentCalories: {
    alignItems: 'center',
  },
  recentCalValue: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: colors.accent,
  },
  recentCalUnit: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
});
