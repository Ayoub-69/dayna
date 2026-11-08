// Verifies a clip filmed in the OnlyReal camera and publishes it.
//
// Checks, in order:
//  1. The caller owns an unused capture session that opened less than 15 minutes ago.
//  2. The clip is not longer than the time since the session opened (you cannot post a
//     60 second clip from a session that started 5 seconds ago, so a pre-made file can't be swapped in).
//  3. The uploaded file is a real MP4/MOV container and its SHA-256 matches what the phone computed.
//  4. The same file has never been posted before.
//  5. Optional: an external AI-detection service scores the clip; high scores are held for review.
import { createClient } from 'npm:@supabase/supabase-js@2';

const SESSION_MAX_AGE_MS = 15 * 60 * 1000;
const CLOCK_SLACK_MS = 3000;
const MIN_DURATION_MS = 2000;
const MAX_DURATION_MS = 61000;
const MAX_BYTES = 200 * 1024 * 1024;
const AI_HOLD_THRESHOLD = Number(Deno.env.get('AI_HOLD_THRESHOLD') ?? '0.7');

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function looksLikeMp4(bytes: Uint8Array) {
  // ISO base media files have "ftyp" at offset 4.
  return bytes.length > 12 && new TextDecoder().decode(bytes.subarray(4, 8)) === 'ftyp';
}

/** Optional hook for a third-party AI-video detector. Returns a 0..1 "AI-made" score or null. */
async function aiScore(signedUrl: string): Promise<number | null> {
  const endpoint = Deno.env.get('AI_DETECTION_URL');
  if (!endpoint) return null;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('AI_DETECTION_KEY') ?? ''}` },
      body: JSON.stringify({ url: signedUrl }),
    });
    if (!res.ok) throw new Error(`detector returned ${res.status}`);
    const { score } = await res.json();
    return typeof score === 'number' ? score : null;
  } catch (e) {
    console.error('AI detection failed, continuing without a score', e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'POST only' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: auth } = await userClient.auth.getUser();
  if (!auth.user) return reply(401, { error: 'Please sign in.' });
  const uid = auth.user.id;

  let input: { session_id?: string; nonce?: string; sha256?: string; duration_ms?: number; caption?: string };
  try {
    input = await req.json();
  } catch {
    return reply(400, { error: 'Bad request.' });
  }
  const { session_id, nonce, sha256, duration_ms } = input;
  const caption = String(input.caption ?? '').slice(0, 300);
  if (!session_id || !nonce || !sha256 || typeof duration_ms !== 'number') return reply(400, { error: 'Missing fields.' });
  if (duration_ms < MIN_DURATION_MS || duration_ms > MAX_DURATION_MS) return reply(400, { error: 'Clip length is out of range.' });

  const admin = createClient(url, service);
  const path = `${uid}/${session_id}.mp4`;
  const reject = async (status: number, error: string) => {
    await admin.storage.from('videos').remove([path]);
    return reply(status, { error });
  };

  // 1 + 2: capture session checks. Claim it atomically so it can't be used twice.
  const { data: session } = await admin
    .from('capture_sessions')
    .update({ used_at: new Date().toISOString() })
    .eq('id', session_id)
    .eq('user_id', uid)
    .eq('nonce', nonce)
    .is('used_at', null)
    .select('started_at')
    .maybeSingle();
  if (!session) return reject(403, 'This clip was not filmed in an OnlyReal capture session.');

  const sinceStart = Date.now() - new Date(session.started_at).getTime();
  if (sinceStart > SESSION_MAX_AGE_MS) return reject(403, 'This recording session expired. Please film it again.');
  if (duration_ms > sinceStart + CLOCK_SLACK_MS) return reject(403, 'Clip is longer than the recording session.');

  // 3: file integrity.
  const { data: blob, error: dlErr } = await admin.storage.from('videos').download(path);
  if (dlErr || !blob) return reply(400, { error: 'Upload not found.' });
  if (blob.size > MAX_BYTES) return reject(413, 'Clip is too large.');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (!looksLikeMp4(bytes)) return reject(400, 'Unsupported file.');
  const serverHash = await sha256Hex(bytes);
  if (serverHash !== sha256.toLowerCase()) return reject(400, 'The uploaded file does not match the recording.');

  // 4: duplicates.
  const { data: dupe } = await admin.from('videos').select('id').eq('sha256', serverHash).maybeSingle();
  if (dupe) return reject(409, 'This clip has already been posted.');

  // 5: optional AI detection.
  const { data: signed } = await admin.storage.from('videos').createSignedUrl(path, 600);
  const score = signed ? await aiScore(signed.signedUrl) : null;
  const status = score !== null && score >= AI_HOLD_THRESHOLD ? 'held_for_review' : 'published';

  const { data: video, error: insErr } = await admin
    .from('videos')
    .insert({
      author_id: uid,
      capture_session_id: session_id,
      storage_path: path,
      sha256: serverHash,
      duration_ms: Math.round(duration_ms),
      caption,
      provenance: 'captured_in_app',
      status,
      ai_score: score,
    })
    .select('id, status')
    .single();
  if (insErr) return reject(500, insErr.message);

  return reply(200, video);
});
