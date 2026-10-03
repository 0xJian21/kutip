import type React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, R, SHADOW } from "../theme/tokens";
import { FONT } from "../theme/fonts";
import { EASE_EXPO, EASE_IN } from "../lib/anim";
import { KutipMark } from "../ui/Mark";

/**
 * Lower-third: name and role in a white floating card with the mark, bottom-left.
 * Slides in over 0.5 s and out over 0.3 s before its sequence ends.
 */
export const LowerThird: React.FC<{ name: string; role: string; durationInFrames?: number; scale?: number; style?: React.CSSProperties }> = ({ name, role, durationInFrames, scale = 1, style }) => {
  const frame = useCurrentFrame();
  const { durationInFrames: seqDuration, height, width } = useVideoConfig();
  const total = durationInFrames ?? seqDuration;
  const inP = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_EXPO });
  const outP = interpolate(frame, [total - 9, total], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_IN });
  const portrait = height > width;
  const s = scale * (portrait ? 0.9 : 1);
  return (
    <div
      style={{
        position: "absolute",
        left: (portrait ? 48 : 96) * s,
        bottom: (portrait ? 260 : 96) * s,
        display: "inline-flex",
        alignItems: "center",
        gap: 18 * s,
        padding: `${16 * s}px ${28 * s}px ${16 * s}px ${18 * s}px`,
        borderRadius: R.full,
        background: C.surface,
        boxShadow: `${SHADOW.float}, inset 0 0 0 1px ${C.line}`,
        fontFamily: FONT,
        color: C.ink,
        opacity: inP * (1 - outP),
        translate: `${(1 - inP) * -40 + outP * -24}px 0px`,
        ...style,
      }}
    >
      <KutipMark size={44 * s} />
      <span style={{ display: "grid", lineHeight: 1.15 }}>
        <span style={{ fontSize: 30 * s, fontWeight: 600, letterSpacing: "-0.01em" }}>{name}</span>
        <span style={{ fontSize: 20 * s, color: C.ink2, marginTop: 4 * s }}>{role}</span>
      </span>
    </div>
  );
};
