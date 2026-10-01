import { useCallback, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/auth';
import { api, type OrderDetail } from '@/lib/api';
import { naira } from '@/lib/format';
import { STATUS_INFO } from '@/lib/status';
import { Card, EmptyState, ErrorBanner, HelpTip, InfoRow, Loading, Screen, SectionTitle, StatusBadge } from '@/components/ui';
import { EventTimeline, ProgressTracker } from '@/components/Progress';
import { OfferHistory, OrderActions } from '@/components/OrderActions';
import { colors, radius } from '@/theme';

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setDetail(await api.order(id));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!user) return null;
  if (!detail && !error) return <Loading />;
  if (!detail) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title="Couldn't load order" body={error ?? ''} />
      </Screen>
    );
  }

  const { order, offers, events } = detail;
  const info = STATUS_INFO[order.status];
  const isCustomer = user.role === 'customer';
  const ended = order.status === 'REJECTED' || order.status === 'CANCELLED';

  const openLink = () => {
    const url = order.productUrl;
    if (!url || !/^https?:\/\//i.test(url)) return;
    Alert.alert('Open external link?', url, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open', onPress: () => Linking.openURL(url) },
    ]);
  };

  return (
    <Screen
      edges={['bottom']}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      <ErrorBanner message={error} />
      <Card>
        <StatusBadge status={order.status} />
        <Text style={styles.name}>{order.itemName}</Text>
        <Text style={styles.ref}>
          {order.reference}
          {!isCustomer && order.customer ? ` · ${order.customer.name}` : ''}
        </Text>
        <HelpTip icon="information-circle-outline">{isCustomer ? info.customerHelp : info.staffHelp}</HelpTip>
        {order.finalTotal != null ? (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Agreed total</Text>
            <Text style={styles.total}>{naira(order.finalTotal)}</Text>
          </View>
        ) : null}
      </Card>

      {isCustomer && order.status === 'READY_FOR_PICKUP' && order.pickupCode ? (
        <View style={styles.pickup}>
          <Text style={styles.pickupLabel}>Your pickup code</Text>
          <Text style={styles.pickupCode} selectable={false}>
            {order.pickupCode.slice(0, 3)} {order.pickupCode.slice(3)}
          </Text>
          {order.warehouse ? (
            <View style={styles.pickupAddr}>
              <Ionicons name="location" size={16} color={colors.accent} />
              <Text style={styles.pickupAddrText}>
                {order.warehouse.name}
                {'\n'}
                {order.warehouse.address}, {order.warehouse.city}, {order.warehouse.state}
              </Text>
            </View>
          ) : null}
          <Text style={styles.pickupHint}>Show this code only to Jetlog warehouse staff, in person. We will never ask for it by phone.</Text>
        </View>
      ) : null}

      <OrderActions detail={detail} role={user.role} onChanged={load} />
      <OfferHistory offers={offers} role={user.role} />

      <SectionTitle>Details</SectionTitle>
      <Card>
        <InfoRow label="Requested quantity" value={order.requestedQuantity.toLocaleString()} />
        <InfoRow label="Target unit price" value={order.targetUnitPrice ? naira(order.targetUnitPrice) : 'Not set'} />
        {order.finalUnitPrice != null ? <InfoRow label="Agreed unit price" value={naira(order.finalUnitPrice)} /> : null}
        {order.finalQuantity != null ? <InfoRow label="Agreed quantity" value={order.finalQuantity.toLocaleString()} /> : null}
        {order.supplierReference ? <InfoRow label="Supplier ref" value={order.supplierReference} /> : null}
        {order.trackingNumber ? <InfoRow label="Tracking no." value={order.trackingNumber} /> : null}
        {order.warehouse ? <InfoRow label="Pickup at" value={order.warehouse.name} /> : null}
        {!isCustomer && order.customer?.phone ? <InfoRow label="Customer phone" value={order.customer.phone} /> : null}
        {order.description ? <Text style={styles.desc}>{order.description}</Text> : null}
        {order.productUrl ? (
          <Text style={styles.link} onPress={openLink}>
            <Ionicons name="link" size={14} /> View product link
          </Text>
        ) : null}
      </Card>

      {!ended ? (
        <>
          <SectionTitle>Progress</SectionTitle>
          <Card>
            <ProgressTracker status={order.status} events={events} />
          </Card>
        </>
      ) : null}

      <SectionTitle>Activity</SectionTitle>
      <Card>
        <EventTimeline events={events} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 10 },
  ref: { fontSize: 13, color: colors.muted, marginTop: 4, marginBottom: 14 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 14, color: colors.muted },
  total: { fontSize: 22, fontWeight: '800', color: colors.primary },
  pickup: { backgroundColor: colors.primary, borderRadius: radius.lg, padding: 20, marginBottom: 14, alignItems: 'center' },
  pickupLabel: { color: '#CBD5E1', fontSize: 14, fontWeight: '600' },
  pickupCode: { color: '#fff', fontSize: 44, fontWeight: '900', letterSpacing: 6, marginVertical: 8 },
  pickupAddr: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: 12, alignSelf: 'stretch', marginTop: 4 },
  pickupAddrText: { color: '#fff', fontSize: 14, marginLeft: 8, flex: 1, lineHeight: 20 },
  pickupHint: { color: '#94A3B8', fontSize: 12, textAlign: 'center', marginTop: 12, lineHeight: 17 },
  desc: { fontSize: 14, color: colors.text, marginTop: 12, lineHeight: 20 },
  link: { color: colors.accent, fontWeight: '700', marginTop: 12 },
});
