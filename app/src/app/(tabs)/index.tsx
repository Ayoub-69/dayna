import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useIsFocused } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { VideoCard } from '@/components/VideoCard';
import { Wordmark } from '@/components/Wordmark';
import { api } from '@/lib/api';
import { colors } from '@/lib/theme';
import type { Video } from '@/lib/types';

export default function Feed() {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const [videos, setVideos] = useState<Video[]>([]);
  const [height, setHeight] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingMore = useRef(false);
  const reachedEnd = useRef(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const page = await api.fetchFeed();
      reachedEnd.current = page.length === 0;
      setVideos(page);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load the feed.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const loadMore = async () => {
    if (loadingMore.current || reachedEnd.current || videos.length === 0) return;
    loadingMore.current = true;
    try {
      const page = await api.fetchFeed(videos[videos.length - 1].created_at);
      if (page.length === 0) reachedEnd.current = true;
      setVideos((v) => [...v, ...page.filter((p) => !v.some((x) => x.id === p.id))]);
    } finally {
      loadingMore.current = false;
    }
  };

  const onViewable = useRef(({ viewableItems }: { viewableItems: { index?: number | null }[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) setActiveIndex(first.index);
  }).current;

  return (
    <View style={styles.screen} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={colors.accent} />
      ) : videos.length === 0 ? (
        <View style={[styles.empty, { paddingTop: insets.top + 24 }]}>
          <Wordmark size={34} />
          <Text style={styles.emptyTitle}>{error ?? 'Nothing here yet.'}</Text>
          <Text style={styles.emptyBody}>Be the first to post something real. Everything on OnlyReal is filmed with the in-app camera.</Text>
          <Button title="Film a clip" onPress={() => router.navigate('/capture')} />
          <Button title="Refresh" variant="ghost" onPress={load} />
        </View>
      ) : height > 0 ? (
        <FlatList
          data={videos}
          keyExtractor={(v) => v.id}
          renderItem={({ item, index }) => (
            <VideoCard video={item} height={height} bottomInset={0} active={focused && index === activeIndex} />
          )}
          pagingEnabled
          snapToInterval={height}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 70 }}
          onEndReached={loadMore}
          onEndReachedThreshold={2}
          windowSize={3}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          removeClippedSubviews
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.accent} onRefresh={() => { setRefreshing(true); load(); }} />}
        />
      ) : null}

      {videos.length > 0 && (
        <View style={[styles.header, { top: insets.top + 8 }]} pointerEvents="none">
          <Wordmark size={22} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  header: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  empty: { flex: 1, backgroundColor: colors.bg, padding: 24, gap: 14 },
  emptyTitle: { color: colors.text, fontSize: 22, fontWeight: '700', marginTop: 24 },
  emptyBody: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginBottom: 8 },
});
