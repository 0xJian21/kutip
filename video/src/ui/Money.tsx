import type React from "react";
import { C } from "../theme/tokens";
import { FONT, TABULAR } from "../theme/fonts";

/**
 * A ringgit amount as one figure (components/ui/money.tsx Amount): bold integer,
 * muted decimals, small "RM". `size` is the integer's font size in px.
 */
export const Amount: React.FC<{ myr: string; size?: number; tone?: "ink" | "hero"; style?: React.CSSProperties }> = ({ myr, size = 34, tone = "ink", style }) => {
  const [int, frac] = myr.split(".");
  const main = tone === "hero" ? C.onHero : C.ink;
  const soft = tone === "hero" ? C.onHero2 : C.ink3;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        whiteSpace: "nowrap",
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: size,
        lineHeight: 1.07,
        letterSpacing: "-0.025em",
        color: main,
        ...TABULAR,
        ...style,
      }}
    >
      <span style={{ marginRight: "0.18em", fontSize: "0.5em", fontWeight: 600, letterSpacing: 0, color: soft }}>RM</span>
      <span>{int}</span>
      {frac !== undefined ? <span style={{ color: soft }}>.{frac}</span> : null}
    </span>
  );
};

/** "11,437.50 USDC" with the unit at 45%, as on the pay page. */
export const UsdcFigure: React.FC<{ value: string; unit?: string; size?: number; color?: string; style?: React.CSSProperties }> = ({ value, unit = "USDC", size = 44, color = C.ink, style }) => (
  <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: size, lineHeight: 1.09, letterSpacing: "-0.025em", color, whiteSpace: "nowrap", ...TABULAR, ...style }}>
    {value} <span style={{ fontSize: "0.45em", fontWeight: 600, color: C.ink3, letterSpacing: 0 }}>{unit}</span>
  </span>
);
