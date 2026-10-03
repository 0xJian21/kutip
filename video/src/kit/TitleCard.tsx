import type React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C } from "../theme/tokens";
import { FONT } from "../theme/fonts";
import { riseIn, useLayout } from "../lib/anim";
import { KutipMark } from "../ui/Mark";

/**
 * Title card: a headline, an optional caption, the mark. `tone="dark"` uses the dark room
 * (section openers); "paper" is the product canvas; "hero" the violet gradient.
 */
export const TitleCard: React.FC<{ title: string; caption?: string; eyebrow?: string; tone?: "paper" | "dark" | "hero"; mark?: boolean; style?: React.CSSProperties }> = ({ title, caption, eyebrow, tone = "paper", mark = true, style }) => {
  const frame = useCurrentFrame();
  const { k, gutter, portrait } = useLayout();
  const bg = tone === "dark" ? C.darkPaper : tone === "hero" ? C.hero : C.paper;
  const fg = tone === "paper" ? C.ink : tone === "dark" ? C.darkInk : C.onHero;
  const fg2 = tone === "paper" ? C.ink2 : tone === "dark" ? C.darkInk2 : C.onHero2;
  const accent = tone === "paper" ? C.accent : tone === "dark" ? C.darkAccent : C.onHero;
  return (
    <AbsoluteFill style={{ background: bg, fontFamily: FONT, padding: gutter, justifyContent: "center", ...style }}>
      {mark ? (
        <div style={{ ...riseIn(frame, 0, 16), marginBottom: 28 * k }}>
          <KutipMark size={56 * k} color={tone === "hero" ? C.surface : C.accent} fg={tone === "hero" ? C.heroButtonFg : C.onAccent} />
        </div>
      ) : null}
      {eyebrow ? (
        <div style={{ ...riseIn(frame, 3, 16), fontSize: 26 * k, fontWeight: 500, color: accent, marginBottom: 18 * k }}>{eyebrow}</div>
      ) : null}
      <h1 style={{ ...riseIn(frame, 6, 18), margin: 0, maxWidth: portrait ? "100%" : "20ch", fontSize: 92 * k, fontWeight: 600, lineHeight: 1.04, letterSpacing: "-0.03em", color: fg, textWrap: "balance" }}>{title}</h1>
      {caption ? (
        <p style={{ ...riseIn(frame, 12, 18), margin: `${28 * k}px 0 0`, maxWidth: portrait ? "100%" : "44ch", fontSize: 34 * k, lineHeight: 1.4, color: fg2 }}>{caption}</p>
      ) : null}
    </AbsoluteFill>
  );
};
