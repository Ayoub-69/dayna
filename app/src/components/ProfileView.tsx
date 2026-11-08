import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { api } from '@/lib/api';
import { colors } from '@/lib/theme';
import type { Profile, Video } from '@/lib/types';
import { Avatar } from './Avatar';

type Props = { userId: string; header?: React.ReactNode };

export function ProfileView({ userId, header }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const { width } = useWindowDimensions();
  const tile = (width - 4) / 3;

  useFocusEffect(
    useCallback(() => {
      api.fetchProfile(userId).then(setProfile).catch(() => {});
      api.fetchUserVideos(userId).then(setVideos).catch(() => {});
    }, [userId]),
  );

  const name = profile?.display_name || profile?.username || '';
  const likes = videos.reduce((n, v) => n + v.like_count, 0);

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      data={videos}
      numColumns={3}
      keyExtractor={(v) => v.id}
      columnWrapperStyle={{ gap: 2 }}
      contentContainerStyle={{ gap: 2, paddingBottom: 40 }}
      ListHeaderComponent={
        <View style={styles.header}>
          <Avatar name={name || '?'} size={84} />
          <Text style={styles.name}>{name}</Text>
          {!!profile && <Text style={styles.handle}>@{profile.username}</Text>}
          {!!profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}
          <View style={styles.stats}>
            <Stat value={videos.length} label="Real posts" />
            <Stat value={likes} label="Likes" />
          </View>
          {header}
        </View>
      }
      ListEmptyComponent={<Text style={styles.empty}>No posts yet.</Text>}
      renderItem={({ item }) => <Tile video={item} size={tile} />}
    />
  );
}

function Tile({ video, size }: { video: Video; size: number }) {
  // A paused player shows the first frame as the thumbnail.
  const player = useVideoPlayer(video.video_url, (p) => {
    p.muted = true;
  });
  return (
    <Pressable style={{ width: size, height: size * 1.6, backgroundColor: colors.surface }}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      {video.status === 'held_for_review' && (
        <View style={styles.review}>
          <Text style={styles.reviewText}>In review</Text>
        </View>
      )}
    </Pressable>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16, gap: 6 },
  name: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 8 },
  handle: { color: colors.textMuted, fontSize: 15 },
  bio: { color: colors.text, fontSize: 15, textAlign: 'center', marginTop: 4 },
  stats: { flexDirection: 'row', gap: 40, marginVertical: 12 },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: 13 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 24 },
  review: { position: 'absolute', left: 6, bottom: 6, backgroundColor: colors.overlay, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  reviewText: { color: colors.accent, fontSize: 11, fontWeight: '700' },
});
