import type React from "react";
import { Check } from "lucide-react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, R } from "../theme/tokens";
import { FONT, TABULAR } from "../theme/fonts";
import { EASE } from "../lib/anim";

export type StepperStep = { label: string; caption?: string; /** frame at which this step completes; undefined = not yet */ doneAt?: number };

/**
 * The product's Stepper (components/ui/stepper.tsx), frame-driven: the rail fills violet over
 * 450 ms ease-out as each stage lands, and the current node pulses while something is in flight.
 */
export const Stepper: React.FC<{ steps: StepperStep[]; live?: boolean; size?: "sm" | "md"; scale?: number; style?: React.CSSProperties }> = ({ steps, live = false, size = "md", scale = 1, style }) => {
  const frame = useCurrentFrame();
  const node = (size === "sm" ? 24 : 32) * scale;
  const done = steps.filter((s) => s.doneAt !== undefined && frame >= s.doneAt).length;
  const fill = 13.5; // 450 ms at 30 fps
  return (
    <ol style={{ display: "grid", gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`, listStyle: "none", margin: 0, padding: 0, fontFamily: FONT, ...style }}>
      {steps.map((s, i) => {
        const complete = i < done;
        const current = i === done;
        const pulse = current && live ? (frame % 36) / 36 : 0;
        const railP = s.doneAt === undefined ? 0 : interpolate(frame, [s.doneAt, s.doneAt + fill], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
        return (
          <li key={s.label} style={{ position: "relative", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <span
                style={{
                  position: "relative",
                  zIndex: 1,
                  display: "inline-flex",
                  flexShrink: 0,
                  alignItems: "center",
                  justifyContent: "center",
                  width: node,
                  height: node,
                  borderRadius: R.full,
                  fontSize: 12 * scale,
                  fontWeight: 600,
                  background: complete ? C.accent : C.surface,
                  color: complete ? C.onAccent : current ? C.accent : C.ink3,
                  boxShadow: complete ? undefined : `inset 0 0 0 2px ${current ? C.accent : C.line}`,
                }}
              >
                {complete ? <Check size={(size === "sm" ? 12 : 14) * scale} strokeWidth={3} /> : i + 1}
                {current && live ? <span style={{ position: "absolute", inset: 0, borderRadius: R.full, background: C.accent, opacity: 0.3 * (1 - pulse), scale: `${1 + pulse * 1.4}` }} /> : null}
              </span>
              {i < steps.length - 1 ? (
                <span style={{ position: "relative", margin: `0 ${8 * scale}px`, height: 2 * scale, flex: 1, overflow: "hidden", borderRadius: R.full, background: C.line }}>
                  <span style={{ position: "absolute", top: 0, bottom: 0, left: 0, borderRadius: R.full, background: C.accent, width: `${railP * 100}%` }} />
                </span>
              ) : null}
            </div>
            <div style={{ marginTop: 8 * scale, paddingRight: 8 * scale, fontSize: (size === "sm" ? 12 : 14) * scale, lineHeight: 1.3, fontWeight: complete || current ? 500 : 400, color: complete || current ? C.ink : C.ink3 }}>{s.label}</div>
            {s.caption !== undefined ? <div style={{ fontSize: 12 * scale, color: C.ink3, ...TABULAR }}>{complete ? s.caption : "—"}</div> : null}
          </li>
        );
      })}
    </ol>
  );
};
