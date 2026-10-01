import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/auth';
import { api } from '@/lib/api';
import type { Warehouse } from '@/lib/types';
import { Card, InfoRow, Screen } from '@/components/ui';
import { colors } from '@/theme';

export default function Profile() {
  const { user, signOut, biometricEnabled, setBiometricEnabled } = useAuth();
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);

  useEffect(() => {
    if (!user?.preferredWarehouseId) return;
    api
      .warehouses()
      .then((r) => setWarehouse(r.warehouses.find((w) => w.id === user.preferredWarehouseId) ?? null))
      .catch(() => {});
  }, [user?.preferredWarehouseId]);

  const toggleBiometric = async (on: boolean) => {
    const ok = await setBiometricEnabled(on);
    if (!ok && on) {
      Alert.alert('Not available', 'Set up Face ID, Touch ID or fingerprint on this device first.');
    }
  };

  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'You will need your password to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);

  if (!user) return null;

  return (
    <Screen>
      <View style={styles.avatarRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user.fullName
              .split(' ')
              .map((p) => p[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{user.fullName}</Text>
          <Text style={styles.email}>{user.email}</Text>
        </View>
      </View>

      <Card>
        <InfoRow label="Phone" value={user.phone} />
        <InfoRow label="Account type" value={user.role.charAt(0).toUpperCase() + user.role.slice(1)} />
        {user.role === 'customer' ? (
          <InfoRow label="Pickup warehouse" value={warehouse ? `${warehouse.name}` : '—'} />
        ) : null}
      </Card>

      <Text style={styles.section}>Security</Text>
      <Card style={{ paddingVertical: 4 }}>
        <View style={styles.item}>
          <Ionicons name="finger-print" size={20} color={colors.primary} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.itemText}>App lock</Text>
            <Text style={styles.itemHint}>Require Face ID / fingerprint to open Jetlog</Text>
          </View>
          <Switch value={biometricEnabled} onValueChange={toggleBiometric} trackColor={{ true: colors.accent }} />
        </View>
        <MenuItem icon="key-outline" label="Change password" onPress={() => router.push('/change-password')} />
      </Card>

      {user.role === 'admin' ? (
        <>
          <Text style={styles.section}>Administration</Text>
          <Card style={{ paddingVertical: 4 }}>
            <MenuItem icon="people-outline" label="Team & users" onPress={() => router.push('/admin/staff')} />
            <MenuItem icon="business-outline" label="Warehouses" onPress={() => router.push('/admin/warehouses')} />
          </Card>
        </>
      ) : null}

      <Text style={styles.section}>Support</Text>
      <Card style={{ paddingVertical: 4 }}>
        <MenuItem icon="help-circle-outline" label="Help & FAQ" onPress={() => router.push('/help')} />
        <MenuItem icon="log-out-outline" label="Sign out" onPress={confirmSignOut} danger />
      </Card>
    </Screen>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const color = danger ? colors.danger : colors.primary;
  return (
    <Pressable style={styles.item} onPress={onPress} accessibilityRole="button">
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.itemText, { flex: 1, marginLeft: 12, color }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '800', color: colors.text },
  email: { fontSize: 14, color: colors.muted, marginTop: 2 },
  section: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 8, marginBottom: 8 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  itemText: { fontSize: 15, fontWeight: '600', color: colors.text },
  itemHint: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
