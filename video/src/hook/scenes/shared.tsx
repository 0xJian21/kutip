import type React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C } from "../../theme/tokens";
import { FONT } from "../../theme/fonts";
import { beatPulse } from "../../lib/beat";
import { riseIn, useLayout } from "../../lib/anim";

/**
 * The grey world: the bank-statement room before the colour shift. Same neutrals as the
 * product (paper-2 canvas, ruled hairlines), with the violet drained out.
 */
export const GreyWorld: React.FC<{ children?: React.ReactNode; rows?: boolean }> = ({ children, rows = true }) => (
  <AbsoluteFill style={{ background: C.paper2, fontFamily: FONT, color: C.ink }}>
    {rows ? <AbsoluteFill style={{ backgroundImage: `repeating-linear-gradient(0deg, ${C.line} 0 1px, transparent 1px 64px)`, opacity: 0.9 }} /> : null}
    {children}
  </AbsoluteFill>
);

/** Giant display type with a subtle punch on every beat. */
export const Giant: React.FC<{ children: React.ReactNode; size: number; from: number; color?: string; punch?: boolean; style?: React.CSSProperties; weight?: number }> = ({ children, size, from, color = C.ink, punch = true, style, weight = 700 }) => {
  const frame = useCurrentFrame();
  const pulse = punch ? beatPulse(frame, 0.45) : 0;
  return (
    <div
      style={{
        ...riseIn(frame, from, 12, 36),
        fontSize: size,
        fontWeight: weight,
        lineHeight: 0.98,
        letterSpacing: "-0.035em",
        color,
        scale: `${1 + pulse * 0.025}`,
        transformOrigin: "left bottom",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** A line of kinetic copy that rises in at `from`. */
export const Line: React.FC<{ children: React.ReactNode; from: number; size?: number; color?: string; weight?: number; style?: React.CSSProperties }> = ({ children, from, size, color = C.ink, weight = 600, style }) => {
  const frame = useCurrentFrame();
  const { k } = useLayout();
  return (
    <div style={{ ...riseIn(frame, from, 14, 32), fontSize: (size ?? 84) * k, fontWeight: weight, lineHeight: 1.04, letterSpacing: "-0.03em", color, textWrap: "balance", ...style }}>
      {children}
    </div>
  );
};

/** Small caption in the label voice. */
export const Caption: React.FC<{ children: React.ReactNode; from: number; color?: string; style?: React.CSSProperties }> = ({ children, from, color = C.ink3, style }) => {
  const frame = useCurrentFrame();
  const { k } = useLayout();
  return <div style={{ ...riseIn(frame, from, 14, 16), fontSize: 24 * k, fontWeight: 500, color, ...style }}>{children}</div>;
};
