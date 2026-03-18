import * as SecureStore from 'expo-secure-store';

const KEYS = {
  DEVICE_TOKEN: 'coachfit_device_token',
  CLIENT_ID: 'coachfit_client_id',
  CLIENT_NAME: 'coachfit_client_name',
  COACH_NAME: 'coachfit_coach_name',
  LAST_SYNC_AT: 'coachfit_last_sync_at',
} as const;

export async function getDeviceToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.DEVICE_TOKEN);
}

export async function setDeviceToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.DEVICE_TOKEN, token);
}

export async function getClientId(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.CLIENT_ID);
}

export async function setClientId(id: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.CLIENT_ID, id);
}

export async function getClientName(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.CLIENT_NAME);
}

export async function setClientName(name: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.CLIENT_NAME, name);
}

export async function getCoachName(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.COACH_NAME);
}

export async function setCoachName(name: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.COACH_NAME, name);
}

export async function getLastSyncTimestamp(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.LAST_SYNC_AT);
}

export async function setLastSyncTimestamp(iso: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.LAST_SYNC_AT, iso);
}

export async function isPaired(): Promise<boolean> {
  const token = await getDeviceToken();
  return token !== null;
}

export async function clearAll(): Promise<void> {
  await Promise.all(
    Object.values(KEYS).map((key) => SecureStore.deleteItemAsync(key))
  );
}
