import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { api, refreshSession, setAccessToken, setSessionExpiredHandler } from '@/lib/api';
import { secureStorage } from '@/lib/storage';
import { getPushToken } from '@/lib/push';
import type { User } from '@/lib/types';

const LOCK_AFTER_MS = 60_000;

interface AuthContextValue {
  user: User | null;
  initializing: boolean;
  locked: boolean;
  biometricEnabled: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (data: Parameters<typeof api.register>[0]) => Promise<void>;
  signOut: () => Promise<void>;
  unlock: () => Promise<boolean>;
  setBiometricEnabled: (on: boolean) => Promise<boolean>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [locked, setLocked] = useState(false);
  const [biometricEnabled, setBiometric] = useState(false);
  const pushToken = useRef<string | null>(null);
  const backgroundedAt = useRef<number | null>(null);

  const clearLocalSession = useCallback(async () => {
    setAccessToken(null);
    await secureStorage.clearRefreshToken();
    setUser(null);
    setLocked(false);
  }, []);

  const registerPush = useCallback(async () => {
    const token = await getPushToken();
    if (token) {
      pushToken.current = token;
      api.registerPushToken(token).catch(() => {});
    }
  }, []);

  const startSession = useCallback(
    async (res: { user: User; accessToken: string; refreshToken: string }) => {
      setAccessToken(res.accessToken);
      await secureStorage.setRefreshToken(res.refreshToken);
      setUser(res.user);
      registerPush();
    },
    [registerPush],
  );

  useEffect(() => {
    setSessionExpiredHandler(() => {
      clearLocalSession();
    });

    (async () => {
      try {
        const bio = await secureStorage.getBiometricLock();
        setBiometric(bio);
        if (await refreshSession()) {
          const { user: me } = await api.me();
          setUser(me);
          if (bio) setLocked(true);
          registerPush();
        }
      } catch {
        // Offline or expired: fall through to sign-in screen.
      } finally {
        setInitializing(false);
      }
    })();
  }, [clearLocalSession, registerPush]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') backgroundedAt.current = Date.now();
      if (state === 'active' && backgroundedAt.current && biometricEnabled && user) {
        if (Date.now() - backgroundedAt.current > LOCK_AFTER_MS) setLocked(true);
        backgroundedAt.current = null;
      }
    });
    return () => sub.remove();
  }, [biometricEnabled, user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      locked,
      biometricEnabled,
      signIn: async (email, password) => startSession(await api.login(email, password)),
      register: async (data) => startSession(await api.register(data)),
      signOut: async () => {
        try {
          if (pushToken.current) await api.unregisterPushToken(pushToken.current);
          const refreshToken = await secureStorage.getRefreshToken();
          if (refreshToken) await api.logout(refreshToken);
        } catch {
          // Still clear locally even if the server can't be reached.
        }
        pushToken.current = null;
        await clearLocalSession();
      },
      unlock: async () => {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Unlock Jetlog',
          fallbackLabel: 'Use passcode',
        });
        if (result.success) setLocked(false);
        return result.success;
      },
      setBiometricEnabled: async (on) => {
        if (on) {
          const hasHardware = await LocalAuthentication.hasHardwareAsync();
          const enrolled = await LocalAuthentication.isEnrolledAsync();
          if (!hasHardware || !enrolled) return false;
          const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Confirm to enable app lock' });
          if (!result.success) return false;
        }
        await secureStorage.setBiometricLock(on);
        setBiometric(on);
        return true;
      },
      refreshUser: async () => {
        const { user: me } = await api.me();
        setUser(me);
      },
    }),
    [user, initializing, locked, biometricEnabled, startSession, clearLocalSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
