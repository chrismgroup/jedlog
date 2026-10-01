import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/context/auth';
import { api } from '@/lib/api';
import { naira, parseAmount } from '@/lib/format';
import type { Warehouse } from '@/lib/types';
import { Button, Card, ErrorBanner, HelpTip, InfoRow, Input, Screen, Select, Steps, Title } from '@/components/ui';
import { colors } from '@/theme';

const STEP_LABELS = ['What do you need?', 'Quantity & budget', 'Review & submit'];

export default function NewOrder() {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [itemName, setItemName] = useState('');
  const [description, setDescription] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [budget, setBudget] = useState('');
  const [warehouseId, setWarehouseId] = useState<string | null>(user?.preferredWarehouseId ?? null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.warehouses().then((r) => setWarehouses(r.warehouses)).catch(() => {});
  }, []);

  const qty = Number(quantity);
  const budgetValue = budget.trim() ? parseAmount(budget) : undefined;

  const next = () => {
    setError(null);
    if (step === 0) {
      if (itemName.trim().length < 2) return setError('Tell us the name of the item.');
      if (productUrl.trim() && !/^https?:\/\/\S+\.\S+/i.test(productUrl.trim())) {
        return setError('The product link should start with http:// or https://');
      }
    }
    if (step === 1) {
      if (!Number.isInteger(qty) || qty < 1 || qty > 100000) return setError('Enter a quantity between 1 and 100,000.');
      if (budgetValue !== undefined && (Number.isNaN(budgetValue) || budgetValue <= 0)) {
        return setError('Enter your budget as a number, e.g. 25000 — or leave it empty.');
      }
    }
    setStep((s) => s + 1);
  };

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      const { order } = await api.createOrder({
        itemName: itemName.trim(),
        description: description.trim() || undefined,
        productUrl: productUrl.trim() || undefined,
        quantity: qty,
        targetUnitPrice: budgetValue,
        warehouseId: warehouseId ?? undefined,
      });
      router.replace({ pathname: '/order/[id]', params: { id: order.id } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const warehouse = warehouses.find((w) => w.id === warehouseId);

  return (
    <Screen edges={['bottom']}>
      <Steps total={3} current={step} labels={STEP_LABELS} />
      <ErrorBanner message={error} />

      {step === 0 && (
        <>
          <Title sub="Be as specific as you can — brand, model, size, colour.">What would you like to order?</Title>
          <Input label="Item name" value={itemName} onChangeText={setItemName} placeholder="e.g. 300W solar panel" maxLength={150} />
          <Input
            label="Details (optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="Specifications, colour, size, packaging…"
            multiline
            maxLength={2000}
          />
          <Input
            label="Product link (optional)"
            value={productUrl}
            onChangeText={setProductUrl}
            placeholder="https://…"
            autoCapitalize="none"
            keyboardType="url"
            maxLength={500}
            hint="A link from Alibaba, 1688, AliExpress etc. helps us find the exact item."
          />
          <Button title="Continue" onPress={next} />
        </>
      )}

      {step === 1 && (
        <>
          <Title sub="Your budget helps us find the best supplier. It's not a final price.">How many, and your budget?</Title>
          <Input label="Quantity" value={quantity} onChangeText={(t) => setQuantity(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" maxLength={6} />
          <Input
            label="Target price per unit in ₦ (optional)"
            value={budget}
            onChangeText={setBudget}
            keyboardType="decimal-pad"
            placeholder="e.g. 45000"
            hint={budgetValue && !Number.isNaN(budgetValue) && qty > 0 ? `About ${naira(budgetValue * qty)} in total` : undefined}
          />
          <Select
            label="Pickup warehouse"
            placeholder="Select warehouse"
            items={warehouses}
            value={warehouseId}
            onChange={(w) => setWarehouseId(w.id)}
            render={(w) => ({ title: w.name, subtitle: `${w.address}, ${w.city}, ${w.state}` })}
          />
          <HelpTip>Prices include buying, shipping and customs clearing. You'll see the full price before you commit.</HelpTip>
          <Button title="Review request" onPress={next} />
          <Button title="Back" variant="ghost" onPress={() => setStep(0)} style={{ marginTop: 6 }} />
        </>
      )}

      {step === 2 && (
        <>
          <Title sub="Nothing is charged now. Our team will send you a price to accept or negotiate.">Review your request</Title>
          <Card>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 6 }}>{itemName}</Text>
            {description ? <Text style={{ color: colors.muted, marginBottom: 8 }}>{description}</Text> : null}
            <InfoRow label="Quantity" value={qty.toLocaleString()} />
            <InfoRow label="Target unit price" value={budgetValue ? naira(budgetValue) : 'Not set'} />
            <InfoRow label="Pickup" value={warehouse ? warehouse.name : 'Default'} />
            {productUrl ? <InfoRow label="Link" value="Included" /> : null}
          </Card>
          <View>
            <HelpTip icon="time-outline">What happens next: a manager reviews your request and sends you a quote, usually within 24 hours.</HelpTip>
          </View>
          <Button title="Submit request" variant="accent" icon="send" onPress={submit} loading={loading} />
          <Button title="Back" variant="ghost" onPress={() => setStep(1)} style={{ marginTop: 6 }} />
        </>
      )}
    </Screen>
  );
}
