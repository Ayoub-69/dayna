import { useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/Avatar';
import { api } from '@/lib/api';
import { colors, radius } from '@/lib/theme';
import type { Comment } from '@/lib/types';

export default function Comments() {
  const { videoId } = useLocalSearchParams<{ videoId: string }>();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.fetchComments(videoId).then(setComments).catch(() => {});
  }, [videoId]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      const c = await api.addComment(videoId, body);
      setComments((list) => [...list, c]);
      setText('');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={60}>
        <FlatList
          data={comments}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 16, gap: 16 }}
          ListEmptyComponent={<Text style={styles.empty}>No comments yet. Say something kind.</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Avatar name={item.author.display_name || item.author.username} size={34} />
              <View style={{ flex: 1 }}>
                <Text style={styles.handle}>@{item.author.username}</Text>
                <Text style={styles.body}>{item.body}</Text>
              </View>
            </View>
          )}
        />
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder="Add a comment"
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={setText}
            maxLength={500}
            multiline
          />
          <Pressable onPress={send} disabled={sending || !text.trim()} accessibilityLabel="Send comment" hitSlop={8}>
            <Ionicons name="arrow-up-circle" size={36} color={text.trim() ? colors.accent : colors.border} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 24 },
  row: { flexDirection: 'row', gap: 12 },
  handle: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  body: { color: colors.text, fontSize: 15, lineHeight: 21, marginTop: 2 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: colors.border },
  input: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});
