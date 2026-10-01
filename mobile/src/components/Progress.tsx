import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { OrderEvent, OrderStatus } from '@/lib/types';
import { JOURNEY, STATUS_INFO, journeyIndex } from '@/lib/status';
import { formatDate } from '@/lib/format';
import { colors } from '@/theme';

/** Vertical tracker of the full order journey, highlighting completed and current steps. */
export function ProgressTracker({ status, events }: { status: OrderStatus; events: OrderEvent[] }) {
  const current = journeyIndex(status);
  const when = (s: OrderStatus) => events.filter((e) => e.status === s).at(-1)?.createdAt;

  return (
    <View>
      {JOURNEY.map((s, i) => {
        const done = i < current || status === 'PICKED_UP';
        const active = i === current && status !== 'PICKED_UP';
        const info = STATUS_INFO[s];
        const date = when(s);
        return (
          <View key={s} style={styles.row}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  done && { backgroundColor: colors.success, borderColor: colors.success },
                  active && { backgroundColor: colors.accent, borderColor: colors.accent },
                ]}
              >
                {done ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
                {active ? <Ionicons name={info.icon} size={12} color="#fff" /> : null}
              </View>
              {i < JOURNEY.length - 1 ? <View style={[styles.line, done && { backgroundColor: colors.success }]} /> : null}
            </View>
            <View style={{ flex: 1, paddingBottom: 16 }}>
              <Text style={[styles.label, (done || active) && { color: colors.text }, active && { fontWeight: '800' }]}>
                {info.label}
              </Text>
              {date && (done || active) ? <Text style={styles.date}>{formatDate(date)}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function EventTimeline({ events }: { events: OrderEvent[] }) {
  return (
    <View>
      {[...events].reverse().map((e) => (
        <View key={e.id} style={styles.event}>
          <Text style={styles.eventTitle}>{STATUS_INFO[e.status]?.label ?? e.label}</Text>
          <Text style={styles.date}>
            {formatDate(e.createdAt)}
            {e.by ? ` · ${e.by}` : ''}
          </Text>
          {e.note ? <Text style={styles.note}>{e.note}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  rail: { width: 28, alignItems: 'center' },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  label: { fontSize: 15, color: colors.muted, fontWeight: '600', marginLeft: 10, marginTop: 1 },
  date: { fontSize: 12, color: colors.muted, marginLeft: 10, marginTop: 2 },
  event: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  eventTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginLeft: 10 },
  note: { fontSize: 14, color: colors.text, marginLeft: 10, marginTop: 4 },
});
