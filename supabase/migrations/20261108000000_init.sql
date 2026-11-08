-- OnlyReal initial schema.
-- Core rule: clients can never insert into `videos` directly. Every post goes through
-- start_capture() -> camera -> storage upload -> the publish-capture edge function,
-- which verifies the clip and inserts the row with the service role.

create extension if not exists pgcrypto;

create type public.provenance_level as enum ('captured_in_app', 'attested', 'c2pa_camera');
create type public.video_status as enum ('published', 'held_for_review', 'removed');
create type public.report_reason as enum ('ai_generated', 'ai_ad', 'not_original', 'spam', 'harmful', 'other');

-- ------------------------------------------------------------------ profiles

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_.]{3,24}$'),
  display_name text check (char_length(display_name) <= 40),
  bio text check (char_length(bio) <= 160),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "profiles are public" on public.profiles for select using (true);
create policy "users edit their own profile" on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (new.id, 'user_' || substr(replace(new.id::text, '-', ''), 1, 10));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------ capture sessions

-- Opened by the app the moment the user presses record. A clip can only be published
-- against an unused session, and only if it is no longer than the time since the session opened.
create table public.capture_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  nonce text not null default encode(gen_random_bytes(16), 'hex'),
  started_at timestamptz not null default now(),
  used_at timestamptz
);
create index capture_sessions_user_started on public.capture_sessions (user_id, started_at desc);

alter table public.capture_sessions enable row level security;
-- No client policies: only start_capture() and the edge function touch this table.

create function public.start_capture()
returns table (session_id uuid, nonce text, started_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  if (select count(*) from capture_sessions cs
      where cs.user_id = uid and cs.started_at > now() - interval '1 hour') >= 60 then
    raise exception 'too many recordings, try again later';
  end if;
  return query
    insert into capture_sessions (user_id) values (uid)
    returning capture_sessions.id, capture_sessions.nonce, capture_sessions.started_at;
end;
$$;

revoke all on function public.start_capture() from public, anon;
grant execute on function public.start_capture() to authenticated;

-- ------------------------------------------------------------------ videos

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  capture_session_id uuid unique references public.capture_sessions (id),
  storage_path text not null unique,
  sha256 text not null unique, -- the same file can never be posted twice
  duration_ms integer not null check (duration_ms between 1000 and 61000),
  caption text not null default '' check (char_length(caption) <= 300),
  provenance public.provenance_level not null,
  status public.video_status not null default 'published',
  ai_score real, -- from the optional AI-detection provider, 0..1
  like_count integer not null default 0,
  comment_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index videos_feed on public.videos (created_at desc) where status = 'published';
create index videos_author on public.videos (author_id, created_at desc);

alter table public.videos enable row level security;
create policy "published videos are public, authors see their own"
  on public.videos for select using (status = 'published' or author_id = auth.uid());
create policy "authors can delete their videos"
  on public.videos for delete using (author_id = auth.uid());
-- Intentionally no insert/update policies for clients.

-- ------------------------------------------------------------------ likes

create table public.likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

alter table public.likes enable row level security;
create policy "likes are public" on public.likes for select using (true);
create policy "users like as themselves" on public.likes for insert
  with check (user_id = auth.uid()
    and exists (select 1 from public.videos v where v.id = video_id and v.status = 'published'));
create policy "users unlike as themselves" on public.likes for delete using (user_id = auth.uid());

-- ------------------------------------------------------------------ comments

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index comments_video on public.comments (video_id, created_at);

alter table public.comments enable row level security;
create policy "comments on visible videos are public" on public.comments for select
  using (exists (select 1 from public.videos v where v.id = video_id));
create policy "users comment as themselves" on public.comments for insert
  with check (author_id = auth.uid()
    and exists (select 1 from public.videos v where v.id = video_id and v.status = 'published'));
create policy "users delete their comments" on public.comments for delete using (author_id = auth.uid());

-- ------------------------------------------------------------------ reports

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason public.report_reason not null,
  details text check (char_length(details) <= 500),
  created_at timestamptz not null default now(),
  unique (video_id, reporter_id)
);

alter table public.reports enable row level security;
create policy "users see their own reports" on public.reports for select using (reporter_id = auth.uid());
create policy "users report as themselves" on public.reports for insert with check (reporter_id = auth.uid());
create policy "users update their own report" on public.reports for update
  using (reporter_id = auth.uid()) with check (reporter_id = auth.uid());

-- ------------------------------------------------------------------ counters and auto-review

create function public.bump_like_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update videos set like_count = like_count + 1 where id = new.video_id;
  else
    update videos set like_count = greatest(like_count - 1, 0) where id = old.video_id;
  end if;
  return null;
end;
$$;
create trigger likes_count after insert or delete on public.likes
  for each row execute function public.bump_like_count();

create function public.bump_comment_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update videos set comment_count = comment_count + 1 where id = new.video_id;
  else
    update videos set comment_count = greatest(comment_count - 1, 0) where id = old.video_id;
  end if;
  return null;
end;
$$;
create trigger comments_count after insert or delete on public.comments
  for each row execute function public.bump_comment_count();

-- Three different people flagging a clip as AI-made / not original pulls it for human review.
create function public.auto_hold_reported() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.reason in ('ai_generated', 'ai_ad', 'not_original') and
     (select count(distinct reporter_id) from reports
       where video_id = new.video_id and reason in ('ai_generated', 'ai_ad', 'not_original')) >= 3 then
    update videos set status = 'held_for_review' where id = new.video_id and status = 'published';
  end if;
  return null;
end;
$$;
create trigger reports_auto_hold after insert or update on public.reports
  for each row execute function public.auto_hold_reported();

-- ------------------------------------------------------------------ storage

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', false, 209715200, array['video/mp4', 'video/quicktime']);

-- Upload path must be "<uid>/<open capture session id>.mp4".
-- capture_sessions has no client policies, so the check runs as a security definer function.
create function public.is_open_capture_path(object_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from capture_sessions cs
    where cs.user_id = auth.uid()
      and cs.used_at is null
      and cs.started_at > now() - interval '15 minutes'
      and object_name = auth.uid()::text || '/' || cs.id::text || '.mp4'
  );
$$;
revoke all on function public.is_open_capture_path(text) from public, anon;
grant execute on function public.is_open_capture_path(text) to authenticated;

create policy "upload only into an open capture session" on storage.objects for insert to authenticated
  with check (bucket_id = 'videos' and public.is_open_capture_path(name));

create policy "watch videos you are allowed to see" on storage.objects for select
  using (
    bucket_id = 'videos'
    and exists (
      select 1 from public.videos v
      where v.storage_path = name and (v.status = 'published' or v.author_id = auth.uid())
    )
  );
