import { useCallback, useState } from 'react';
import { Text } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api } from '@/lib/api';
import type { Warehouse } from '@/lib/types';
import { Button, Card, ErrorBanner, InfoRow, Input, Screen, SectionTitle } from '@/components/ui';
import { colors } from '@/theme';

const empty = { name: '', city: '', state: '', address: '', phone: '' };

export default function Warehouses() {
  const [items, setItems] = useState<Warehouse[]>([]);
  const [form, setForm] = useState(empty);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    api.warehouses().then((r) => setItems(r.warehouses)).catch((e) => setError(e.message));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const create = async () => {
    setError(null);
    setLoading(true);
    try {
      await api.createWarehouse({ ...form, phone: form.phone || undefined });
      setForm(empty);
      setShowForm(false);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const set = (k: keyof typeof empty) => (v: string) => setForm({ ...form, [k]: v });

  return (
    <Screen edges={['bottom']}>
      <ErrorBanner message={error} />
      {!showForm ? (
        <Button title="Add warehouse" icon="add" variant="accent" onPress={() => setShowForm(true)} style={{ marginBottom: 16 }} />
      ) : (
        <Card>
          <Input label="Name" value={form.name} onChangeText={set('name')} placeholder="Lekki Warehouse" />
          <Input label="Address" value={form.address} onChangeText={set('address')} />
          <Input label="City" value={form.city} onChangeText={set('city')} />
          <Input label="State" value={form.state} onChangeText={set('state')} />
          <Input label="Phone (optional)" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
          <Button title="Save warehouse" onPress={create} loading={loading} />
          <Button title="Cancel" variant="ghost" onPress={() => setShowForm(false)} style={{ marginTop: 6 }} />
        </Card>
      )}
      <SectionTitle>Pickup locations</SectionTitle>
      {items.map((w) => (
        <Card key={w.id}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 6 }}>{w.name}</Text>
          <InfoRow label="Address" value={w.address} />
          <InfoRow label="City / State" value={`${w.city}, ${w.state}`} />
          {w.phone ? <InfoRow label="Phone" value={w.phone} /> : null}
        </Card>
      ))}
    </Screen>
  );
}
