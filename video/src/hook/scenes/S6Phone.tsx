import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "../../theme/tokens";
import { FONT } from "../../theme/fonts";
import { beat, HOOK } from "../../lib/beat";
import { EASE, EASE_EXPO, riseIn, useLayout } from "../../lib/anim";
import { PhoneFrame } from "../../ui/Device";
import { PayPage } from "../../ui/PayPage";
import { Chip } from "../../ui/Pills";
import { Line } from "./shared";

/** "The buyer scans. Pays from any wallet. Zero gas." The real pay page, camera pushing in on the QR. */
export const S6Phone: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, gutter, k, portrait } = useLayout();
  const tWallet = beat(HOOK.s6Wallet - HOOK.s6Phone);
  const tGas = beat(HOOK.s6Gas - HOOK.s6Phone);
  const enter = interpolate(frame, [0, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_EXPO });
  // Camera: push in on the QR between "any wallet" and the end of the scene.
  const push = interpolate(frame, [tWallet, beat(7)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  // The whole phone stays in frame at full push: landscape 824 × 1.08 → 1.21 = 997 px of 1080;
  // portrait 824 × 1.25 × 0.82 → ×1.2 = 1014 px under the text block.
  const phoneScale = (portrait ? 1.25 : 1.08) * k;
  const scale = phoneScale * (1 + push * (portrait ? 0.2 : 0.12));
  const phoneW = 387 * scale, phoneH = 824 * scale;
  // Landscape: phone on the right, text left. Portrait: text on top, phone below.
  const left = portrait ? (width - phoneW) / 2 : width - gutter - phoneW;
  const top = portrait ? height * 0.38 + (1 - enter) * 200 - push * 100 : (height - phoneH) / 2 + (1 - enter) * 200;
  const text = (
    <div style={{ position: "absolute", left: gutter, top: portrait ? gutter + 60 : height * 0.26, width: portrait ? width - gutter * 2 : width * 0.44, display: "grid", gap: 14 * k }}>
      <Line from={0} size={portrait ? 80 : 92}>The buyer scans.</Line>
      <Line from={tWallet} size={portrait ? 80 : 92} color={C.ink}>Pays from any wallet.</Line>
      <div style={{ ...riseIn(frame, tWallet + 6, 14), display: "flex", gap: 10 * k, flexWrap: "wrap" }}>
        <Chip scale={1.8 * k}>Phantom</Chip>
        <Chip scale={1.8 * k}>any Solana wallet</Chip>
      </div>
      <Line from={tGas} size={portrait ? 80 : 92} color={C.accent}>Zero gas.</Line>
      <div style={{ ...riseIn(frame, tGas + 6, 14), display: "flex", gap: 10 * k }}>
        <Chip tone="accent" scale={1.8 * k}>Network fee: 0 SOL · Kutip pays it</Chip>
      </div>
    </div>
  );
  return (
    <AbsoluteFill style={{ background: C.paper, fontFamily: FONT }}>
      <div style={{ position: "absolute", left, top, opacity: enter, filter: `drop-shadow(0 24px 48px oklch(25% 0.03 290 / 0.18))` }}>
        <PhoneFrame scale={scale}>
          <PayPage stage="qr" />
        </PhoneFrame>
      </div>
      {text}
    </AbsoluteFill>
  );
};
