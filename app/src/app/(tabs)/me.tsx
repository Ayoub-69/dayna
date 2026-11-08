import { useEffect, useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { ProfileView } from '@/components/ProfileView';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { colors, radius } from '@/lib/theme';

export default function Me() {
  const { userId, signOut } = useAuth();
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!userId || !editing) return;
    api.fetchProfile(userId).then((p) => {
      setUsername(p?.username ?? '');
      setDisplayName(p?.display_name ?? '');
      setBio(p?.bio ?? '');
    });
  }, [userId, editing]);

  if (!userId) return null;

  const save = async () => {
    try {
      await api.updateProfile(userId, { username: username.trim().toLowerCase(), display_name: displayName.trim(), bio: bio.trim() });
      setEditing(false);
      setVersion((v) => v + 1);
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? String(e));
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ProfileView
        key={version}
        userId={userId}
        header={
          editing ? (
            <View style={styles.form}>
              <Field value={username} onChange={setUsername} placeholder="username" />
              <Field value={displayName} onChange={setDisplayName} placeholder="Display name" />
              <Field value={bio} onChange={setBio} placeholder="Bio" />
              <Button title="Save" onPress={save} />
              <Button title="Cancel" variant="ghost" onPress={() => setEditing(false)} />
            </View>
          ) : (
            <View style={styles.actions}>
              <Button title="Edit profile" variant="ghost" onPress={() => setEditing(true)} />
              <Button title="Sign out" variant="ghost" onPress={signOut} />
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

function Field({ value, onChange, placeholder }: { value: string; onChange: (s: string) => void; placeholder: string }) {
  return (
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      autoCapitalize="none"
    />
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  form: { alignSelf: 'stretch', gap: 10, marginTop: 8 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 14,
    minHeight: 46,
  },
});
