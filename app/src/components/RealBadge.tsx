import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@/lib/theme';
import type { ProvenanceLevel } from '@/lib/types';

const LABELS: Record<ProvenanceLevel, string> = {
  captured_in_app: 'Real · filmed in app',
  attested: 'Real · verified device',
  c2pa_camera: 'Real · camera signed',
};

export function RealBadge({ level }: { level: ProvenanceLevel }) {
  return (
    <View style={styles.badge} accessibilityLabel={LABELS[level]}>
      <View style={styles.dot} />
      <Text style={styles.text}>{LABELS[level]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.overlay,
    borderWidth: 1,
    borderColor: colors.real,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.real },
  text: { color: colors.real, fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
});
