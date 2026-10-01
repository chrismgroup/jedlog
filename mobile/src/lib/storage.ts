import * as SecureStore from 'expo-secure-store';

const REFRESH_KEY = 'jetlog.refreshToken';
const BIOMETRIC_KEY = 'jetlog.biometricLock';

// Tokens never leave this device (no iCloud/backup migration) and are readable only while unlocked.
const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const secureStorage = {
  getRefreshToken: () => SecureStore.getItemAsync(REFRESH_KEY, options),
  setRefreshToken: (token: string) => SecureStore.setItemAsync(REFRESH_KEY, token, options),
  clearRefreshToken: () => SecureStore.deleteItemAsync(REFRESH_KEY, options),
  getBiometricLock: async () => (await SecureStore.getItemAsync(BIOMETRIC_KEY, options)) === 'on',
  setBiometricLock: (on: boolean) => SecureStore.setItemAsync(BIOMETRIC_KEY, on ? 'on' : 'off', options),
};
