import type React from "react";
import { C, R, SHADOW } from "../theme/tokens";
import { FONT, TABULAR } from "../theme/fonts";

/**
 * A quiet phone frame, as the landing page draws the buyer's pay page: rounded 1.6rem
 * surface, 6px bezel, a hairline ring. Content is clipped to the inner radius.
 * Built for a 375px-wide screen; pass `scale` to size it.
 */
export const PhoneFrame: React.FC<{ children: React.ReactNode; scale?: number; screenWidth?: number; screenHeight?: number; style?: React.CSSProperties }> = ({ children, scale = 1, screenWidth = 375, screenHeight = 812, style }) => (
  <div
    style={{
      width: (screenWidth + 12) * scale,
      height: (screenHeight + 12) * scale,
      padding: 6 * scale,
      borderRadius: 25.6 * scale * 1.5,
      background: C.surface,
      boxShadow: `${SHADOW.float}, inset 0 0 0 1px ${C.lineStrong}`,
      ...style,
    }}
  >
    <div style={{ width: screenWidth * scale, height: screenHeight * scale, borderRadius: 19.2 * scale * 1.5, overflow: "hidden", background: C.paper, position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, width: screenWidth, height: screenHeight, scale: `${scale}`, transformOrigin: "top left" }}>{children}</div>
    </div>
  </div>
);

/** A browser window frame with the product URL in the address pill (landing hero). */
export const BrowserFrame: React.FC<{ children: React.ReactNode; url: string; width: number; height: number; scale?: number; style?: React.CSSProperties }> = ({ children, url, width, height, scale = 1, style }) => {
  const bar = 36 * scale;
  return (
    <div style={{ width, height, borderRadius: R.xl * scale, overflow: "hidden", background: C.surface, boxShadow: `${SHADOW.float}, inset 0 0 0 1px ${C.line}`, fontFamily: FONT, ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 * scale, height: bar, padding: `0 ${14 * scale}px`, background: C.paper2, borderBottom: `1px solid ${C.line}` }}>
        <span style={{ width: 8 * scale, height: 8 * scale, borderRadius: R.full, background: C.lineStrong }} />
        <span style={{ margin: "0 auto", padding: `${2 * scale}px ${12 * scale}px`, borderRadius: R.full, background: C.surface, fontSize: 11 * scale, color: C.ink3, boxShadow: `inset 0 0 0 1px ${C.line}`, ...TABULAR }}>{url}</span>
        <span style={{ width: 8 * scale, height: 8 * scale }} />
      </div>
      <div style={{ position: "relative", width, height: height - bar, overflow: "hidden", background: C.paper }}>{children}</div>
    </div>
  );
};
