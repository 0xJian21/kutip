import type React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { beat, HOOK } from "../lib/beat";
import { FONT } from "../theme/fonts";
import { C } from "../theme/tokens";
import { EASE, useLayout } from "../lib/anim";
import { FlipCard } from "../ui/FlipCard";
import { EndCard } from "../kit/EndCard";
import { S1Muar } from "./scenes/S1Muar";
import { S2Waiting } from "./scenes/S2Waiting";
import { S3Cost } from "./scenes/S3Cost";
import { S4Shift } from "./scenes/S4Shift";
import { S5Kutip } from "./scenes/S5Kutip";
import { S6Phone } from "./scenes/S6Phone";
import { S7Lands } from "./scenes/S7Lands";
import { S8Agent } from "./scenes/S8Agent";

/**
 * The 30-second hook. Every scene starts on a beat (lib/beat.ts HOOK); the flip card is a
 * persistent layer from beat 38 to 56 so Settled can land at its real +7.86 s.
 * Renders at 1920×1080 and 1080×1920 from the same scenes (useLayout().portrait).
 */
export const Hook: React.FC = () => {
  const { fps } = useLayout();
  const dur = (from: keyof typeof HOOK, to: keyof typeof HOOK) => beat(HOOK[to]) - beat(HOOK[from]);
  return (
    <AbsoluteFill style={{ background: C.paper, fontFamily: FONT, color: C.ink }}>
      <Sequence name="1 Muar → Sydney" from={beat(HOOK.s1Muar)} durationInFrames={dur("s1Muar", "s2Waiting")} premountFor={fps}>
        <S1Muar />
      </Sequence>
      <Sequence name="2 The waiting" from={beat(HOOK.s2Waiting)} durationInFrames={dur("s2Waiting", "s3Days")} premountFor={fps}>
        <S2Waiting />
      </Sequence>
      <Sequence name="3 Days, fees, spreadsheet" from={beat(HOOK.s3Days)} durationInFrames={dur("s3Days", "s4WhatIf")} premountFor={fps}>
        <S3Cost />
      </Sequence>
      <Sequence name="4 What if… (colour shift)" from={beat(HOOK.s4WhatIf)} durationInFrames={dur("s4WhatIf", "s5Kutip")} premountFor={fps}>
        <S4Shift />
      </Sequence>
      <Sequence name="5 Kutip." from={beat(HOOK.s5Kutip)} durationInFrames={dur("s5Kutip", "s6Phone")} premountFor={fps}>
        <S5Kutip />
      </Sequence>
      <Sequence name="6 Scan, any wallet, zero gas" from={beat(HOOK.s6Phone)} durationInFrames={dur("s6Phone", "s7Lands")} premountFor={fps}>
        <S6Phone />
      </Sequence>
      <Sequence name="7 Lands in 0.15 s" from={beat(HOOK.s7Lands)} durationInFrames={dur("s7Lands", "s8Agent")} premountFor={fps}>
        <S7Lands />
      </Sequence>
      <Sequence name="8 Agent asks first" from={beat(HOOK.s8Agent)} durationInFrames={dur("s8Agent", "s9End")} premountFor={fps}>
        <S8Agent />
      </Sequence>
      <Sequence name="Flip card (persistent)" from={beat(HOOK.s7Lands)} durationInFrames={dur("s7Lands", "s9End")} premountFor={fps}>
        <FlipLayer />
      </Sequence>
      <Sequence name="9 End card" from={beat(HOOK.s9End)} durationInFrames={dur("s9End", "end")} premountFor={fps}>
        <EndCard markAt={0} taglineAt={beat(HOOK.s9Tagline) - beat(HOOK.s9End)} urlAt={beat(HOOK.s9Url) - beat(HOOK.s9End)} footerAt={beat(HOOK.s9Malaysia) - beat(HOOK.s9End)} />
      </Sequence>
    </AbsoluteFill>
  );
};

/** The flip card: large on the right during scene 7, then travels to the bottom-left corner for scene 8. */
const FlipLayer: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, gutter, k, portrait } = useLayout();
  const move = beat(HOOK.s8Agent) - beat(HOOK.s7Lands);
  const p = interpolate(frame, [move - 6, move + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  const enter = interpolate(frame, [0, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  const bigScale = (portrait ? 2.6 : 2.4) * k;
  const smallScale = (portrait ? 1.5 : 1.3) * k;
  const scale = bigScale + (smallScale - bigScale) * p;
  const w = 256 * scale;
  const bigLeft = portrait ? (width - w) / 2 : width - gutter - w - 40;
  const bigTop = portrait ? height * 0.5 : (height - 300 * bigScale) / 2 + 40;
  const smallLeft = portrait ? (width - w) / 2 : gutter;
  const smallTop = portrait ? height * 0.2 : height - 300 * smallScale - 72;
  const left = bigLeft + (smallLeft - bigLeft) * p;
  const top = bigTop + (smallTop - bigTop) * p + (1 - enter) * 80;
  const seenAt = beat(HOOK.s7Seen) - beat(HOOK.s7Lands);
  return (
    <div style={{ position: "absolute", left, top, opacity: enter }}>
      <FlipCard seenAt={seenAt} scale={scale} />
    </div>
  );
};
