import { Stack } from 'expo-router';
import { useAuth } from '@/context/auth';
import { colors } from '@/theme';

export default function AppLayout() {
  const { user } = useAuth();
  const isCustomer = user?.role === 'customer';
  const isAdmin = user?.role === 'admin';

  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.primary,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.bg },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="order/[id]" options={{ title: 'Order details' }} />
      <Stack.Screen name="help" options={{ title: 'Help & FAQ' }} />
      <Stack.Screen name="change-password" options={{ title: 'Change password' }} />
      <Stack.Protected guard={isCustomer}>
        <Stack.Screen name="new-order" options={{ title: 'New pre-order', presentation: 'modal' }} />
      </Stack.Protected>
      <Stack.Protected guard={isAdmin}>
        <Stack.Screen name="admin/staff" options={{ title: 'Team & users' }} />
        <Stack.Screen name="admin/warehouses" options={{ title: 'Warehouses' }} />
      </Stack.Protected>
    </Stack>
  );
}
