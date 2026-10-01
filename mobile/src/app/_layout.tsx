import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/context/auth';
import { Loading } from '@/components/ui';
import { LockScreen } from '@/components/LockScreen';
import { colors } from '@/theme';

function useNotificationNavigation(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const open = (n: Notifications.Notification) => {
      const orderId = n.request.content.data?.orderId;
      // Only route to well-formed IDs coming from our own push payloads.
      if (typeof orderId === 'string' && /^[0-9a-f-]{36}$/i.test(orderId)) {
        router.push({ pathname: '/order/[id]', params: { id: orderId } });
      }
    };
    const last = Notifications.getLastNotificationResponse();
    if (last?.notification) open(last.notification);
    const sub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification));
    return () => sub.remove();
  }, [enabled]);
}

function RootNavigator() {
  const { user, initializing, locked } = useAuth();
  useNotificationNavigation(!!user && !locked);

  if (initializing) return <Loading />;

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={!!user}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!user}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
      {user && locked ? <LockScreen /> : null}
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
