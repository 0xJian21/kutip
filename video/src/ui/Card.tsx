import type React from "react";
import { C, R, SHADOW } from "../theme/tokens";
import { FONT } from "../theme/fonts";

/** A white card at 20px radius with the one soft shadow. `scale` multiplies radius and padding. */
export const Card: React.FC<{ children: React.ReactNode; scale?: number; padding?: number; style?: React.CSSProperties }> = ({ children, scale = 1, padding = 24, style }) => (
  <div style={{ background: C.surface, borderRadius: R.xl * scale, boxShadow: SHADOW.card, padding: padding * scale, fontFamily: FONT, color: C.ink, ...style }}>{children}</div>
);

/** Inset well inside a card (QR frame, invoice paper, code). */
export const Inset: React.FC<{ children: React.ReactNode; scale?: number; style?: React.CSSProperties }> = ({ children, scale = 1, style }) => (
  <div style={{ background: C.well, borderRadius: R.lg * scale, ...style }}>{children}</div>
);

/** The gradient treasury card. The only gradient surface in the product; two blurred discs for depth. */
export const HeroCard: React.FC<{ children: React.ReactNode; scale?: number; style?: React.CSSProperties }> = ({ children, scale = 1, style }) => (
  <div
    style={{
      position: "relative",
      overflow: "hidden",
      background: C.hero,
      color: C.onHero,
      borderRadius: R["2xl"] * scale,
      boxShadow: SHADOW.hero,
      padding: 28 * scale,
      fontFamily: FONT,
      ...style,
    }}
  >
    <div style={{ position: "absolute", right: -60 * scale, top: -80 * scale, width: 260 * scale, height: 260 * scale, borderRadius: R.full, background: C.heroFill, filter: `blur(${40 * scale}px)` }} />
    <div style={{ position: "absolute", left: -40 * scale, bottom: -120 * scale, width: 220 * scale, height: 220 * scale, borderRadius: R.full, background: C.heroFill, filter: `blur(${36 * scale}px)` }} />
    <div style={{ position: "relative" }}>{children}</div>
  </div>
);

/** Buttons as in components/ui/button.tsx. Pills, 40px, 20px side padding. */
export const Button: React.FC<{ children: React.ReactNode; variant?: "primary" | "secondary" | "outline" | "ghost" | "hero" | "heroOutline"; size?: "sm" | "md" | "lg"; scale?: number; style?: React.CSSProperties }> = ({ children, variant = "primary", size = "md", scale = 1, style }) => {
  const h = (size === "sm" ? 32 : size === "lg" ? 48 : 40) * scale;
  const look: React.CSSProperties =
    variant === "primary"
      ? { background: C.accent, color: C.onAccent }
      : variant === "secondary"
        ? { background: C.ink, color: C.paper }
        : variant === "outline"
          ? { background: C.surface, color: C.ink, boxShadow: `inset 0 0 0 1px ${C.lineStrong}, ${SHADOW.pill}` }
          : variant === "hero"
            ? { background: C.surface, color: C.heroButtonFg }
            : variant === "heroOutline"
              ? { background: C.heroFill, color: C.onHero, boxShadow: `inset 0 0 0 1px ${C.heroLine}` }
              : { background: "transparent", color: C.ink };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8 * scale,
        height: h,
        padding: `0 ${(size === "lg" ? 24 : 20) * scale}px`,
        borderRadius: R.full,
        fontFamily: FONT,
        fontSize: (size === "lg" ? 16 : 14) * scale,
        fontWeight: 500,
        whiteSpace: "nowrap",
        ...look,
        ...style,
      }}
    >
      {children}
    </span>
  );
};

/** Company logo square with initials (components/ui/avatar.tsx). */
export const CompanyAvatar: React.FC<{ name: string; size?: number; bg: string; fg: string; style?: React.CSSProperties }> = ({ name, size = 40, bg, fg, style }) => (
  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size, borderRadius: size >= 56 ? R.sm : R.xs, background: bg, color: fg, fontFamily: FONT, fontWeight: 600, fontSize: size * 0.36, flexShrink: 0, ...style }}>
    {name}
  </span>
);
