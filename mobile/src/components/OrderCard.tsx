import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Order } from '@/lib/types';
import { JOURNEY, journeyIndex } from '@/lib/status';
import { naira, timeAgo } from '@/lib/format';
import { StatusBadge } from './ui';
import { colors, radius, shadow } from '@/theme';

export function OrderCard({ order, showCustomer }: { order: Order; showCustomer?: boolean }) {
  const idx = journeyIndex(order.status);
  const progress = idx < 0 ? 0 : (idx + 1) / JOURNEY.length;
  const ended = order.status === 'REJECTED' || order.status === 'CANCELLED';

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
      onPress={() => router.push({ pathname: '/order/[id]', params: { id: order.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${order.itemName}, ${order.statusLabel}`}
    >
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {order.itemName}
          </Text>
          <Text style={styles.meta}>
            {order.reference} · {timeAgo(order.updatedAt)}
            {showCustomer && order.customer ? ` · ${order.customer.name}` : ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </View>
      <View style={styles.bottom}>
        <StatusBadge status={order.status} />
        <Text style={styles.amount}>
          {order.finalTotal != null ? naira(order.finalTotal) : `Qty ${order.requestedQuantity}`}
        </Text>
      </View>
      {!ended && (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: 16, marginBottom: 12, ...shadow },
  top: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.muted, marginTop: 3 },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  amount: { fontSize: 14, fontWeight: '700', color: colors.primary },
  track: { height: 4, backgroundColor: colors.border, borderRadius: 2, marginTop: 14, overflow: 'hidden' },
  fill: { height: 4, backgroundColor: colors.accent, borderRadius: 2 },
});
