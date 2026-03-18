import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './src/types';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { useNetworkStatus } from './src/hooks/useNetworkStatus';
import { PairingScreen } from './src/screens/PairingScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { ScannerScreen } from './src/screens/ScannerScreen';
import { ProductScreen } from './src/screens/ProductScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { HealthDashboardScreen } from './src/screens/HealthDashboardScreen';
import { CheckInScreen } from './src/screens/CheckInScreen';
import { colors } from './src/constants/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppNavigator() {
  const { auth } = useAuth();
  // Monitors connectivity; drains offline queue when network returns
  useNetworkStatus();

  if (auth.status === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: colors.textLight,
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        {auth.status === 'unpaired' ? (
          <Stack.Screen
            name="Pairing"
            component={PairingScreen}
            options={{ headerShown: false }}
          />
        ) : (
          <>
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="CheckIn"
              component={CheckInScreen}
              options={{ title: 'Daily Check-In' }}
            />
            <Stack.Screen
              name="Scanner"
              component={ScannerScreen}
              options={{ title: 'Scan Barcode' }}
            />
            <Stack.Screen
              name="Product"
              component={ProductScreen}
              options={{ title: 'Nutrition Info' }}
            />
            <Stack.Screen
              name="History"
              component={HistoryScreen}
              options={{ title: 'Scan History' }}
            />
            <Stack.Screen
              name="HealthDashboard"
              component={HealthDashboardScreen}
              options={{ title: 'Health Data' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
