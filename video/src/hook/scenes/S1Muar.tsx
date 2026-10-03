import type React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C } from "../../theme/tokens";
import { TABULAR } from "../../theme/fonts";
import { beat } from "../../lib/beat";
import { EASE_EXPO, useLayout } from "../../lib/anim";
import { GreyWorld, Line } from "./shared";

/** "A furniture maker in Muar just shipped to Sydney." A shipment arcs across the frame. */
export const S1Muar: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, portrait, gutter, k } = useLayout();
  const draw = interpolate(frame, [beat(2.5), beat(6)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_EXPO });
  // Quadratic arc from Muar (left) to Sydney (right).
  const x0 = gutter + 40, x1 = width - gutter - 40;
  const yBase = portrait ? height * 0.78 : height * 0.8;
  const cy = yBase - (portrait ? 220 : 260);
  const cx = (x0 + x1) / 2;
  const pt = (t: number) => ({ x: (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t ** 2 * x1, y: (1 - t) ** 2 * yBase + 2 * (1 - t) * t * cy + t ** 2 * yBase });
  const p = pt(draw);
  const d = `M ${x0} ${yBase} Q ${cx} ${cy} ${x1} ${yBase}`;
  const len = 2600;
  const label = (x: number, text: string, at: number, align: "start" | "end") => (
    <text x={x} y={yBase + 44 * k} textAnchor={align} fill={C.ink2} fontSize={22 * k} fontWeight={500} opacity={interpolate(frame, [at, at + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} style={{ ...TABULAR }}>
      {text}
    </text>
  );
  return (
    <GreyWorld>
      <div style={{ position: "absolute", left: gutter, top: portrait ? gutter + 120 : gutter + 60, right: gutter, display: "grid", gap: 8 * k }}>
        <Line from={beat(0)} size={portrait ? 96 : 118}>A furniture maker</Line>
        <Line from={beat(1)} size={portrait ? 96 : 118} color={C.ink2}>in Muar</Line>
        <Line from={beat(2.5)} size={portrait ? 96 : 118}>just shipped</Line>
        <Line from={beat(4)} size={portrait ? 96 : 118} color={C.ink2}>to Sydney.</Line>
      </div>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <path d={d} fill="none" stroke={C.lineStrong} strokeWidth={2} strokeDasharray="6 10" />
        <path d={d} fill="none" stroke={C.ink} strokeWidth={3} strokeDasharray={len} strokeDashoffset={len * (1 - draw)} />
        <circle cx={x0} cy={yBase} r={9} fill={C.ink} />
        <circle cx={x1} cy={yBase} r={9} fill={draw > 0.98 ? C.ink : "transparent"} stroke={C.ink} strokeWidth={3} />
        {draw > 0 && draw < 1 ? <rect x={p.x - 11} y={p.y - 11} width={22} height={22} rx={5} fill={C.ink} /> : null}
        {label(x0, "Muar, Johor", beat(1), "start")}
        {label(x1, "Sydney, NSW", beat(4), "end")}
      </svg>
    </GreyWorld>
  );
};
