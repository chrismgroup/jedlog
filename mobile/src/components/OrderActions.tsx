import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { api, type OrderDetail } from '@/lib/api';
import { naira, parseAmount } from '@/lib/format';
import { LOGISTICS_NEXT, STATUS_INFO } from '@/lib/status';
import type { Offer, Role, Warehouse } from '@/lib/types';
import { Button, Card, ErrorBanner, HelpTip, Input, SectionTitle, Select } from './ui';
import { colors, radius } from '@/theme';

type Props = { detail: OrderDetail; role: Role; onChanged: () => void };

function useAction(onChanged: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChanged();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

const confirm = (title: string, message: string, onOk: () => void, destructive = false) =>
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Confirm', style: destructive ? 'destructive' : 'default', onPress: onOk },
  ]);

export function OrderActions(props: Props) {
  const { detail, role } = props;
  const s = detail.order.status;
  const isStaff = role === 'manager' || role === 'admin';

  if (role === 'customer') {
    if (s === 'PENDING_REVIEW' || s === 'NEGOTIATING') return <CustomerNegotiation {...props} />;
    return null;
  }
  if (isStaff && (s === 'PENDING_REVIEW' || s === 'NEGOTIATING')) return <StaffNegotiation {...props} />;
  if (isStaff && s === 'CONFIRMED') return <SendToProcurement {...props} />;
  if ((isStaff || role === 'procurement') && LOGISTICS_NEXT[s]) return <AdvanceStep {...props} />;
  if (isStaff && s === 'READY_FOR_PICKUP') return <CompletePickup {...props} />;
  return null;
}

function OfferForm({
  initial,
  submitLabel,
  onSubmit,
  busy,
}: {
  initial: { unitPrice?: number; quantity: number };
  submitLabel: string;
  onSubmit: (v: { unitPrice: number; quantity: number; message?: string }) => void;
  busy: boolean;
}) {
  const [price, setPrice] = useState(initial.unitPrice ? String(initial.unitPrice) : '');
  const [qty, setQty] = useState(String(initial.quantity));
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const unit = parseAmount(price);
  const q = Number(qty);
  const valid = !Number.isNaN(unit) && unit > 0 && Number.isInteger(q) && q > 0;

  return (
    <View>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 3, marginRight: 10 }}>
          <Input label="Price per unit (₦)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0.00" error={error} />
        </View>
        <View style={{ flex: 2 }}>
          <Input label="Quantity" value={qty} onChangeText={(t) => setQty(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" maxLength={6} />
        </View>
      </View>
      {valid ? <Text style={styles.total}>Total: {naira(unit * q)}</Text> : null}
      <Input label="Message (optional)" value={message} onChangeText={setMessage} placeholder="Add a note…" multiline maxLength={1000} />
      <Button
        title={submitLabel}
        icon="send"
        variant="accent"
        loading={busy}
        onPress={() => {
          if (!valid) return setError('Enter a valid price and quantity.');
          setError(null);
          onSubmit({ unitPrice: unit, quantity: q, message: message.trim() || undefined });
        }}
      />
    </View>
  );
}

function OfferBubble({ offer, mine }: { offer: Offer; mine: boolean }) {
  return (
    <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
      <Text style={styles.bubbleWho}>
        {mine ? 'You' : offer.byName} · {offer.status === 'open' ? 'Latest offer' : offer.status}
      </Text>
      <Text style={styles.bubblePrice}>
        {offer.quantity} × {naira(offer.unitPrice)}
      </Text>
      <Text style={styles.bubbleTotal}>Total {naira(offer.total)}</Text>
      {offer.message ? <Text style={styles.bubbleMsg}>{offer.message}</Text> : null}
    </View>
  );
}

export function OfferHistory({ offers, role }: { offers: Offer[]; role: Role }) {
  if (!offers.length) return null;
  const mySide = role === 'customer' ? 'customer' : 'staff';
  return (
    <>
      <SectionTitle>Price negotiation</SectionTitle>
      <Card>
        {offers.map((o) => (
          <OfferBubble key={o.id} offer={o} mine={o.bySide === mySide} />
        ))}
      </Card>
    </>
  );
}

function CustomerNegotiation({ detail, onChanged }: Props) {
  const { order, offers } = detail;
  const open = offers.find((o) => o.status === 'open');
  const { busy, error, run } = useAction(onChanged);
  const [countering, setCountering] = useState(false);

  return (
    <Card>
      <ErrorBanner message={error} />
      {!open && order.status === 'PENDING_REVIEW' ? (
        <HelpTip icon="time-outline">Our team is reviewing your request. You'll get a notification when your price is ready.</HelpTip>
      ) : null}
      {open?.bySide === 'customer' ? (
        <HelpTip icon="hourglass-outline">Your counter-offer was sent. We'll notify you when our team replies.</HelpTip>
      ) : null}
      {open?.bySide === 'staff' ? (
        <>
          <Text style={styles.cardTitle}>Our price for you</Text>
          <Text style={styles.big}>{naira(open.total)}</Text>
          <Text style={styles.muted}>
            {open.quantity} × {naira(open.unitPrice)}
          </Text>
          {open.message ? <Text style={[styles.muted, { marginTop: 6 }]}>“{open.message}”</Text> : null}
          <Button
            title="Accept price"
            icon="checkmark-circle"
            variant="accent"
            style={{ marginTop: 16 }}
            loading={busy && !countering}
            onPress={() =>
              confirm('Accept this price?', `${open.quantity} × ${naira(open.unitPrice)} = ${naira(open.total)}.\nYour order will then be placed.`, () =>
                run(() => api.acceptOffer(order.id, open.id)),
              )
            }
          />
          {!countering ? (
            <Button title="Make a counter-offer" variant="outline" style={{ marginTop: 10 }} onPress={() => setCountering(true)} />
          ) : (
            <View style={{ marginTop: 16 }}>
              <OfferForm
                initial={{ quantity: open.quantity }}
                submitLabel="Send counter-offer"
                busy={busy}
                onSubmit={(v) => run(() => api.sendOffer(order.id, v)).then((ok) => ok && setCountering(false))}
              />
            </View>
          )}
        </>
      ) : null}
      <Button
        title="Cancel request"
        variant="ghost"
        style={{ marginTop: 8 }}
        onPress={() => confirm('Cancel this request?', 'This cannot be undone.', () => run(() => api.cancelOrder(order.id)), true)}
      />
    </Card>
  );
}

function StaffNegotiation({ detail, onChanged }: Props) {
  const { order, offers } = detail;
  const open = offers.find((o) => o.status === 'open');
  const { busy, error, run } = useAction(onChanged);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');

  return (
    <Card>
      <ErrorBanner message={error} />
      {open?.bySide === 'customer' ? (
        <>
          <Text style={styles.cardTitle}>Customer counter-offer</Text>
          <Text style={styles.big}>{naira(open.total)}</Text>
          <Text style={styles.muted}>
            {open.quantity} × {naira(open.unitPrice)}
          </Text>
          <Button
            title="Accept counter-offer"
            icon="checkmark-circle"
            variant="accent"
            style={{ marginTop: 14, marginBottom: 18 }}
            loading={busy}
            onPress={() =>
              confirm('Accept counter-offer?', `This finalises the order at ${naira(open.total)}.`, () =>
                run(() => api.acceptOffer(order.id, open.id)),
              )
            }
          />
          <Text style={styles.cardTitle}>Or send a new price</Text>
        </>
      ) : (
        <Text style={styles.cardTitle}>{open ? 'Update your offer' : 'Send the customer a price'}</Text>
      )}
      <HelpTip>Include purchase, shipping and clearing costs. The customer can accept or counter.</HelpTip>
      <OfferForm
        initial={{ quantity: open?.quantity ?? order.requestedQuantity, unitPrice: open?.bySide === 'staff' ? open.unitPrice : undefined }}
        submitLabel={open ? 'Send new offer' : 'Send offer'}
        busy={busy}
        onSubmit={(v) => run(() => api.sendOffer(order.id, v))}
      />
      {!declining ? (
        <Button title="Decline request" variant="ghost" style={{ marginTop: 8 }} onPress={() => setDeclining(true)} />
      ) : (
        <View style={{ marginTop: 16 }}>
          <Input label="Reason (shared with customer)" value={reason} onChangeText={setReason} multiline maxLength={1000} />
          <Button
            title="Decline request"
            variant="danger"
            loading={busy}
            disabled={reason.trim().length < 3}
            onPress={() => run(() => api.rejectOrder(order.id, reason.trim()))}
          />
        </View>
      )}
    </Card>
  );
}

function SendToProcurement({ detail, onChanged }: Props) {
  const { order } = detail;
  const { busy, error, run } = useAction(onChanged);
  const [staff, setStaff] = useState<{ id: string; fullName: string }[]>([]);
  const [assignee, setAssignee] = useState<string | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    api.procurementStaff().then((r) => setStaff(r.users)).catch(() => {});
  }, []);

  return (
    <Card>
      <ErrorBanner message={error} />
      <Text style={styles.cardTitle}>Send to procurement</Text>
      <Text style={styles.muted}>
        Agreed: {order.finalQuantity} × {naira(order.finalUnitPrice)} = {naira(order.finalTotal)}
      </Text>
      <View style={{ height: 14 }} />
      <Select
        label="Assign to (optional)"
        placeholder="Any procurement manager"
        items={staff}
        value={assignee}
        onChange={(u) => setAssignee(u.id)}
        render={(u) => ({ title: u.fullName })}
        hint="Leave empty to notify the whole procurement team."
      />
      <Input label="Note for procurement (optional)" value={note} onChangeText={setNote} multiline maxLength={1000} />
      <Button
        title="Send to procurement"
        icon="briefcase"
        variant="accent"
        loading={busy}
        onPress={() => run(() => api.sendToProcurement(order.id, assignee ?? undefined, note.trim() || undefined))}
      />
    </Card>
  );
}

function AdvanceStep({ detail, onChanged }: Props) {
  const { order } = detail;
  const next = LOGISTICS_NEXT[order.status]!;
  const { busy, error, run } = useAction(onChanged);
  const [supplierRef, setSupplierRef] = useState('');
  const [tracking, setTracking] = useState(order.trackingNumber ?? '');
  const [note, setNote] = useState('');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState<string | null>(order.warehouse?.id ?? null);

  useEffect(() => {
    if (next === 'READY_FOR_PICKUP') api.warehouses().then((r) => setWarehouses(r.warehouses)).catch(() => {});
  }, [next]);

  const needsSupplierRef = next === 'ORDER_PLACED';
  const disabled = (needsSupplierRef && supplierRef.trim().length < 2) || (next === 'READY_FOR_PICKUP' && !warehouseId);

  return (
    <Card>
      <ErrorBanner message={error} />
      <View style={styles.nextRow}>
        <View style={styles.nextIcon}>
          <Ionicons name={STATUS_INFO[next].icon} size={20} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.muted}>Next step</Text>
          <Text style={styles.cardTitle}>{STATUS_INFO[next].label}</Text>
        </View>
      </View>
      <HelpTip>{STATUS_INFO[order.status].staffHelp}</HelpTip>
      {needsSupplierRef ? (
        <Input label="Supplier order reference" value={supplierRef} onChangeText={setSupplierRef} autoCapitalize="characters" maxLength={100} />
      ) : null}
      {next === 'SHIPPED_FROM_CHINA' ? (
        <Input label="Tracking number (optional)" value={tracking} onChangeText={setTracking} autoCapitalize="characters" maxLength={100} />
      ) : null}
      {next === 'READY_FOR_PICKUP' ? (
        <Select
          label="Pickup warehouse"
          placeholder="Select warehouse"
          items={warehouses}
          value={warehouseId}
          onChange={(w) => setWarehouseId(w.id)}
          render={(w) => ({ title: w.name, subtitle: `${w.city}, ${w.state}` })}
          hint="The customer will receive a private pickup code."
        />
      ) : null}
      <Input label="Note for the timeline (optional)" value={note} onChangeText={setNote} multiline maxLength={1000} />
      <Button
        title={`Mark as “${STATUS_INFO[next].label}”`}
        variant="accent"
        loading={busy}
        disabled={disabled}
        onPress={() =>
          confirm('Update order status?', `The customer will be notified: ${STATUS_INFO[next].label}.`, () =>
            run(() =>
              api.advance(order.id, {
                note: note.trim() || undefined,
                supplierReference: needsSupplierRef ? supplierRef.trim() : undefined,
                trackingNumber: tracking.trim() && tracking !== order.trackingNumber ? tracking.trim() : undefined,
                warehouseId: next === 'READY_FOR_PICKUP' ? warehouseId ?? undefined : undefined,
              }),
            ),
          )
        }
      />
    </Card>
  );
}

function CompletePickup({ detail, onChanged }: Props) {
  const { order } = detail;
  const { busy, error, run } = useAction(onChanged);
  const [code, setCode] = useState('');

  return (
    <Card>
      <ErrorBanner message={error} />
      <Text style={styles.cardTitle}>Release to customer</Text>
      <HelpTip icon="shield-checkmark-outline">
        Ask {order.customer?.name ?? 'the customer'} for their 6-digit pickup code and check their ID before handing over the item.
      </HelpTip>
      <Input
        label="Pickup code"
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        placeholder="••••••"
        maxLength={6}
        style={{ flex: 1, fontSize: 24, letterSpacing: 8, paddingVertical: 12, color: colors.text }}
      />
      <Button
        title="Confirm pickup"
        icon="checkmark-done"
        variant="accent"
        loading={busy}
        disabled={code.length !== 6}
        onPress={() => run(() => api.completePickup(order.id, code)).then(() => setCode(''))}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 6 },
  big: { fontSize: 28, fontWeight: '800', color: colors.primary },
  muted: { fontSize: 14, color: colors.muted },
  total: { fontSize: 14, fontWeight: '700', color: colors.primary, marginTop: -6, marginBottom: 12 },
  bubble: { borderRadius: radius.md, padding: 12, marginBottom: 10, maxWidth: '88%' },
  mine: { backgroundColor: colors.accentSoft, alignSelf: 'flex-end' },
  theirs: { backgroundColor: colors.neutralSoft, alignSelf: 'flex-start' },
  bubbleWho: { fontSize: 12, color: colors.muted, fontWeight: '600', marginBottom: 4, textTransform: 'capitalize' },
  bubblePrice: { fontSize: 16, fontWeight: '800', color: colors.text },
  bubbleTotal: { fontSize: 13, color: colors.primary, fontWeight: '600', marginTop: 2 },
  bubbleMsg: { fontSize: 14, color: colors.text, marginTop: 6 },
  nextRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  nextIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
});
