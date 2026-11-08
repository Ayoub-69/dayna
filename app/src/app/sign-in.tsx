import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Wordmark } from '@/components/Wordmark';
import { useAuth } from '@/lib/auth';
import { hasBackend } from '@/lib/supabase';
import { colors, radius } from '@/lib/theme';

export default function SignIn() {
  const { sendCode, verifyCode, signInDemo } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e: any) {
      Alert.alert('Something went wrong', e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.inner}>
        <View style={styles.hero}>
          <Wordmark size={44} />
          <Text style={styles.tagline}>Short videos made by people.{'\n'}No AI clips. No AI ads.</Text>
          <View style={styles.rules}>
            <Rule text="Every post is filmed in the OnlyReal camera" />
            <Rule text="Each clip is fingerprinted and checked on upload" />
            <Rule text="Anyone can flag something that looks AI-made" />
          </View>
        </View>

        {hasBackend ? (
          <View style={styles.form}>
            {!sent ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="you@email.com"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                />
                <Button title="Send me a code" loading={busy} disabled={!email.includes('@')} onPress={() => run(async () => { await sendCode(email.trim()); setSent(true); })} />
              </>
            ) : (
              <>
                <Text style={styles.hint}>Enter the 6-digit code we sent to {email}.</Text>
                <TextInput
                  style={styles.input}
                  placeholder="123456"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={code}
                  onChangeText={setCode}
                />
                <Button title="Sign in" loading={busy} disabled={code.length < 6} onPress={() => run(() => verifyCode(email.trim(), code))} />
                <Button title="Use a different email" variant="ghost" onPress={() => setSent(false)} />
              </>
            )}
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.hint}>Demo mode: no backend is configured, so posts stay on this phone.</Text>
            <Button title="Try the demo" onPress={signInDemo} />
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Rule({ text }: { text: string }) {
  return (
    <View style={styles.rule}>
      <View style={styles.ruleDot} />
      <Text style={styles.ruleText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, padding: 24, justifyContent: 'space-between' },
  hero: { marginTop: 48, gap: 16 },
  tagline: { color: colors.text, fontSize: 22, lineHeight: 30, fontWeight: '600' },
  rules: { marginTop: 12, gap: 10 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ruleDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.real },
  ruleText: { color: colors.textMuted, fontSize: 15 },
  form: { gap: 12, marginBottom: 12 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 17,
    paddingHorizontal: 16,
    minHeight: 52,
  },
  hint: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
});
