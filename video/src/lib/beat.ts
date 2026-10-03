/**
 * The beat grid. Every cut in the hook sits on a beat so the music can be swapped
 * for any track at the same tempo: change BPM (and, if the track starts late, OFFSET_FRAMES).
 */
export const FPS = 30;
export const BPM = 124;
/** Frames before the first downbeat of the music file (0 if the track starts on the beat). */
export const OFFSET_FRAMES = 0;
export const BEAT_FRAMES = (FPS * 60) / BPM; // 14.516 at 124 BPM

/** Frame of beat `n` (fractional beats allowed). */
export const beat = (n: number) => OFFSET_FRAMES + Math.round(n * BEAT_FRAMES);
/** Frame count of `n` beats. */
export const beats = (n: number) => Math.round(n * BEAT_FRAMES);
export const sec = (s: number) => Math.round(s * FPS);

/**
 * Hook timeline, in beats. 62 beats at 124 BPM = 30.0 s.
 * The flip card's Seen → Paid → Settled uses the measured mainnet gaps (REHEARSAL.md, 29 Sep 2026):
 * Paid 153 ms after Seen, Settled 7.86 s after Seen. Those are seconds, not beats, on purpose.
 */
export const HOOK = {
  s1Muar: 0,
  s2Waiting: 7,
  s3Days: 11,
  s3Fees: 15,
  s3Sheet: 18.5,
  s4WhatIf: 22,
  s4Shift: 25,
  s5Kutip: 29,
  s6Phone: 31,
  s6Wallet: 33.5,
  s6Gas: 36,
  s7Lands: 38,
  s7Seen: 38.5,
  s7Paid: 40.5,
  s8Agent: 45,
  s8Asks: 48,
  s8Touch: 51,
  s9End: 56,
  s9Tagline: 57,
  s9Url: 58,
  s9Malaysia: 59.5,
  end: 62,
} as const;

export const HOOK_FRAMES = beat(HOOK.end); // 900 at 124 BPM

/** 0..1 pulse that fires on every beat and decays over `decayBeats`. For subtle scale punches. */
export function beatPulse(frame: number, decayBeats = 0.5): number {
  const local = ((frame - OFFSET_FRAMES) % BEAT_FRAMES) / BEAT_FRAMES; // 0 at the beat
  const t = local / decayBeats;
  return t >= 1 ? 0 : 1 - t;
}
