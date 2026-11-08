# OnlyReal

Short vertical videos made by people. **No AI-generated videos, no AI posts, no AI ads.**

OnlyReal is a mobile app (iOS and Android) built with Expo and React Native, with a Supabase backend.
Every post is filmed in the app's own camera and verified by the server before it goes live.
See [docs/REAL_CONTENT.md](docs/REAL_CONTENT.md) for how that works.

## What's in the MVP

- **Feed**: full-screen vertical videos that autoplay as you swipe, with a "Real · filmed in app" badge on every post.
- **Film**: the in-app camera (up to 60 s). There is intentionally no gallery upload.
- **Post**: preview, caption, then the clip is fingerprinted, uploaded and verified.
- **Profiles**: your posts, likes total, editable username, name and bio. Tap an avatar to open someone else's profile.
- **Likes and comments**.
- **Reports**: flag a clip as AI-generated, an AI ad, or filmed off a screen. Three flags pull it for review automatically.
- **Sign in** with a 6-digit email code (no passwords).

## Project layout

```
app/                    Expo app
  src/app/              screens (Expo Router)
  src/components/       UI pieces (VideoCard, RealBadge, ...)
  src/lib/              api, auth, Supabase client, theme
supabase/
  migrations/           database schema, row-level security, storage rules
  functions/publish-capture/   edge function that verifies and publishes clips
docs/REAL_CONTENT.md    how content is kept real, and what's next
```

## Try it in demo mode (no backend)

```bash
cd app
npm install
npx expo start
```

Scan the QR code with **Expo Go** on your phone and tap **Try the demo**. In demo mode your clips stay on the phone.

## Connect the real backend

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the schema and deploy the function with the [Supabase CLI](https://supabase.com/docs/guides/cli):
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   supabase functions deploy publish-capture
   ```
3. In Supabase, under Authentication > Email templates, make sure the sign-in email includes the `{{ .Token }}` code.
4. Copy `app/.env.example` to `app/.env` and fill in your project URL and anon key.
5. Restart `npx expo start`.

Optional: to add an AI-detection provider, set `AI_DETECTION_URL`, `AI_DETECTION_KEY` and `AI_HOLD_THRESHOLD` with `supabase secrets set`.

## Checks

```bash
cd app
npx tsc --noEmit
```
