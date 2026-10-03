import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "../../theme/tokens";
import { FONT } from "../../theme/fonts";
import { beat, HOOK } from "../../lib/beat";
import { EASE_EXPO, useLayout } from "../../lib/anim";
import { AgentRow } from "../../ui/AgentRow";
import { TreasuryCard } from "../../ui/TreasuryCard";
import { Line } from "./shared";

/** "An AI agent chases the rest, and asks you before it moves a cent." Treasury card, the proposal, Touch ID. */
export const S8Agent: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, gutter, k, portrait } = useLayout();
  const tAsks = beat(HOOK.s8Asks - HOOK.s8Agent);
  const tTouch = beat(HOOK.s8Touch - HOOK.s8Agent);
  const inA = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_EXPO });
  const inB = interpolate(frame, [tAsks, tAsks + 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_EXPO });
  const s = (portrait ? 1.35 : 1.5) * k;
  const cardW = 380 * s;
  const rowW = 560 * s;
  const colLeft = portrait ? (width - rowW) / 2 : width - gutter - rowW;
  return (
    <AbsoluteFill style={{ background: C.paper, fontFamily: FONT }}>
      <div style={{ position: "absolute", left: gutter, top: portrait ? gutter + 40 : 120, width: portrait ? width - gutter * 2 : width * 0.44, display: "grid", gap: 18 * k }}>
        <Line from={0} size={portrait ? 76 : 88}>An AI agent chases the rest,</Line>
        <Line from={tAsks} size={portrait ? 76 : 88} color={C.ink}>
          and asks you <span style={{ color: C.accent }}>before it moves a cent.</span>
        </Line>
      </div>
      <div style={{ position: "absolute", left: portrait ? (width - cardW) / 2 : width - gutter - cardW, top: portrait ? height * 0.4 : height * 0.1, opacity: inA, translate: `0px ${(1 - inA) * 60}px` }}>
        <TreasuryCard scale={s} width={cardW} meterFrom={8} meterValue={0.0} showBalance={false} />
      </div>
      <div style={{ position: "absolute", left: colLeft, top: portrait ? height * 0.68 : height * 0.56, opacity: inB, translate: `0px ${(1 - inB) * 60}px` }}>
        <AgentRow scale={s * 0.78} width={rowW} touchAt={tTouch} />
      </div>
    </AbsoluteFill>
  );
};
