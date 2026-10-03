import type React from "react";
import { C } from "../theme/tokens";
import { FONT } from "../theme/fonts";

/** The Kutip mark (components/ui/avatar.tsx KutipMark): violet rounded square, the K stroke. */
export const KutipMark: React.FC<{ size?: number; style?: React.CSSProperties; color?: string; fg?: string }> = ({ size = 24, style, color = C.accent, fg = C.onAccent }) => (
  <span
    style={{
      display: "inline-flex",
      flexShrink: 0,
      alignItems: "center",
      justifyContent: "center",
      width: size,
      height: size,
      borderRadius: size * 0.28,
      background: color,
      color: fg,
      ...style,
    }}
  >
    <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 14 14" fill="none">
      <path d="M3 2v10M3 7l6-5M3 7l6 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
);

/** Mark + "Kutip" (components/shell/nav.tsx Wordmark). */
export const Wordmark: React.FC<{ size?: number; color?: string; style?: React.CSSProperties }> = ({ size = 28, color = C.ink, style }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: size * 0.36, fontFamily: FONT, ...style }}>
    <KutipMark size={size} />
    <span style={{ fontSize: size * 0.64, fontWeight: 600, letterSpacing: "-0.01em", color }}>Kutip</span>
  </span>
);
