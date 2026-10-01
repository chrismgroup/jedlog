import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import type { AppNotification } from '@/lib/types';
import { EmptyState, ErrorBanner } from '@/components/ui';
import { colors, radius } from '@/theme';

export default function Notifications() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setError(null);
      const r = await api.notifications();
      setItems(r.notifications);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const markAll = async () => {
    await api.markAllRead().catch(() => {});
    setItems((list) => list.map((n) => ({ ...n, read: true })));
  };

  const open = (n: AppNotification) => {
    if (!n.read) {
      api.markRead(n.id).catch(() => {});
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    if (n.orderId) router.push({ pathname: '/order/[id]', params: { id: n.orderId } });
  };

  const hasUnread = items.some((n) => !n.read);

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 20, paddingTop: 8 }}
      data={items}
      keyExtractor={(n) => n.id}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.accent} />}
      ListHeaderComponent={
        <>
          <ErrorBanner message={error} />
          {hasUnread ? (
            <Pressable onPress={markAll} style={styles.markAll}>
              <Ionicons name="checkmark-done" size={16} color={colors.accent} />
              <Text style={styles.markAllText}>Mark all as read</Text>
            </Pressable>
          ) : null}
        </>
      }
      renderItem={({ item }) => (
        <Pressable style={[styles.item, !item.read && styles.unread]} onPress={() => open(item)}>
          <View style={[styles.dot, { opacity: item.read ? 0 : 1 }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
            <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
          </View>
          {item.orderId ? <Ionicons name="chevron-forward" size={18} color={colors.muted} /> : null}
        </Pressable>
      )}
      ListEmptyComponent={
        loading ? null : (
          <EmptyState icon="notifications-outline" title="No updates yet" body="We'll notify you here at every step of your order." />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  markAll: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginBottom: 10 },
  markAllText: { color: colors.accent, fontWeight: '700', marginLeft: 6 },
  item: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.lg, padding: 14, marginBottom: 10 },
  unread: { borderLeftWidth: 3, borderLeftColor: colors.accent },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginRight: 10 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  body: { fontSize: 14, color: colors.text, marginTop: 3, lineHeight: 19 },
  time: { fontSize: 12, color: colors.muted, marginTop: 6 },
});
