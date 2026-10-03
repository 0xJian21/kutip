import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "../../theme/tokens";
import { FONT } from "../../theme/fonts";
import { beat, HOOK } from "../../lib/beat";
import { EASE_EXPO, useLayout } from "../../lib/anim";
import { GreyWorld, Line } from "./shared";

/** "What if getting paid… took one second?" The violet disc floods the grey room. */
export const S4Shift: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, gutter, k, portrait } = useLayout();
  const shift = beat(HOOK.s4Shift - HOOK.s4WhatIf);
  const r = Math.hypot(width, height) / 2;
  const disc = interpolate(frame, [shift, shift + 12], [0, r], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_EXPO });
  const grey = frame < shift + 12;
  const top = portrait ? height * 0.3 : height * 0.34;
  const size = portrait ? 104 : 132;
  return (
    <AbsoluteFill>
      {grey ? (
        <GreyWorld>
          <div style={{ position: "absolute", left: gutter, right: gutter, top }}>
            <Line from={0} size={size}>What if getting paid…</Line>
          </div>
        </GreyWorld>
      ) : null}
      <AbsoluteFill style={{ background: C.hero, fontFamily: FONT, clipPath: `circle(${disc}px at 50% 50%)` }}>
        <div style={{ position: "absolute", left: gutter, right: gutter, top }}>
          <Line from={0} size={size} color={C.onHero2}>What if getting paid…</Line>
          <Line from={shift + 4} size={size} color={C.onHero} style={{ marginTop: 16 * k }}>
            took <span style={{ fontWeight: 800 }}>one second?</span>
          </Line>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
