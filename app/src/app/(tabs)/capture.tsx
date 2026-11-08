import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraType, CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { router, useIsFocused } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { api } from '@/lib/api';
import { MAX_CLIP_SECONDS, MIN_CLIP_SECONDS } from '@/lib/provenance';
import { colors } from '@/lib/theme';

/**
 * The only way to post on OnlyReal. There is deliberately no "upload from gallery" button:
 * clips must be filmed here, inside a capture session the server opened a moment earlier.
 */
export default function Capture() {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const camera = useRef<CameraView>(null);
  const [camPerm, requestCam] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setElapsed((Date.now() - startedAt.current) / 1000), 200);
    return () => clearInterval(t);
  }, [recording]);

  if (Platform.OS === 'web') {
    return (
      <Centered>
        <Text style={styles.title}>Filming works on phones</Text>
        <Text style={styles.body}>Open OnlyReal on iOS or Android to film a clip.</Text>
      </Centered>
    );
  }

  if (!camPerm || !micPerm) return <View style={styles.screen} />;

  if (!camPerm.granted || !micPerm.granted) {
    return (
      <Centered>
        <Text style={styles.title}>Film something real</Text>
        <Text style={styles.body}>
          OnlyReal posts are filmed right here in the app. That is how we keep AI-made videos out. We need your camera and microphone to
          do that.
        </Text>
        <Button
          title="Allow camera and mic"
          onPress={async () => {
            await requestCam();
            await requestMic();
          }}
        />
      </Centered>
    );
  }

  const start = async () => {
    if (!camera.current || !ready) return;
    try {
      const session = await api.startCapture();
      startedAt.current = Date.now();
      setElapsed(0);
      setRecording(true);
      const result = await camera.current.recordAsync({ maxDuration: MAX_CLIP_SECONDS });
      const durationMs = Date.now() - startedAt.current;
      setRecording(false);
      if (!result?.uri) return;
      if (durationMs < MIN_CLIP_SECONDS * 1000) {
        Alert.alert('Too short', `Clips need to be at least ${MIN_CLIP_SECONDS} seconds.`);
        return;
      }
      router.push({
        pathname: '/post',
        params: { uri: result.uri, durationMs: String(durationMs), session: JSON.stringify(session) },
      });
    } catch (e: any) {
      setRecording(false);
      Alert.alert('Could not record', e?.message ?? String(e));
    }
  };

  const stop = () => camera.current?.stopRecording();

  const progress = Math.min(elapsed / MAX_CLIP_SECONDS, 1);

  return (
    <View style={styles.screen}>
      {focused && (
        <CameraView
          ref={camera}
          style={StyleSheet.absoluteFill}
          facing={facing}
          mode="video"
          onCameraReady={() => setReady(true)}
        />
      )}

      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <View style={styles.pill}>
          <View style={[styles.liveDot, recording && { backgroundColor: colors.danger }]} />
          <Text style={styles.pillText}>{recording ? `${elapsed.toFixed(1)}s / ${MAX_CLIP_SECONDS}s` : 'Filmed in OnlyReal'}</Text>
        </View>
        {!recording && (
          <Pressable
            onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
            style={styles.flip}
            accessibilityLabel="Switch camera"
          >
            <Ionicons name="camera-reverse-outline" size={28} color="#fff" />
          </Pressable>
        )}
      </View>

      {recording && <View style={[styles.progress, { top: insets.top, width: `${progress * 100}%` }]} />}

      <View style={styles.bottom}>
        <Pressable
          onPress={recording ? stop : start}
          disabled={!ready}
          accessibilityRole="button"
          accessibilityLabel={recording ? 'Stop recording' : 'Start recording'}
          style={styles.shutterRing}
        >
          <View style={[styles.shutter, recording && styles.shutterRecording]} />
        </Pressable>
        <Text style={styles.note}>No gallery uploads. Everything here is filmed live.</Text>
      </View>
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={[styles.screen, styles.centered]}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  centered: { backgroundColor: colors.bg, padding: 24, justifyContent: 'center', gap: 16 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  body: { color: colors.textMuted, fontSize: 16, lineHeight: 23 },
  topBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.overlay, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.real },
  pillText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  flip: { padding: 8, backgroundColor: colors.overlay, borderRadius: 999 },
  progress: { position: 'absolute', left: 0, height: 4, backgroundColor: colors.accent },
  bottom: { position: 'absolute', bottom: 28, left: 0, right: 0, alignItems: 'center', gap: 14 },
  shutterRing: { width: 84, height: 84, borderRadius: 42, borderWidth: 5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutter: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accent },
  shutterRecording: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.danger },
  note: { color: '#fff', fontSize: 12, opacity: 0.85, paddingHorizontal: 24, textAlign: 'center' },
});
