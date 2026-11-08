# How OnlyReal keeps content real

OnlyReal's promise is simple: **every video was filmed by a person, and there are no AI-generated posts or AI ads.**
No single check can guarantee that, so we stack several, starting with the one that is hardest to fool.

## Layer 1: capture-only posting (in the MVP)

There is no "upload from gallery" button. The only way to post is the OnlyReal camera.

1. When you press record, the app calls `start_capture()`, and the server opens a **capture session** with a random nonce and a start time.
2. The clip is recorded by the in-app camera (max 60 s).
3. The phone computes a SHA-256 fingerprint and uploads the file. Storage only accepts the upload at `"<your id>/<open session id>.mp4"`.
4. The `publish-capture` edge function then checks that:
   - the session belongs to you, is unused, and is less than 15 minutes old (each session works once);
   - the clip is **not longer than the time since the session opened**, so a pre-made file can't be swapped in;
   - the file is a real MP4/MOV and its SHA-256 matches what the phone computed;
   - the exact same file has never been posted before.
5. Only the edge function (service role) can insert into `videos`. Clients have no insert policy at all.

Every published post shows a **"Real · filmed in app"** badge.

## Layer 2: people (in the MVP)

- Anyone can report a clip as *AI-generated*, *AI-made ad*, or *filmed off a screen*.
- When three different people flag a clip for those reasons, it is automatically pulled to `held_for_review` until a human moderator looks at it.

## Layer 3: AI detection (hook in the MVP, provider to pick)

`publish-capture` can send each new clip to an AI-video detection service. Set `AI_DETECTION_URL` (and `AI_DETECTION_KEY`) as function secrets; the service should answer `{ "score": 0..1 }`.
Clips scoring at or above `AI_HOLD_THRESHOLD` (default 0.7) are held for review instead of going live. Detection is a second opinion, never the only gate, because detectors miss things and have false positives.

## Known gaps and next steps

| Gap | Plan |
| --- | --- |
| A modified app could fake the capture flow | **Device attestation**: Apple App Attest and Google Play Integrity, bound to the capture nonce. Verified clips get the `attested` badge, and later we can require it. |
| Pointing the camera at a screen playing an AI video | Screen-recapture detection (moiré, refresh-rate flicker, frame edges), plus the *filmed off a screen* report reason. |
| Clips stay real only inside OnlyReal | Sign every clip with a **C2PA** manifest at capture, so other apps can verify it was filmed in OnlyReal. |
| Creators with pro cameras | Allow imports only when the file carries a valid C2PA manifest signed by a real camera maker (`c2pa_camera` badge). |
| AI-written captions or AI voice-overs | Caption and audio checks, and a clear community rule. |

## Ads

The MVP has no ads. When ads arrive, the rules are:

- Ads are short videos filmed by real people, submitted through the same capture or C2PA path, and reviewed by a human before they run.
- No AI-generated people, voices, footage or images in any ad.
- Every ad is clearly labelled as an ad.
