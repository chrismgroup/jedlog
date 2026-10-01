import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/auth';
import { Button } from './ui';
import { colors } from '@/theme';

export function LockScreen() {
  const { unlock, signOut, user } = useAuth();

  useEffect(() => {
    unlock();
  }, [unlock]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={styles.container}>
        <View style={styles.icon}>
          <Ionicons name="lock-closed" size={36} color={colors.accent} />
        </View>
        <Text style={styles.title}>Jetlog is locked</Text>
        <Text style={styles.body}>Welcome back{user ? `, ${user.fullName.split(' ')[0]}` : ''}. Unlock to continue.</Text>
        <Button title="Unlock" icon="finger-print" variant="accent" onPress={unlock} style={{ alignSelf: 'stretch' }} />
        <Button title="Sign out" variant="ghost" onPress={signOut} style={{ alignSelf: 'stretch', marginTop: 8 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', padding: 32 },
  icon: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 8 },
  body: { color: '#CBD5E1', fontSize: 15, marginBottom: 28, textAlign: 'center' },
});
