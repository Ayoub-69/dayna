import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { api } from '@/lib/api';
import { colors } from '@/lib/theme';
import type { Video } from '@/lib/types';
import { Avatar } from './Avatar';
import { RealBadge } from './RealBadge';

type Props = { video: Video; active: boolean; height: number; bottomInset: number };

export function VideoCard({ video, active, height, bottomInset }: Props) {
  const [liked, setLiked] = useState(video.liked_by_me);
  const [likes, setLikes] = useState(video.like_count);
  const [paused, setPaused] = useState(false);

  const player = useVideoPlayer(video.video_url, (p) => {
    p.loop = true;
  });

  useEffect(() => {
    if (active && !paused) player.play();
    else player.pause();
  }, [active, paused, player]);

  useEffect(() => {
    if (!active) setPaused(false);
  }, [active]);

  const onLike = async () => {
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    try {
      await api.toggleLike({ ...video, liked_by_me: liked });
    } catch {
      setLiked(!next);
      setLikes((n) => n + (next ? -1 : 1));
    }
  };

  const name = video.author.display_name || video.author.username;

  return (
    <View style={{ height, backgroundColor: '#000' }}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => setPaused((p) => !p)} accessibilityLabel="Play or pause">
        <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      </Pressable>

      {paused && (
        <View pointerEvents="none" style={styles.pauseIcon}>
          <Ionicons name="play" size={64} color="rgba(255,255,255,0.8)" />
        </View>
      )}

      <View style={[styles.rail, { bottom: bottomInset + 24 }]}>
        <Pressable onPress={() => router.push(`/user/${video.author_id}`)} accessibilityLabel={`Open ${name}'s profile`}>
          <Avatar name={name} size={46} />
        </Pressable>
        <RailButton icon={liked ? 'heart' : 'heart-outline'} tint={liked ? colors.accent : '#fff'} label={String(likes)} onPress={onLike} />
        <RailButton icon="chatbubble-ellipses-outline" label={String(video.comment_count)} onPress={() => router.push(`/comments/${video.id}`)} />
        <RailButton icon="flag-outline" label="Report" onPress={() => router.push(`/report/${video.id}`)} />
      </View>

      <View style={[styles.meta, { bottom: bottomInset + 20 }]} pointerEvents="box-none">
        <RealBadge level={video.provenance} />
        <Text style={styles.handle}>@{video.author.username}</Text>
        {!!video.caption && (
          <Text style={styles.caption} numberOfLines={3}>
            {video.caption}
          </Text>
        )}
      </View>
    </View>
  );
}

function RailButton({ icon, label, onPress, tint = '#fff' }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; tint?: string }) {
  return (
    <Pressable onPress={onPress} style={styles.railButton} accessibilityRole="button" accessibilityLabel={label} hitSlop={8}>
      <Ionicons name={icon} size={32} color={tint} />
      <Text style={styles.railLabel}>{label}</Text>
    </Pressable>
  );
}

const shadow = { textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } };

const styles = StyleSheet.create({
  pauseIcon: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  rail: { position: 'absolute', right: 12, alignItems: 'center', gap: 18 },
  railButton: { alignItems: 'center', gap: 2 },
  railLabel: { color: '#fff', fontSize: 12, fontWeight: '600', ...shadow },
  meta: { position: 'absolute', left: 14, right: 84, gap: 6 },
  handle: { color: '#fff', fontSize: 16, fontWeight: '800', ...shadow },
  caption: { color: colors.text, fontSize: 14, lineHeight: 19, ...shadow },
});
