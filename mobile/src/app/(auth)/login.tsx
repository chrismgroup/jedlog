import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/auth';
import { Button, ErrorBanner, Input, Screen } from '@/components/ui';
import { colors } from '@/theme';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setError((e as Error).message);
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.hero}>
        <View style={styles.logo}>
          <Ionicons name="airplane" size={30} color="#fff" />
        </View>
        <Text style={styles.brand}>Jetlog</Text>
        <Text style={styles.tagline}>Order from China. Track every step to your door.</Text>
      </View>

      <View style={styles.steps}>
        {[
          ['create-outline', 'Request'],
          ['pricetags-outline', 'Agree price'],
          ['airplane-outline', 'We ship'],
          ['cube-outline', 'Pick up'],
        ].map(([icon, label]) => (
          <View key={label} style={styles.step}>
            <Ionicons name={icon as 'create-outline'} size={20} color={colors.accent} />
            <Text style={styles.stepText}>{label}</Text>
          </View>
        ))}
      </View>

      <ErrorBanner message={error} />
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
      />
      <Input
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="Your password"
        secure
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={submit}
        returnKeyType="go"
      />
      <Button title="Sign in" onPress={submit} loading={loading} style={{ marginTop: 6 }} />

      <View style={styles.footer}>
        <Text style={styles.footerText}>New to Jetlog? </Text>
        <Link href="/register" style={styles.link}>
          Create an account
        </Link>
      </View>
      <View style={styles.secure}>
        <Ionicons name="shield-checkmark-outline" size={14} color={colors.muted} />
        <Text style={styles.secureText}> Your data is encrypted in transit and on this device.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginTop: 24, marginBottom: 24 },
  logo: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 14, transform: [{ rotate: '-8deg' }] },
  brand: { fontSize: 32, fontWeight: '900', color: colors.primary, letterSpacing: -1 },
  tagline: { fontSize: 15, color: colors.muted, marginTop: 6, textAlign: 'center' },
  steps: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 24 },
  step: { alignItems: 'center', flex: 1 },
  stepText: { fontSize: 12, color: colors.text, marginTop: 6, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 22 },
  footerText: { color: colors.muted, fontSize: 15 },
  link: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  secure: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 28 },
  secureText: { fontSize: 12, color: colors.muted },
});
