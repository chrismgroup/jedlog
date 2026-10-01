import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/auth';
import { api } from '@/lib/api';
import { ACTIVE_STATUSES, STATUS_INFO } from '@/lib/status';
import type { Order, OrderStatus } from '@/lib/types';
import { Button, Card, EmptyState, ErrorBanner, Screen, SectionTitle } from '@/components/ui';
import { OrderCard } from '@/components/OrderCard';
import { colors, radius, toneColors } from '@/theme';

const STAFF_TILES: Record<string, { status: OrderStatus; label: string }[]> = {
  manager: [
    { status: 'PENDING_REVIEW', label: 'New requests' },
    { status: 'NEGOTIATING', label: 'In negotiation' },
    { status: 'CONFIRMED', label: 'Send to procurement' },
    { status: 'SHIPPED_FROM_CHINA', label: 'In transit' },
    { status: 'CUSTOMS_CLEARED', label: 'Cleared customs' },
    { status: 'READY_FOR_PICKUP', label: 'Awaiting pickup' },
  ],
  procurement: [
    { status: 'SENT_TO_PROCUREMENT', label: 'To place in China' },
    { status: 'ORDER_PLACED', label: 'Awaiting shipment' },
    { status: 'SHIPPED_FROM_CHINA', label: 'In transit' },
    { status: 'ARRIVED_NIGERIA', label: 'At customs' },
    { status: 'CUSTOMS_CLEARED', label: 'To warehouse' },
    { status: 'READY_FOR_PICKUP', label: 'Ready for pickup' },
  ],
};
STAFF_TILES.admin = STAFF_TILES.manager;

export default function Home() {
  const { user } = useAuth();
  const isCustomer = user?.role === 'customer';
  const [orders, setOrders] = useState<Order[]>([]);
  const [counts, setCounts] = useState<Partial<Record<OrderStatus, number>>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [o, s] = await Promise.all([api.orders(), isCustomer ? Promise.resolve(null) : api.orderStats()]);
      setOrders(o.orders);
      if (s) setCounts(s.counts);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [isCustomer]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const firstName = user?.fullName.split(' ')[0] ?? '';
  const active = orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
  const needsAction = isCustomer
    ? active.filter((o) => o.status === 'NEGOTIATING' || o.status === 'READY_FOR_PICKUP')
    : [];

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh} edges={['top']}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>Hello, {firstName}</Text>
            <Text style={styles.role}>{roleLabel(user?.role)}</Text>
          </View>
          <Pressable onPress={() => router.push('/help')} style={styles.helpBtn} accessibilityLabel="Help">
            <Ionicons name="help-circle-outline" size={26} color={colors.primary} />
          </Pressable>
        </View>
        <ErrorBanner message={error} />

        {isCustomer ? (
          <>
            <Pressable style={styles.hero} onPress={() => router.push('/new-order')} accessibilityRole="button">
              <View style={{ flex: 1 }}>
                <Text style={styles.heroTitle}>Pre-order from China</Text>
                <Text style={styles.heroBody}>Tell us what you need. We'll quote, buy, ship and clear it for you.</Text>
              </View>
              <View style={styles.heroIcon}>
                <Ionicons name="add" size={30} color={colors.primary} />
              </View>
            </Pressable>

            {needsAction.length > 0 && (
              <>
                <SectionTitle>Needs your attention</SectionTitle>
                {needsAction.map((o) => (
                  <OrderCard key={o.id} order={o} />
                ))}
              </>
            )}

            <SectionTitle
              right={
                orders.length > 0 ? (
                  <Text style={styles.link} onPress={() => router.navigate('/orders')}>
                    See all
                  </Text>
                ) : undefined
              }
            >
              Active orders
            </SectionTitle>
            {active.length === 0 ? (
              <Card>
                <EmptyState
                  icon="cube-outline"
                  title="No active orders"
                  body="Start your first pre-order. It only takes a minute."
                  action={<Button title="Start a pre-order" variant="accent" onPress={() => router.push('/new-order')} />}
                />
              </Card>
            ) : (
              active
                .filter((o) => !needsAction.includes(o))
                .slice(0, 5)
                .map((o) => <OrderCard key={o.id} order={o} />)
            )}

            <SectionTitle>How it works</SectionTitle>
            <Card>
              {[
                ['create-outline', 'Request', 'Describe the item and quantity you want.'],
                ['pricetags-outline', 'Agree a price', 'We send a quote. Accept it or make a counter-offer.'],
                ['airplane-outline', 'We buy & ship', 'Track it from China, through customs, to your warehouse.'],
                ['cube-outline', 'Pick up', 'Show your private pickup code at the warehouse.'],
              ].map(([icon, title, body], i) => (
                <View key={title} style={[styles.how, i > 0 && { marginTop: 14 }]}>
                  <View style={styles.howIcon}>
                    <Ionicons name={icon as 'create-outline'} size={18} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.howTitle}>{title}</Text>
                    <Text style={styles.howBody}>{body}</Text>
                  </View>
                </View>
              ))}
            </Card>
          </>
        ) : (
          <>
            <SectionTitle>Your queue</SectionTitle>
            <View style={styles.grid}>
              {(STAFF_TILES[user?.role ?? 'manager'] ?? []).map((t) => {
                const tone = toneColors[STATUS_INFO[t.status].tone];
                return (
                  <Pressable
                    key={t.status}
                    style={styles.tile}
                    onPress={() => router.navigate({ pathname: '/orders', params: { status: t.status } })}
                  >
                    <View style={[styles.tileIcon, { backgroundColor: tone.bg }]}>
                      <Ionicons name={STATUS_INFO[t.status].icon} size={18} color={tone.fg} />
                    </View>
                    <Text style={styles.tileCount}>{counts[t.status] ?? 0}</Text>
                    <Text style={styles.tileLabel}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <SectionTitle>Recently updated</SectionTitle>
            {orders.length === 0 ? (
              <Card>
                <EmptyState icon="file-tray-outline" title="All clear" body="New orders will appear here." />
              </Card>
            ) : (
              orders.slice(0, 8).map((o) => <OrderCard key={o.id} order={o} showCustomer />)
            )}
          </>
        )}
    </Screen>
  );
}

function roleLabel(role?: string) {
  switch (role) {
    case 'manager':
      return 'Order manager';
    case 'procurement':
      return 'Procurement manager';
    case 'admin':
      return 'Administrator';
    default:
      return 'Welcome back to Jetlog';
  }
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  hello: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  role: { fontSize: 14, color: colors.muted, marginTop: 2 },
  helpBtn: { padding: 6 },
  hero: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.lg, padding: 20, marginBottom: 20 },
  heroTitle: { color: '#fff', fontSize: 19, fontWeight: '800' },
  heroBody: { color: '#CBD5E1', fontSize: 14, marginTop: 6, lineHeight: 20 },
  heroIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  link: { color: colors.accent, fontWeight: '700', fontSize: 14 },
  how: { flexDirection: 'row' },
  howIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  howTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  howBody: { fontSize: 13, color: colors.muted, marginTop: 2, lineHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 10 },
  tile: { width: '48%', backgroundColor: '#fff', borderRadius: radius.lg, padding: 14, marginBottom: 12 },
  tileIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tileCount: { fontSize: 26, fontWeight: '800', color: colors.text, marginTop: 10 },
  tileLabel: { fontSize: 13, color: colors.muted, marginTop: 2, fontWeight: '600' },
});
