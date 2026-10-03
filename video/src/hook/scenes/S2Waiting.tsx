import type React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, R } from "../../theme/tokens";
import { TABULAR } from "../../theme/fonts";
import { beat } from "../../lib/beat";
import { useLayout } from "../../lib/anim";
import { GreyWorld, Line } from "./shared";

/** "Now the waiting begins." The wire's day axis fills, to scale (landing "Versus a wire"). */
export const S2Waiting: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, gutter, k, portrait, height } = useLayout();
  const DAYS = 5;
  const fill = interpolate(frame, [beat(1), beat(4)], [0, 3 / DAYS], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const w = width - gutter * 2;
  const day = Math.min(3, Math.floor((fill * DAYS) + 1e-6));
  return (
    <GreyWorld>
      <div style={{ position: "absolute", left: gutter, right: gutter, top: portrait ? height * 0.22 : height * 0.3 }}>
        <Line from={0} size={portrait ? 100 : 124}>Now the waiting begins.</Line>
        <div style={{ marginTop: (portrait ? 110 : 90) * k, opacity: interpolate(frame, [beat(0.5), beat(1.2)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 28 * k, fontWeight: 500 }}>
            <span>Bank wire</span>
            <span style={{ color: C.ink2, ...TABULAR }}>{day === 0 ? "Sent" : `Day ${day}`}</span>
          </div>
          <div style={{ position: "relative", marginTop: 14 * k, height: 64 * k, borderRadius: R.md, background: C.surface, overflow: "hidden", boxShadow: `inset 0 0 0 1px ${C.line}` }}>
            <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${fill * 100}%`, background: C.ink, opacity: 0.16 }} />
            <div style={{ position: "absolute", top: 0, bottom: 0, left: `${(2 / DAYS) * 100}%`, width: `${(3 / DAYS) * 100}%`, color: C.ink, opacity: 0.22, backgroundImage: "repeating-linear-gradient(-45deg, currentColor 0 2px, transparent 2px 9px)" }} />
          </div>
          <div style={{ position: "relative", height: 32 * k, marginTop: 10 * k, fontSize: 20 * k, color: C.ink3, ...TABULAR }}>
            {Array.from({ length: DAYS + 1 }, (_, d) => (
              <span key={d} style={{ position: "absolute", left: (d / DAYS) * w, translate: d === 0 ? "0" : d === DAYS ? "-100%" : "-50%", whiteSpace: "nowrap" }}>
                {d === 0 ? "Sent" : `Day ${d}`}
              </span>
            ))}
          </div>
        </div>
      </div>
    </GreyWorld>
  );
};
