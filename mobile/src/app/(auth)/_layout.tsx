import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" options={{ headerShown: true, title: 'Create account', headerShadowVisible: false, headerStyle: { backgroundColor: colors.bg } }} />
    </Stack>
  );
}
