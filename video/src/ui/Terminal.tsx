import type React from "react";
import { useCurrentFrame } from "remotion";
import { C, R, SHADOW } from "../theme/tokens";
import { FONT, TABULAR } from "../theme/fonts";

export type TermLine = { text: string; /** frame (relative to the component start) at which the line appears */ at: number; tone?: "dim" | "accent" | "ok" | "warn" };

/**
 * A recreated terminal that reveals lines on a schedule. Content comes from real logs
 * (docs/video/clips/*.log, synced to public/logs) or README commands; nothing is invented.
 * No monospace in the product, but a terminal is a terminal: this uses the system mono.
 */
export const Terminal: React.FC<{ lines: TermLine[]; title?: string; width: number; height: number; fontSize?: number; style?: React.CSSProperties }> = ({ lines, title = "kutip-worker", width, height, fontSize = 20, style }) => {
  const frame = useCurrentFrame();
  const visible = lines.filter((l) => frame >= l.at);
  const lineH = fontSize * 1.5;
  const maxLines = Math.floor((height - 56 - 40) / lineH);
  const shown = visible.slice(Math.max(0, visible.length - maxLines));
  const tone = (t?: TermLine["tone"]) => (t === "dim" ? C.darkInk3 : t === "accent" ? C.darkAccent : t === "ok" ? "oklch(80% 0.14 150)" : t === "warn" ? "oklch(82% 0.14 70)" : C.darkInk);
  return (
    <div style={{ width, height, borderRadius: R.xl, overflow: "hidden", background: C.darkPaper, boxShadow: `${SHADOW.float}, inset 0 0 0 1px ${C.darkLine}`, ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, height: 44, padding: "0 16px", background: C.darkPaper2, borderBottom: `1px solid ${C.darkLine}`, fontFamily: FONT, fontSize: 13, color: C.darkInk3 }}>
        <span style={{ width: 10, height: 10, borderRadius: R.full, background: C.darkLine }} />
        <span style={{ width: 10, height: 10, borderRadius: R.full, background: C.darkLine }} />
        <span style={{ width: 10, height: 10, borderRadius: R.full, background: C.darkLine }} />
        <span style={{ marginLeft: 8 }}>{title}</span>
      </div>
      <div style={{ padding: "16px 20px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize, lineHeight: `${lineH}px`, whiteSpace: "pre-wrap", wordBreak: "break-all", ...TABULAR }}>
        {shown.map((l, i) => (
          <div key={`${l.at}-${i}`} style={{ color: tone(l.tone) }}>
            {l.text}
          </div>
        ))}
        {frame % 20 < 10 ? <span style={{ display: "inline-block", width: fontSize * 0.55, height: fontSize * 1.1, background: C.darkInk, verticalAlign: "text-bottom" }} /> : null}
      </div>
    </div>
  );
};
