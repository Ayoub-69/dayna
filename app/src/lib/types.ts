export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  created_at: string;
};

/**
 * How we know a post is real.
 * - captured_in_app: filmed with the OnlyReal camera, hash verified by the server.
 * - attested: captured_in_app + a valid device attestation (App Attest / Play Integrity).
 * - c2pa_camera: imported clip whose C2PA manifest was signed by a real camera.
 */
export type ProvenanceLevel = 'captured_in_app' | 'attested' | 'c2pa_camera';

export type VideoStatus = 'published' | 'held_for_review' | 'removed';

export type Video = {
  id: string;
  author_id: string;
  author: Pick<Profile, 'id' | 'username' | 'display_name'>;
  caption: string;
  video_url: string;
  duration_ms: number;
  provenance: ProvenanceLevel;
  status: VideoStatus;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  created_at: string;
};

export type Comment = {
  id: string;
  video_id: string;
  author: Pick<Profile, 'id' | 'username' | 'display_name'>;
  body: string;
  created_at: string;
};

export type ReportReason = 'ai_generated' | 'ai_ad' | 'not_original' | 'spam' | 'harmful' | 'other';

export type CaptureSession = {
  session_id: string;
  nonce: string;
  started_at: string;
};
