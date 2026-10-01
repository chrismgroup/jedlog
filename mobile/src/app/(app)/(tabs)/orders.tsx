import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/auth';
import { api } from '@/lib/api';
import { STATUS_INFO } from '@/lib/status';
import type { Order, OrderStatus } from '@/lib/types';
import { Button, EmptyState, ErrorBanner } from '@/components/ui';
import { OrderCard } from '@/components/OrderCard';
import { colors, radius } from '@/theme';

const FILTERS: Record<string, OrderStatus[]> = {
  customer: ['NEGOTIATING', 'CONFIRMED', 'SHIPPED_FROM_CHINA', 'READY_FOR_PICKUP', 'PICKED_UP'],
  manager: ['PENDING_REVIEW', 'NEGOTIATING', 'CONFIRMED', 'SENT_TO_PROCUREMENT', 'SHIPPED_FROM_CHINA', 'CUSTOMS_CLEARED', 'READY_FOR_PICKUP', 'PICKED_UP', 'REJECTED', 'CANCELLED'],
  procurement: ['SENT_TO_PROCUREMENT', 'ORDER_PLACED', 'SHIPPED_FROM_CHINA', 'ARRIVED_NIGERIA', 'CUSTOMS_CLEARED', 'READY_FOR_PICKUP', 'PICKED_UP'],
};
FILTERS.admin = FILTERS.manager;

export default function Orders() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ status?: string }>();
  const [status, setStatus] = useState<OrderStatus | undefined>();
  const [q, setQ] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params.status && params.status in STATUS_INFO) setStatus(params.status as OrderStatus);
  }, [params.status]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const r = await api.orders({ status, q: q.trim() || undefined });
      setOrders(r.orders);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [status, q]);

  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(load, 250);
      return () => clearTimeout(t);
    }, [load]),
  );

  const filters = FILTERS[user?.role ?? 'customer'] ?? [];
  const staff = user?.role !== 'customer';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          style={styles.search}
          placeholder="Search by item or reference"
          placeholderTextColor="#94A3B8"
          value={q}
          onChangeText={setQ}
          autoCapitalize="none"
          returnKeyType="search"
          maxLength={100}
        />
        {q ? (
          <Pressable onPress={() => setQ('')} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="All" active={!status} onPress={() => setStatus(undefined)} />
          {filters.map((s) => (
            <Chip key={s} label={STATUS_INFO[s].label} active={status === s} onPress={() => setStatus(s)} />
          ))}
        </ScrollView>
      </View>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: 20, paddingTop: 8 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.accent} />}
        ListHeaderComponent={<ErrorBanner message={error} />}
        renderItem={({ item }) => <OrderCard order={item} showCustomer={staff} />}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              icon="search-outline"
              title={status || q ? 'No matching orders' : 'No orders yet'}
              body={status || q ? 'Try a different filter or search.' : staff ? 'Orders will appear here as customers make requests.' : 'Your pre-orders will appear here.'}
              action={
                !staff && !status && !q ? (
                  <Button title="Start a pre-order" variant="accent" onPress={() => router.push('/new-order')} />
                ) : undefined
              }
            />
          )
        }
      />
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]} accessibilityState={{ selected: active }}>
      <Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 20, marginTop: 8, borderRadius: radius.md, paddingHorizontal: 14, borderWidth: 1.5, borderColor: colors.border },
  search: { flex: 1, paddingVertical: 12, marginLeft: 8, fontSize: 15, color: colors.text },
  chips: { paddingHorizontal: 20, paddingVertical: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: '#fff', marginRight: 8, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.text },
});
