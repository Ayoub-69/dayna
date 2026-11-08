import { StyleSheet, Text } from 'react-native';
import { colors } from '@/lib/theme';

export function Wordmark({ size = 28 }: { size?: number }) {
  return (
    <Text style={[styles.base, { fontSize: size }]} accessibilityRole="header">
      only<Text style={styles.real}>real</Text>
      <Text style={styles.dot}>.</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  base: { color: colors.text, fontWeight: '800', letterSpacing: -0.5 },
  real: { color: colors.accent },
  dot: { color: colors.real },
});
