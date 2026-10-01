import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/auth';
import { api } from '@/lib/api';
import { NIGERIAN_STATES, passwordChecks } from '@/lib/format';
import type { Warehouse } from '@/lib/types';
import { Button, ErrorBanner, HelpTip, Input, Screen, Select, Steps, Title } from '@/components/ui';
import { colors } from '@/theme';

const STEP_LABELS = ['Your details', 'Secure your account', 'Pickup location'];
const stateItems = NIGERIAN_STATES.map((s) => ({ id: s }));

export default function Register() {
  const { register } = useAuth();
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [state, setState] = useState<string | null>(null);
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.warehouses().then((r) => setWarehouses(r.warehouses)).catch((e) => setError(e.message));
  }, []);

  // Suggest the warehouse in the customer's state first.
  useEffect(() => {
    if (!state || warehouseId) return;
    const match = warehouses.find((w) => w.state.toLowerCase() === state.toLowerCase());
    if (match) setWarehouseId(match.id);
  }, [state, warehouses, warehouseId]);

  const checks = passwordChecks(password);

  const next = () => {
    setError(null);
    if (step === 0) {
      if (fullName.trim().length < 2) return setError('Enter your full name.');
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.');
      if (!/^\+?[0-9 ]{7,20}$/.test(phone.trim())) return setError('Enter a valid phone number.');
    }
    if (step === 1) {
      if (!checks.every((c) => c.ok)) return setError('Your password does not meet all the requirements.');
      if (password !== confirm) return setError('Passwords do not match.');
    }
    setStep((s) => s + 1);
  };

  const submit = async () => {
    if (!state || !warehouseId) return setError('Choose your state and pickup warehouse.');
    setLoading(true);
    setError(null);
    try {
      await register({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        state,
        preferredWarehouseId: warehouseId,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const sortedWarehouses = [...warehouses].sort(
    (a, b) => Number(b.state === state) - Number(a.state === state) || a.name.localeCompare(b.name),
  );

  return (
    <Screen edges={['bottom']}>
      <Steps total={3} current={step} labels={STEP_LABELS} />
      <ErrorBanner message={error} />

      {step === 0 && (
        <>
          <Title sub="We'll use these to keep you updated on your orders.">Tell us about you</Title>
          <Input label="Full name" value={fullName} onChangeText={setFullName} placeholder="Ada Okafor" autoComplete="name" textContentType="name" />
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <Input
            label="Phone number"
            value={phone}
            onChangeText={setPhone}
            placeholder="0803 123 4567"
            keyboardType="phone-pad"
            autoComplete="tel"
            hint="Warehouse staff may call this number when your item arrives."
          />
          <Button title="Continue" onPress={next} />
        </>
      )}

      {step === 1 && (
        <>
          <Title sub="Choose a strong password you don't use anywhere else.">Secure your account</Title>
          <Input label="Password" value={password} onChangeText={setPassword} secure autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: -6, marginBottom: 14 }}>
            {checks.map((c) => (
              <View key={c.label} style={{ flexDirection: 'row', alignItems: 'center', width: '50%', marginBottom: 6 }}>
                <Ionicons name={c.ok ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={c.ok ? colors.success : colors.muted} />
                <Text style={{ marginLeft: 6, fontSize: 13, color: c.ok ? colors.success : colors.muted }}>{c.label}</Text>
              </View>
            ))}
          </View>
          <Input label="Confirm password" value={confirm} onChangeText={setConfirm} secure autoCapitalize="none" textContentType="newPassword" />
          <Button title="Continue" onPress={next} />
          <Button title="Back" variant="ghost" onPress={() => setStep(0)} style={{ marginTop: 6 }} />
        </>
      )}

      {step === 2 && (
        <>
          <Title sub="Pick the warehouse closest to you. This is where you'll collect your items.">Where will you pick up?</Title>
          <Select
            label="Your state"
            placeholder="Select state"
            items={stateItems}
            value={state}
            onChange={(s) => setState(s.id)}
            render={(s) => ({ title: s.id })}
          />
          <Select
            label="Pickup warehouse"
            placeholder="Select warehouse"
            items={sortedWarehouses}
            value={warehouseId}
            onChange={(w) => setWarehouseId(w.id)}
            render={(w) => ({ title: w.name, subtitle: `${w.address}, ${w.city}, ${w.state}` })}
            hint="You can choose a different warehouse for each order later."
          />
          <HelpTip icon="shield-checkmark-outline">
            When your item is ready, you'll get a private 6-digit pickup code. Only show it to warehouse staff.
          </HelpTip>
          <Button title="Create account" variant="accent" onPress={submit} loading={loading} />
          <Button title="Back" variant="ghost" onPress={() => setStep(1)} style={{ marginTop: 6 }} />
        </>
      )}
    </Screen>
  );
}
