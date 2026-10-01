import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api } from '@/lib/api';
import { passwordChecks } from '@/lib/format';
import type { Role, User } from '@/lib/types';
import { Button, Card, ErrorBanner, Input, Screen, SectionTitle, Select } from '@/components/ui';
import { colors, radius } from '@/theme';

const ROLES: { id: Role; title: string; subtitle: string }[] = [
  { id: 'manager', title: 'Order manager', subtitle: 'Negotiates prices and manages orders' },
  { id: 'procurement', title: 'Procurement manager', subtitle: 'Places orders in China, updates shipping' },
  { id: 'admin', title: 'Administrator', subtitle: 'Full access, manages staff & warehouses' },
];

export default function Staff() {
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState<Role | undefined>();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' });
  const [role, setRole] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => {
    api.users(filter).then((r) => setUsers(r.users)).catch((e) => setError(e.message));
  }, [filter]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const create = async () => {
    setError(null);
    if (!role) return setError('Choose a role.');
    if (!passwordChecks(form.password).every((c) => c.ok)) return setError('Temporary password must be 10+ chars with upper, lower case and a number.');
    setLoading(true);
    try {
      await api.createStaff({ ...form, email: form.email.trim(), fullName: form.fullName.trim(), phone: form.phone.trim(), role });
      setForm({ fullName: '', email: '', phone: '', password: '' });
      setRole(null);
      setShowForm(false);
      Alert.alert('Account created', 'Share the temporary password securely and ask them to change it after first sign-in.');
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = (u: User) =>
    Alert.alert(u.active ? 'Deactivate account?' : 'Reactivate account?', u.active ? `${u.fullName} will be signed out immediately.` : '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: u.active ? 'Deactivate' : 'Reactivate',
        style: u.active ? 'destructive' : 'default',
        onPress: () => api.updateUser(u.id, { active: !u.active }).then(load).catch((e) => setError(e.message)),
      },
    ]);

  return (
    <Screen edges={['bottom']}>
      <ErrorBanner message={error} />
      {!showForm ? (
        <Button title="Add staff member" icon="person-add" variant="accent" onPress={() => setShowForm(true)} style={{ marginBottom: 16 }} />
      ) : (
        <Card>
          <Text style={styles.cardTitle}>New staff account</Text>
          <Input label="Full name" value={form.fullName} onChangeText={(v) => setForm({ ...form, fullName: v })} />
          <Input label="Email" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} keyboardType="email-address" autoCapitalize="none" />
          <Input label="Phone" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} keyboardType="phone-pad" />
          <Select label="Role" placeholder="Select role" items={ROLES} value={role} onChange={(r) => setRole(r.id)} render={(r) => r} />
          <Input label="Temporary password" value={form.password} onChangeText={(v) => setForm({ ...form, password: v })} secure autoCapitalize="none" />
          <Button title="Create account" onPress={create} loading={loading} />
          <Button title="Cancel" variant="ghost" onPress={() => setShowForm(false)} style={{ marginTop: 6 }} />
        </Card>
      )}

      <SectionTitle>People</SectionTitle>
      <View style={styles.filters}>
        {([undefined, 'customer', 'manager', 'procurement', 'admin'] as const).map((r) => (
          <Pressable key={r ?? 'all'} onPress={() => setFilter(r)} style={[styles.chip, filter === r && styles.chipActive]}>
            <Text style={[styles.chipText, filter === r && { color: '#fff' }]}>{r ? r[0].toUpperCase() + r.slice(1) : 'All'}</Text>
          </Pressable>
        ))}
      </View>
      {users.map((u) => (
        <Card key={u.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{u.fullName}</Text>
            <Text style={styles.meta}>
              {u.email} · {u.role}
            </Text>
          </View>
          <Pressable onPress={() => toggleActive(u)} style={[styles.status, { backgroundColor: u.active ? colors.successSoft : colors.dangerSoft }]}>
            <Text style={{ color: u.active ? colors.success : colors.danger, fontWeight: '700', fontSize: 12 }}>
              {u.active ? 'Active' : 'Inactive'}
            </Text>
          </Pressable>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 12 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: '#fff', marginRight: 8, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  status: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
});
