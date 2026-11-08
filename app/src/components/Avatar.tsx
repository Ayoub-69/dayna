import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/lib/theme';

const TINTS = ['#FFB547', '#7BD389', '#8FB8FF', '#FF9C7A', '#D7A6FF'];

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initial = (name.trim()[0] ?? '?').toUpperCase();
  const tint = TINTS[name.length % TINTS.length];
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, borderColor: tint }]}>
      <Text style={[styles.initial, { fontSize: size * 0.42, color: tint }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, backgroundColor: colors.surfaceRaised },
  initial: { fontWeight: '800' },
});
