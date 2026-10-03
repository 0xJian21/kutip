import type React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, R, SHADOW } from "../theme/tokens";
import { FONT } from "../theme/fonts";
import { pop, riseIn, useLayout } from "../lib/anim";
import { KutipMark } from "../ui/Mark";
import { APP_URL } from "../data/proof";

/**
 * End card: the mark, "Get paid like a message.", the URL pill, "Built in Malaysia. For every exporter."
 * Frame offsets are relative to the card's own start; the hook passes beat-aligned ones.
 */
export const EndCard: React.FC<{ markAt?: number; taglineAt?: number; urlAt?: number; footerAt?: number; tone?: "paper" | "hero" }> = ({ markAt = 0, taglineAt = 10, urlAt = 20, footerAt = 34, tone = "paper" }) => {
  const frame = useCurrentFrame();
  const { k, fps, portrait } = useLayout();
  const paper = tone === "paper";
  const s = pop(frame, fps, markAt, 20);
  return (
    <AbsoluteFill style={{ background: paper ? C.paper : C.hero, fontFamily: FONT, alignItems: "center", justifyContent: "center", color: paper ? C.ink : C.onHero }}>
      <div style={{ scale: `${s}`, opacity: s }}>
        <KutipMark size={(portrait ? 168 : 152) * k} color={paper ? C.accent : C.surface} fg={paper ? C.onAccent : C.heroButtonFg} />
      </div>
      <div style={{ ...riseIn(frame, taglineAt, 16), marginTop: 44 * k, fontSize: (portrait ? 72 : 84) * k, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.05, textAlign: "center", maxWidth: portrait ? "10ch" : "none", textWrap: "balance" }}>
        <span style={{ color: paper ? C.accent : C.onHero }}>Kutip.</span> Get paid like a message.
      </div>
      <div
        style={{
          ...riseIn(frame, urlAt, 16),
          marginTop: 40 * k,
          padding: `${16 * k}px ${34 * k}px`,
          borderRadius: R.full,
          background: paper ? C.surface : C.heroFill,
          boxShadow: paper ? `${SHADOW.pill}, inset 0 0 0 1px ${C.line}` : `inset 0 0 0 1px ${C.heroLine}`,
          fontSize: 36 * k,
          fontWeight: 500,
          color: paper ? C.ink : C.onHero,
        }}
      >
        {APP_URL}
      </div>
      <div style={{ ...riseIn(frame, footerAt, 16), position: "absolute", bottom: (portrait ? 200 : 96) * k, fontSize: 28 * k, fontWeight: 500, color: paper ? C.ink2 : C.onHero2 }}>Built in Malaysia. For every exporter.</div>
    </AbsoluteFill>
  );
};
