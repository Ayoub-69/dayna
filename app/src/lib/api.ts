import { File } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { hasBackend, supabase } from './supabase';
import { sha256OfFile } from './provenance';
import type { CaptureSession, Comment, Profile, ReportReason, Video } from './types';

/**
 * One data API for the whole app. With Supabase configured it talks to the backend;
 * without it, a small in-memory demo store lets you try the app in Expo Go right away.
 */
export interface Api {
  fetchFeed(before?: string): Promise<Video[]>;
  fetchUserVideos(userId: string): Promise<Video[]>;
  fetchProfile(userId: string): Promise<Profile | null>;
  updateProfile(userId: string, patch: Partial<Pick<Profile, 'username' | 'display_name' | 'bio'>>): Promise<void>;
  toggleLike(video: Video): Promise<boolean>;
  fetchComments(videoId: string): Promise<Comment[]>;
  addComment(videoId: string, body: string): Promise<Comment>;
  report(videoId: string, reason: ReportReason, details?: string): Promise<void>;
  /** Opens a server-side capture session right before the camera starts recording. */
  startCapture(): Promise<CaptureSession>;
  /** Uploads a clip recorded in this capture session and asks the server to verify and publish it. */
  publishCapture(input: {
    session: CaptureSession;
    fileUri: string;
    durationMs: number;
    caption: string;
  }): Promise<{ status: Video['status'] }>;
}

const PAGE = 8;

// ---------------------------------------------------------------- Supabase

const VIDEO_COLUMNS =
  'id, author_id, caption, storage_path, duration_ms, provenance, status, like_count, comment_count, created_at, author:profiles!videos_author_id_fkey(id, username, display_name)';

type VideoRow = Omit<Video, 'video_url' | 'liked_by_me' | 'author'> & {
  storage_path: string;
  author: Video['author'] | Video['author'][];
};

async function currentUserId(): Promise<string> {
  const { data } = await supabase!.auth.getUser();
  if (!data.user) throw new Error('Please sign in first.');
  return data.user.id;
}

async function hydrate(rows: VideoRow[]): Promise<Video[]> {
  if (rows.length === 0) return [];
  const sb = supabase!;
  const { data: signed, error } = await sb.storage
    .from('videos')
    .createSignedUrls(rows.map((r) => r.storage_path), 60 * 60);
  if (error) throw error;
  const urlByPath = new Map(signed.map((s) => [s.path, s.signedUrl]));

  const { data: auth } = await sb.auth.getUser();
  let liked = new Set<string>();
  if (auth.user) {
    const { data: likes } = await sb
      .from('likes')
      .select('video_id')
      .eq('user_id', auth.user.id)
      .in('video_id', rows.map((r) => r.id));
    liked = new Set((likes ?? []).map((l) => l.video_id as string));
  }

  return rows.map(({ storage_path, author, ...r }) => ({
    ...r,
    author: Array.isArray(author) ? author[0] : author,
    video_url: urlByPath.get(storage_path) ?? '',
    liked_by_me: liked.has(r.id),
  }));
}

const supabaseApi: Api = {
  async fetchFeed(before) {
    let q = supabase!
      .from('videos')
      .select(VIDEO_COLUMNS)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(PAGE);
    if (before) q = q.lt('created_at', before);
    const { data, error } = await q;
    if (error) throw error;
    return hydrate(data as unknown as VideoRow[]);
  },

  async fetchUserVideos(userId) {
    const { data, error } = await supabase!
      .from('videos')
      .select(VIDEO_COLUMNS)
      .eq('author_id', userId)
      .neq('status', 'removed')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return hydrate(data as unknown as VideoRow[]);
  },

  async fetchProfile(userId) {
    const { data, error } = await supabase!.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) throw error;
    return data as Profile | null;
  },

  async updateProfile(userId, patch) {
    const { error } = await supabase!.from('profiles').update(patch).eq('id', userId);
    if (error) throw error;
  },

  async toggleLike(video) {
    const uid = await currentUserId();
    if (video.liked_by_me) {
      const { error } = await supabase!.from('likes').delete().match({ user_id: uid, video_id: video.id });
      if (error) throw error;
      return false;
    }
    const { error } = await supabase!.from('likes').insert({ user_id: uid, video_id: video.id });
    if (error) throw error;
    return true;
  },

  async fetchComments(videoId) {
    const { data, error } = await supabase!
      .from('comments')
      .select('id, video_id, body, created_at, author:profiles!comments_author_id_fkey(id, username, display_name)')
      .eq('video_id', videoId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data as any[]).map((c) => ({ ...c, author: Array.isArray(c.author) ? c.author[0] : c.author }));
  },

  async addComment(videoId, body) {
    const uid = await currentUserId();
    const { data, error } = await supabase!
      .from('comments')
      .insert({ video_id: videoId, author_id: uid, body })
      .select('id, video_id, body, created_at, author:profiles!comments_author_id_fkey(id, username, display_name)')
      .single();
    if (error) throw error;
    const c = data as any;
    return { ...c, author: Array.isArray(c.author) ? c.author[0] : c.author };
  },

  async report(videoId, reason, details) {
    const uid = await currentUserId();
    const { error } = await supabase!
      .from('reports')
      .upsert({ video_id: videoId, reporter_id: uid, reason, details: details ?? null }, { onConflict: 'video_id,reporter_id' });
    if (error) throw error;
  },

  async startCapture() {
    const { data, error } = await supabase!.rpc('start_capture');
    if (error) throw error;
    return (Array.isArray(data) ? data[0] : data) as CaptureSession;
  },

  async publishCapture({ session, fileUri, durationMs, caption }) {
    const uid = await currentUserId();
    const sha256 = await sha256OfFile(fileUri);
    const body = await new File(fileUri).arrayBuffer();
    const path = `${uid}/${session.session_id}.mp4`;
    const { error: upErr } = await supabase!.storage
      .from('videos')
      .upload(path, body, { contentType: 'video/mp4', upsert: false });
    if (upErr) throw upErr;

    const { data, error } = await supabase!.functions.invoke('publish-capture', {
      body: { session_id: session.session_id, nonce: session.nonce, sha256, duration_ms: durationMs, caption },
    });
    if (error) throw error;
    return data as { status: Video['status'] };
  },
};

// ---------------------------------------------------------------- Demo mode

export const DEMO_USER: Profile = {
  id: 'demo-user',
  username: 'you',
  display_name: 'You',
  bio: 'Trying OnlyReal in demo mode.',
  created_at: new Date().toISOString(),
};

const demo = {
  profiles: new Map<string, Profile>([[DEMO_USER.id, DEMO_USER]]),
  videos: [] as Video[],
  comments: [] as Comment[],
  openSessions: new Map<string, CaptureSession>(),
};

const authorOf = (p: Profile) => ({ id: p.id, username: p.username, display_name: p.display_name });

const demoApi: Api = {
  async fetchFeed(before) {
    const list = demo.videos.filter((v) => v.status === 'published' && (!before || v.created_at < before));
    return list.slice(0, PAGE);
  },
  async fetchUserVideos(userId) {
    return demo.videos.filter((v) => v.author_id === userId);
  },
  async fetchProfile(userId) {
    return demo.profiles.get(userId) ?? null;
  },
  async updateProfile(userId, patch) {
    const p = demo.profiles.get(userId);
    if (p) demo.profiles.set(userId, { ...p, ...patch });
  },
  async toggleLike(video) {
    const v = demo.videos.find((x) => x.id === video.id);
    if (!v) return false;
    v.liked_by_me = !v.liked_by_me;
    v.like_count += v.liked_by_me ? 1 : -1;
    return v.liked_by_me;
  },
  async fetchComments(videoId) {
    return demo.comments.filter((c) => c.video_id === videoId);
  },
  async addComment(videoId, body) {
    const c: Comment = {
      id: Crypto.randomUUID(),
      video_id: videoId,
      author: authorOf(demo.profiles.get(DEMO_USER.id)!),
      body,
      created_at: new Date().toISOString(),
    };
    demo.comments.push(c);
    const v = demo.videos.find((x) => x.id === videoId);
    if (v) v.comment_count += 1;
    return c;
  },
  async report() {},
  async startCapture() {
    const s = { session_id: Crypto.randomUUID(), nonce: Crypto.randomUUID(), started_at: new Date().toISOString() };
    demo.openSessions.set(s.session_id, s);
    return s;
  },
  async publishCapture({ session, fileUri, durationMs, caption }) {
    if (!demo.openSessions.delete(session.session_id)) throw new Error('This recording was not made in the OnlyReal camera.');
    demo.videos.unshift({
      id: Crypto.randomUUID(),
      author_id: DEMO_USER.id,
      author: authorOf(demo.profiles.get(DEMO_USER.id)!),
      caption,
      video_url: fileUri,
      duration_ms: durationMs,
      provenance: 'captured_in_app',
      status: 'published',
      like_count: 0,
      comment_count: 0,
      liked_by_me: false,
      created_at: new Date().toISOString(),
    });
    return { status: 'published' };
  },
};

export const api: Api = hasBackend ? supabaseApi : demoApi;
