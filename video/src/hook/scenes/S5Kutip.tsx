import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "../../theme/tokens";
import { FONT } from "../../theme/fonts";
import { bounce, EASE_EXPO, useLayout } from "../../lib/anim";
import { KutipMark } from "../../ui/Mark";

/** "Kutip." The mark lands on the beat; the name slides out from behind it. */
export const S5Kutip: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, k, portrait } = useLayout();
  const s = bounce(frame, fps, 0);
  const slide = interpolate(frame, [5, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_EXPO });
  const mark = (portrait ? 200 : 180) * k;
  return (
    <AbsoluteFill style={{ background: C.hero, alignItems: "center", justifyContent: "center", fontFamily: FONT }}>
      <div style={{ display: "flex", alignItems: "center", gap: 36 * k }}>
        <div style={{ scale: `${s}`, zIndex: 1 }}>
          <KutipMark size={mark} color={C.surface} fg={C.heroButtonFg} />
        </div>
        <div style={{ overflow: "hidden" }}>
          <div style={{ fontSize: mark * 0.86, fontWeight: 700, letterSpacing: "-0.04em", color: C.onHero, lineHeight: 1, translate: `${(1 - slide) * -100}% 0px`, opacity: slide }}>Kutip.</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
