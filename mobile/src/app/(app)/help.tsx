import { useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/auth';
import { JOURNEY, STATUS_INFO } from '@/lib/status';
import { Card, Screen, SectionTitle, Title } from '@/components/ui';
import { colors } from '@/theme';

const CUSTOMER_FAQ = [
  ['How do I place a pre-order?', 'Tap “Pre-order from China” on the Home tab and follow the 3 short steps. Nothing is charged when you submit a request.'],
  ['How is the price decided?', 'A manager reviews your request and sends you a price per unit that includes buying, shipping and customs clearing. You can accept it or send a counter-offer.'],
  ['Can I cancel?', 'Yes — any time before the price is agreed. After that, the order is placed with our supplier and cannot be cancelled in the app.'],
  ['How will I know where my order is?', 'You get a notification at every step: ordered, shipped from China, arrived in Nigeria, cleared by customs, and ready for pickup.'],
  ['How do I collect my item?', 'When it’s ready, a private 6-digit pickup code appears on the order. Show it at the warehouse with a valid ID.'],
  ['Someone called asking for my pickup code.', 'Never share it by phone, SMS or chat. Jetlog staff will only ask for it in person at the warehouse.'],
];

const STAFF_FAQ = [
  ['Negotiating a price', 'Open a new request and send a price. If the customer counters, accept it or send a new offer. Either side accepting confirms the order.'],
  ['Sending to procurement', 'Once confirmed, tap “Send to procurement”. You can assign a specific procurement manager or notify the whole team.'],
  ['Updating shipping progress', 'Open the order and tap the next step button. Steps must happen in order, and the customer is notified each time.'],
  ['Releasing an order', 'Ask the customer for their 6-digit pickup code and check ID. After 5 wrong codes, a new one is sent to the customer automatically.'],
];

export default function Help() {
  const { user } = useAuth();
  const faq = user?.role === 'customer' ? CUSTOMER_FAQ : STAFF_FAQ;
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Screen edges={['bottom']}>
      <Title sub="Everything you need to know about how Jetlog works.">How can we help?</Title>

      <SectionTitle>The journey of your order</SectionTitle>
      <Card>
        {JOURNEY.map((s, i) => (
          <View key={s} style={[styles.step, i > 0 && { marginTop: 12 }]}>
            <View style={styles.num}>
              <Text style={styles.numText}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>{STATUS_INFO[s].label}</Text>
              <Text style={styles.stepBody}>{user?.role === 'customer' ? STATUS_INFO[s].customerHelp : STATUS_INFO[s].staffHelp}</Text>
            </View>
          </View>
        ))}
      </Card>

      <SectionTitle>Frequently asked questions</SectionTitle>
      <Card style={{ paddingVertical: 4 }}>
        {faq.map(([q, a], i) => (
          <Pressable
            key={q}
            onPress={() => {
              LayoutAnimation.easeInEaseOut();
              setOpen(open === i ? null : i);
            }}
            style={[styles.faq, i > 0 && styles.divider]}
            accessibilityRole="button"
            accessibilityState={{ expanded: open === i }}
          >
            <View style={styles.faqHead}>
              <Text style={styles.q}>{q}</Text>
              <Ionicons name={open === i ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
            </View>
            {open === i ? <Text style={styles.a}>{a}</Text> : null}
          </Pressable>
        ))}
      </Card>

      <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="shield-checkmark" size={22} color={colors.success} />
        <Text style={[styles.a, { flex: 1, marginLeft: 12, marginTop: 0 }]}>
          Jetlog will never ask for your password or pickup code by phone, SMS or email.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: 'row' },
  num: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  numText: { color: colors.accent, fontWeight: '800', fontSize: 13 },
  stepTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  stepBody: { fontSize: 13, color: colors.muted, marginTop: 2, lineHeight: 18 },
  faq: { paddingVertical: 14 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  faqHead: { flexDirection: 'row', alignItems: 'center' },
  q: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text, marginRight: 8 },
  a: { fontSize: 14, color: colors.muted, marginTop: 8, lineHeight: 20 },
});
