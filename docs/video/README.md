# Kutip videos

Everything is built with [Remotion](https://remotion.dev) in `video/` (its own package, not part of the pnpm workspace). Rendered MP4s land here in `out/` (gitignored). Scripts for the voice-over live in `docs/submission/` (Session 9).

| Composition | Length | Size | Output |
|---|---|---|---|
| `Hook` | 30 s | 1920×1080 | `out/hook-1920x1080.mp4` |
| `HookVertical` | 30 s | 1080×1920 | `out/hook-1080x1920.mp4` |
| `Pitch` | 2:00 | 1920×1080 | `out/pitch-1920x1080.mp4` |
| `Demo` | 1:58 | 1920×1080 | `out/demo-1920x1080.mp4` |
| `Solami` | 2:30 | 1920×1080 | `out/solami-1920x1080.mp4` |

All 30 fps, H.264. Every number on screen is from `docs/REHEARSAL.md` (29 Sep 2026 mainnet run) or the seeded demo data in `docs/screenshots/v2`; wire costs are labelled "est.".

## Quick start

```bash
cd video
pnpm install          # once
pnpm sync             # copy your clips/audio/captions into video/public and refresh the manifest
pnpm dev              # Remotion Studio: scrub every composition, edit timings live
pnpm render:all       # or render:hook, render:hook-vertical, render:pitch, render:demo, render:solami
pnpm stills           # hook key frames → docs/video/stills/
```

Until a file is provided, its slot renders a slate naming the missing file, so every timeline renders at any time.

## Files I still need from you

Put them here, then run `pnpm sync` in `video/`.

| File | Used by | Notes |
|---|---|---|
| `docs/video/music.mp3` | all | 120–128 BPM. The hook is cut at **124 BPM**; set `BPM` (and `OFFSET_FRAMES` if the track starts late) in `video/src/lib/beat.ts` to match yours. Music loops and fades out over the last 1.5 s. |
| `docs/video/vo-pitch.mp3` | Pitch | Starts at 0:00. Music ducks to 30% under it. |
| `docs/video/vo-demo.mp3` | Demo | Starts at 0:00. |
| `docs/video/vo-solami.mp3` | Solami | Starts at 0:00. |
| `docs/video/captions/pitch.srt` (or `.json`) | Pitch | Burned-in subtitles. `.json` is `Caption[]` from `@remotion/captions`. |
| `docs/video/captions/demo.srt` | Demo | Without it, the shot-list captions in `video/src/demo/Demo.tsx` are burned in. |
| `docs/video/captions/solami.srt` | Solami | Same fallback. |
| `docs/video/clips/D1-dashboard.mp4` … `D11-treasury.mp4` | Pitch, Demo, Solami | Recorded by `pnpm record` (below). |
| `docs/video/clips/P1-phone-pay.mp4` | Pitch, Demo | Your phone screen recording: Confirm and pay → Phantom approves. Portrait, any resolution; shown in a phone frame. |
| `docs/video/clips/P2-phone-message.mp4` | Demo | Phone: typing the buyer question on the pay page, reply arriving. |
| `docs/video/clips/x402-bot.log` | Pitch, Demo | `tee` of the bot's terminal output (the recorder prints the exact command). |
| `docs/video/clips/worker-stream.log` | Solami | `fly logs -a kutip-worker --no-tail \| tail -80 > docs/video/clips/worker-stream.log` right after the D4 payment. |
| `docs/video/clips/worker-catchup.log` | Solami | Logs from a worker restart showing the `Catch-up … found over RPC` lines. |
| `docs/video/clips/D10-catchup.mp4` | Solami | Optional: the invoice page after the restart. |
| `docs/video/refs/*` | — | Reference video and screenshots for pacing; read, never rendered. |

Team names for the pitch's team card: pass `members` to `TeamCard` in `video/src/pitch/Pitch.tsx` (from `docs/submission/PITCH-VIDEO.md` when it exists).

## Recording the dashboard side

```bash
# 1. Reset the demo data and note the two invoice ids it prints (REHEARSAL.md P6)
APP_URL=https://kutip-app.vercel.app pnpm --filter @kutip/scripts exec tsx demo-reset.ts --warm <phantom>,<bot> --cashout <solflare> --yes

# 2. Record, one shot at a time
cd video
pnpm record --inv154 inv_… --inv155 inv_…           # all shots
pnpm record --inv154 inv_… --inv155 inv_… --only D4-live-flip,D5-agent-activity
```

The recorder launches your installed Google Chrome at 1920×1080 with a persistent profile (`video/.pw-profile`), so the passkey sign-in works and sticks. It never signs in, pays, approves or sends: it prints what to do, waits for Enter, and asks before any shot that moves money or writes production data. Each shot becomes `docs/video/clips/<id>.mp4` (30 fps H.264, converted from Playwright's WebM with Remotion's bundled ffmpeg). A violet dot follows your mouse in the recording, since Playwright does not capture the pointer.

Shots, in order: D1 Overview · D2 New invoice (PDF) · D3 Overdue invoice + Rulebook · **D4 Live flip** (pay from the phone; the script waits for "Settled") · D4b Receipt · D5 Agent activity · **D6 Inbox** (message from the phone, approve the draft) · **D7 x402** (run the bot in a terminal) · **D8 Command bar** (Sweep now is optional) · **D9 Cash out** (0.25 USDC, Touch ID) · D11 Treasury. Bold = you act; the script only records.

Phone: screen-record in iOS Control Centre at the same time as D4 and D6, AirDrop the files, rename to `P1-phone-pay.mp4` / `P2-phone-message.mp4`.

If Chrome's passkey picker does not show iCloud Keychain, use the email sign-in step with the OTP instead; the profile keeps the session afterwards.

## Swapping things

- **Music:** replace `docs/video/music.mp3`, set `BPM`/`OFFSET_FRAMES` in `video/src/lib/beat.ts`, `pnpm sync`, re-render the hook. Scene cuts are expressed in beats (`HOOK` in the same file), so they follow the tempo.
- **Hook music:** the hook has its own bed, `music-hook.wav`, synthesized on its beat grid by `pnpm music` (`video/scripts/make-music.ts`, which also runs `pnpm sync`). It is gitignored like all audio, so run `pnpm music` once before rendering the hook. To use a real track, save it as `docs/video/music-hook.mp3`, delete the `.wav`, and run `pnpm sync`. The `music` slot used by pitch, demo and Solami is separate.
- **Sound effects (hook):** synthesized by `pnpm sfx` (`video/scripts/make-sfx.ts`) into `video/public/sfx/`, nothing to license. Cues and volumes live in `video/src/hook/Sfx.tsx`, tied to the `HOOK` beats and the flip card's real Paid/Settled timings.
- **Voice-over:** replace the `vo-*.mp3`, `pnpm sync`, re-render that timeline. Ducking follows the file's length automatically.
- **Timings:** `PITCH` (`video/src/pitch/Pitch.tsx`), `DEMO_SHOTS` (`video/src/demo/Demo.tsx`), `SOLAMI` (`video/src/solami/Solami.tsx`) hold every segment start in seconds. Pitch and demo are capped at 2:00; the composition length follows the constants.
- **Captions:** `.srt` or `Caption[]` JSON per timeline in `docs/video/captions/`. Style lives in `video/src/kit/Captions.tsx`.
- **Proof cards:** `video/src/data/proof.ts` holds the signatures, timings and demo figures. Add a new rehearsal there, nowhere else.

## Kit (reusable compositions, `video/src/kit`)

`TitleCard` · `LowerThird` · `CaptionTrack` / `SrtCaptions` · `MarkStinger` and `discWipe` (section transitions) · `ProofCard` (signature, Solscan URL, timing) · `WhySolanaCard` · `TrustCard` · `GtmCard` · `TeamCard` · `EndCard` · `ClipSlot` / `VoiceOver` / `Music` (slots with slates) · `LogTerminal` / `CommandTerminal`. Recreated product UI with the real tokens is in `video/src/ui` (pay page with a real QR, stepper, treasury card, flip card, agent row with the Touch ID prompt, phone and browser frames). Preview each under the "Kit" folder in Studio.
