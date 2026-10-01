import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, shadow, toneColors } from '@/theme';
import { STATUS_INFO } from '@/lib/status';
import type { OrderStatus } from '@/lib/types';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function Screen({
  children,
  refreshing,
  onRefresh,
  edges = [],
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  edges?: ('top' | 'bottom')[];
}) {
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.screenContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.accent} /> : undefined
          }
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.title}>{children}</Text>
      {sub ? <Text style={styles.subtitle}>{sub}</Text> : null}
    </View>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'accent' | 'outline' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  style?: ViewStyle;
}) {
  const v = buttonVariants[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: v.bg, borderColor: v.border },
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        isDisabled && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Ionicons name={icon} size={18} color={v.fg} style={{ marginRight: 8 }} /> : null}
          <Text style={[styles.buttonText, { color: v.fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const buttonVariants = {
  primary: { bg: colors.primary, fg: '#fff', border: colors.primary },
  accent: { bg: colors.accent, fg: '#fff', border: colors.accent },
  outline: { bg: 'transparent', fg: colors.primary, border: colors.border },
  ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
  danger: { bg: colors.dangerSoft, fg: colors.danger, border: colors.dangerSoft },
};

export function Input({
  label,
  hint,
  error,
  secure,
  ...props
}: TextInputProps & { label: string; hint?: string; error?: string | null; secure?: boolean }) {
  const [hidden, setHidden] = useState(true);
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, error ? { borderColor: colors.danger } : null]}>
        <TextInput
          placeholderTextColor="#94A3B8"
          style={[styles.input, props.multiline && { minHeight: 90, textAlignVertical: 'top' }]}
          secureTextEntry={secure && hidden}
          autoCorrect={!secure}
          {...props}
        />
        {secure ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
          >
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function HelpTip({ children, icon = 'bulb-outline' }: { children: ReactNode; icon?: IconName }) {
  return (
    <View style={styles.help}>
      <Ionicons name={icon} size={18} color={colors.accent} style={{ marginRight: 10, marginTop: 1 }} />
      <Text style={styles.helpText}>{children}</Text>
    </View>
  );
}

export function ErrorBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View style={[styles.help, { backgroundColor: colors.dangerSoft }]} accessibilityLiveRegion="polite">
      <Ionicons name="alert-circle-outline" size={18} color={colors.danger} style={{ marginRight: 10 }} />
      <Text style={[styles.helpText, { color: colors.danger }]}>{message}</Text>
    </View>
  );
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  const info = STATUS_INFO[status];
  const tone = toneColors[info.tone];
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <Ionicons name={info.icon} size={13} color={tone.fg} style={{ marginRight: 4 }} />
      <Text style={[styles.badgeText, { color: tone.fg }]}>{info.label}</Text>
    </View>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={30} color={colors.accent} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {action}
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, backgroundColor: colors.bg }}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

export function Steps({ total, current, labels }: { total: number; current: number; labels: string[] }) {
  return (
    <View style={{ marginBottom: 20 }}>
      <View style={styles.row}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={[styles.stepBar, { backgroundColor: i <= current ? colors.accent : colors.border }, i > 0 && { marginLeft: 6 }]}
          />
        ))}
      </View>
      <Text style={styles.stepLabel}>
        Step {current + 1} of {total} · {labels[current]}
      </Text>
    </View>
  );
}

export function Select<T extends { id: string }>({
  label,
  placeholder,
  items,
  value,
  onChange,
  render,
  hint,
}: {
  label: string;
  placeholder: string;
  items: T[];
  value?: string | null;
  onChange: (item: T) => void;
  render: (item: T) => { title: string; subtitle?: string };
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = items.find((i) => i.id === value);
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.inputWrap} onPress={() => setOpen(true)} accessibilityRole="button">
        <Text style={[styles.input, { color: selected ? colors.text : '#94A3B8' }]} numberOfLines={1}>
          {selected ? render(selected).title : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </Pressable>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setOpen(false)} />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <Text style={[styles.sectionTitle, { marginBottom: 8 }]}>{label}</Text>
          <FlatList
            data={items}
            keyExtractor={(i) => i.id}
            renderItem={({ item }) => {
              const r = render(item);
              const active = item.id === value;
              return (
                <Pressable
                  style={[styles.sheetItem, active && { backgroundColor: colors.accentSoft }]}
                  onPress={() => {
                    onChange(item);
                    setOpen(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetTitle}>{r.title}</Text>
                    {r.subtitle ? <Text style={styles.hint}>{r.subtitle}</Text> : null}
                  </View>
                  {active ? <Ionicons name="checkmark-circle" size={20} color={colors.accent} /> : null}
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

export function InfoRow({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value ?? '—'}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenContent: { padding: 20, paddingBottom: 48 },
  row: { flexDirection: 'row', alignItems: 'center' },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, marginBottom: 14, ...shadow },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: colors.muted, marginTop: 6, lineHeight: 21 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderWidth: 1.5,
  },
  buttonText: { fontSize: 16, fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
  },
  input: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 13 },
  hint: { fontSize: 13, color: colors.muted, marginTop: 5, lineHeight: 18 },
  error: { fontSize: 13, color: colors.danger, marginTop: 5 },
  help: {
    flexDirection: 'row',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 14,
  },
  helpText: { flex: 1, fontSize: 14, color: colors.primarySoft, lineHeight: 20 },
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { fontSize: 12, fontWeight: '700' },
  empty: { alignItems: 'center', padding: 32 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 6 },
  emptyBody: { fontSize: 14, color: colors.muted, textAlign: 'center', marginBottom: 18, lineHeight: 20 },
  stepBar: { flex: 1, height: 5, borderRadius: 3 },
  stepLabel: { marginTop: 8, fontSize: 13, color: colors.muted, fontWeight: '600' },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(11,31,58,0.4)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, maxHeight: '70%' },
  sheetItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: radius.md },
  sheetTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  infoLabel: { fontSize: 14, color: colors.muted },
  infoValue: { fontSize: 14, color: colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'right', marginLeft: 12 },
});
