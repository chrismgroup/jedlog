import { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { api, setAccessToken } from '@/lib/api';
import { secureStorage } from '@/lib/storage';
import { passwordChecks } from '@/lib/format';
import { Button, ErrorBanner, HelpTip, Input, Screen } from '@/components/ui';

export default function ChangePassword() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!passwordChecks(next).every((c) => c.ok)) return setError('New password must be 10+ characters with upper, lower case and a number.');
    if (next !== confirm) return setError('New passwords do not match.');
    setLoading(true);
    try {
      const tokens = await api.changePassword(current, next);
      setAccessToken(tokens.accessToken);
      await secureStorage.setRefreshToken(tokens.refreshToken);
      Alert.alert('Password changed', 'You have been signed out on all other devices.');
      router.back();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <HelpTip icon="shield-checkmark-outline">Changing your password signs you out everywhere else.</HelpTip>
      <ErrorBanner message={error} />
      <Input label="Current password" value={current} onChangeText={setCurrent} secure autoCapitalize="none" textContentType="password" />
      <Input label="New password" value={next} onChangeText={setNext} secure autoCapitalize="none" textContentType="newPassword" hint="10+ characters, upper & lower case, and a number." />
      <Input label="Confirm new password" value={confirm} onChangeText={setConfirm} secure autoCapitalize="none" textContentType="newPassword" />
      <Button title="Update password" onPress={submit} loading={loading} />
    </Screen>
  );
}
