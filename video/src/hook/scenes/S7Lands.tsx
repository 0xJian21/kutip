import type React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C } from "../../theme/tokens";
import { FONT } from "../../theme/fonts";
import { beat, HOOK } from "../../lib/beat";
import { useLayout } from "../../lib/anim";
import { Caption, Line } from "./shared";
import { TIMINGS } from "../../data/proof";

/** "Exact USD lands on Solana. Paid in 0.15 seconds." The flip card itself is a persistent layer in Hook.tsx. */
export const S7Lands: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, gutter, k, portrait } = useLayout();
  const tPaid = beat(HOOK.s7Paid - HOOK.s7Lands);
  void frame;
  return (
    <AbsoluteFill style={{ background: C.paper, fontFamily: FONT }}>
      <div style={{ position: "absolute", left: gutter, top: portrait ? gutter + 60 : height * 0.3, width: portrait ? width - gutter * 2 : width * 0.5, display: "grid", gap: 18 * k }}>
        <Line from={0} size={portrait ? 84 : 100}>Exact USD lands on Solana.</Line>
        <Line from={tPaid} size={portrait ? 84 : 100}>
          Paid in <span style={{ color: C.accent }}>{(TIMINGS.seenToPaidMs / 1000).toFixed(2)} seconds.</span>
        </Line>
        <Caption from={tPaid + 10}>Seen → Paid, measured on Solana mainnet, 29 Sep 2026. Settled 7.86 s later.</Caption>
      </div>
    </AbsoluteFill>
  );
};
