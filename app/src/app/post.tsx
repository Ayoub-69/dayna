import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Button } from '@/components/Button';
import { RealBadge } from '@/components/RealBadge';
import { api } from '@/lib/api';
import { colors, radius } from '@/lib/theme';
import type { CaptureSession } from '@/lib/types';

const MAX_CAPTION = 300;

export default function Post() {
  const params = useLocalSearchParams<{ uri: string; durationMs: string; session: string }>();
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const player = useVideoPlayer(params.uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  const publish = async () => {
    setBusy(true);
    try {
      const session = JSON.parse(params.session) as CaptureSession;
      const { status } = await api.publishCapture({
        session,
        fileUri: params.uri,
        durationMs: Number(params.durationMs),
        caption: caption.trim(),
      });
      if (status === 'held_for_review') {
        Alert.alert('Almost there', 'Your clip is being double-checked before it goes live. This usually takes a few minutes.');
      }
      router.dismissTo('/');
    } catch (e: any) {
      Alert.alert('Could not post', e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.previewRow}>
          <VideoView player={player} style={styles.preview} contentFit="cover" nativeControls={false} />
          <View style={styles.previewInfo}>
            <RealBadge level="captured_in_app" />
            <Text style={styles.infoText}>
              {(Number(params.durationMs) / 1000).toFixed(1)}s clip, filmed just now. We fingerprint it and check it on our side before it
              goes live.
            </Text>
          </View>
        </View>

        <TextInput
          style={styles.caption}
          placeholder="Say something about it…"
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={MAX_CAPTION}
          value={caption}
          onChangeText={setCaption}
        />
        <Text style={styles.counter}>
          {caption.length}/{MAX_CAPTION}
        </Text>

        <Button title="Post" onPress={publish} loading={busy} />
        <Button title="Discard" variant="ghost" onPress={() => router.back()} disabled={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12 },
  previewRow: { flexDirection: 'row', gap: 14 },
  preview: { width: 120, height: 213, borderRadius: radius.md, backgroundColor: '#000', overflow: 'hidden' },
  previewInfo: { flex: 1, gap: 10 },
  infoText: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  caption: {
    minHeight: 110,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 16,
    padding: 14,
    textAlignVertical: 'top',
  },
  counter: { color: colors.textMuted, fontSize: 12, alignSelf: 'flex-end' },
});
