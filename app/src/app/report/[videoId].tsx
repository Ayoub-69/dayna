import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '@/components/Button';
import { api } from '@/lib/api';
import { colors, radius } from '@/lib/theme';
import type { ReportReason } from '@/lib/types';

const REASONS: { value: ReportReason; label: string; hint: string }[] = [
  { value: 'ai_generated', label: 'Looks AI-generated', hint: 'Synthetic video, AI face or voice, deepfake' },
  { value: 'ai_ad', label: 'AI-made ad or promo', hint: 'Advertising that uses AI-generated people or footage' },
  { value: 'not_original', label: 'Filmed off a screen', hint: 'Someone recorded another video to sneak it in' },
  { value: 'spam', label: 'Spam or scam', hint: '' },
  { value: 'harmful', label: 'Harmful or abusive', hint: '' },
  { value: 'other', label: 'Something else', hint: '' },
];

export default function Report() {
  const { videoId } = useLocalSearchParams<{ videoId: string }>();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!reason) return;
    setBusy(true);
    try {
      await api.report(videoId, reason, details.trim() || undefined);
      Alert.alert('Thanks for keeping it real', 'We will take a look. Clips with several AI reports are pulled for review automatically.');
      router.back();
    } catch (e: any) {
      Alert.alert('Could not send report', e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, gap: 10 }}>
      <Text style={styles.lead}>What's wrong with this clip?</Text>
      {REASONS.map((r) => (
        <Pressable
          key={r.value}
          onPress={() => setReason(r.value)}
          style={[styles.option, reason === r.value && styles.optionOn]}
          accessibilityRole="radio"
          accessibilityState={{ selected: reason === r.value }}
        >
          <Text style={styles.optionLabel}>{r.label}</Text>
          {!!r.hint && <Text style={styles.optionHint}>{r.hint}</Text>}
        </Pressable>
      ))}
      <TextInput
        style={styles.input}
        placeholder="Anything else we should know? (optional)"
        placeholderTextColor={colors.textMuted}
        value={details}
        onChangeText={setDetails}
        multiline
        maxLength={500}
      />
      <View style={{ height: 4 }} />
      <Button title="Send report" onPress={submit} disabled={!reason} loading={busy} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  lead: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 6 },
  option: { padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 2 },
  optionOn: { borderColor: colors.accent },
  optionLabel: { color: colors.text, fontSize: 16, fontWeight: '600' },
  optionHint: { color: colors.textMuted, fontSize: 13 },
  input: {
    minHeight: 80,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 15,
    padding: 12,
    textAlignVertical: 'top',
  },
});
