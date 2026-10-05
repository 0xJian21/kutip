import type React from "react";
import { Sequence, staticFile } from "remotion";
import { Audio } from "@remotion/media";
import { beat, HOOK } from "../lib/beat";
import { DEMO, TIMINGS } from "../data/proof";

/** Files from `pnpm sfx` (scripts/make-sfx.ts), with their length in frames. */
const SFX = { tick: 2, clock: 6, whoosh: 15, thud: 14, riser: 48, impact: 48, pop: 5, scan: 8, paid: 42, settled: 54, touch: 12 } as const;
type Sfx = keyof typeof SFX;

/** Whooshes peak half-way through, so they start this many frames before the cut they mark. */
const LEAD = 7;
const seenAt = beat(HOOK.s7Seen);

/** [frame, sound, volume]. Every cue sits on a scene's own timing so it follows the beat grid. */
const CUES: Array<[number, Sfx, number]> = [
  // 1 Muar → Sydney
  ...[0, 1, 2.5, 4].map((b): [number, Sfx, number] => [beat(b), "tick", 0.35]),
  [beat(2.5), "whoosh", 0.25],
  // 2 The waiting: one tock per day of the wire
  [beat(HOOK.s2Waiting) - LEAD, "whoosh", 0.4],
  [beat(HOOK.s2Waiting), "tick", 0.35],
  ...[1, 2, 3].map((d): [number, Sfx, number] => [beat(HOOK.s2Waiting + 1 + d), "clock", 0.5]),
  // 3 Days, fees, spreadsheet
  [beat(HOOK.s3Days), "thud", 0.45],
  [beat(HOOK.s3Fees) - LEAD, "whoosh", 0.35],
  [beat(HOOK.s3Fees), "thud", 0.45],
  [beat(HOOK.s3Sheet) - LEAD, "whoosh", 0.35],
  [beat(HOOK.s3Sheet), "tick", 0.35],
  ...DEMO.overdue.map((_, i): [number, Sfx, number] => [beat(HOOK.s3Sheet) + 8 + i * 4, "tick", 0.2]),
  // 4 What if… → the colour shift
  [beat(HOOK.s4WhatIf), "tick", 0.35],
  [beat(HOOK.s4Shift) - SFX.riser, "riser", 0.55],
  [beat(HOOK.s4Shift), "impact", 0.6],
  // 5 Kutip.
  [beat(HOOK.s5Kutip), "pop", 0.4],
  [beat(HOOK.s5Kutip) + 2, "whoosh", 0.3],
  // 6 Scan, any wallet, zero gas
  [beat(HOOK.s6Phone) - 4, "whoosh", 0.35],
  [beat(HOOK.s6Phone), "tick", 0.35],
  [beat(HOOK.s6Phone) + 14, "scan", 0.45],
  [beat(HOOK.s6Wallet), "tick", 0.35],
  [beat(HOOK.s6Gas), "pop", 0.35],
  // 7 Lands: the flip card at its measured mainnet timings
  [beat(HOOK.s7Lands) - 4, "whoosh", 0.35],
  [beat(HOOK.s7Lands), "tick", 0.35],
  [seenAt, "tick", 0.3],
  [seenAt + Math.round((TIMINGS.seenToPaidMs / 1000) * 30), "paid", 0.7],
  [beat(HOOK.s7Paid), "tick", 0.35],
  // 8 Agent asks first; Settled lands here, 7.86 s after Seen
  [beat(HOOK.s8Agent) - LEAD, "whoosh", 0.4],
  [beat(HOOK.s8Asks) - 4, "whoosh", 0.25],
  [beat(HOOK.s8Asks), "tick", 0.35],
  [beat(HOOK.s8Touch), "touch", 0.7],
  [seenAt + Math.round((TIMINGS.seenToSettledMs / 1000) * 30), "settled", 0.75],
  // 9 End card
  [beat(HOOK.s9End) - LEAD, "whoosh", 0.4],
  [beat(HOOK.s9End), "pop", 0.4],
  ...[HOOK.s9Tagline, HOOK.s9Url, HOOK.s9Malaysia].map((b): [number, Sfx, number] => [beat(b), "tick", 0.3]),
];

export const HookSfx: React.FC = () => (
  <>
    {CUES.map(([from, name, volume], i) => (
      <Sequence key={i} name={`sfx ${name}`} from={from} durationInFrames={SFX[name]} layout="none">
        <Audio src={staticFile(`sfx/${name}.wav`)} volume={volume} />
      </Sequence>
    ))}
  </>
);
