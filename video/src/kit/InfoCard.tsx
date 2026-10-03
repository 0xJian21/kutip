import type React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, R, SHADOW } from "../theme/tokens";
import { FONT } from "../theme/fonts";
import { riseIn, useLayout } from "../lib/anim";
import { KutipMark } from "../ui/Mark";
import { GTM_POINTS, TRUST_POINTS, WHY_SOLANA_POINTS } from "../data/proof";

export type InfoPoint = { title: string; body: string };

/**
 * A full-frame card of titled points that land one after another (every 6 frames).
 * Used for "Why Solana", "Trust & compliance", go-to-market and team.
 */
export const InfoCard: React.FC<{ title: string; points: InfoPoint[]; eyebrow?: string; columns?: number; footnote?: string; style?: React.CSSProperties }> = ({ title, points, eyebrow, columns, footnote, style }) => {
  const frame = useCurrentFrame();
  const { k, gutter, portrait } = useLayout();
  const cols = columns ?? (portrait ? 1 : points.length > 4 ? 3 : 2);
  return (
    <AbsoluteFill style={{ background: C.paper, fontFamily: FONT, color: C.ink, padding: gutter, justifyContent: "center", ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 * k, ...riseIn(frame, 0, 14) }}>
        <KutipMark size={36 * k} />
        {eyebrow ? <span style={{ fontSize: 24 * k, fontWeight: 500, color: C.accent }}>{eyebrow}</span> : null}
      </div>
      <h2 style={{ ...riseIn(frame, 4, 16), margin: `${20 * k}px 0 0`, fontSize: 64 * k, fontWeight: 600, lineHeight: 1.08, letterSpacing: "-0.02em", maxWidth: "24ch", textWrap: "balance" }}>{title}</h2>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 20 * k, marginTop: 40 * k }}>
        {points.map((p, i) => (
          <div key={p.title} style={{ ...riseIn(frame, 10 + i * 6, 16), padding: 28 * k, borderRadius: R.xl, background: C.surface, boxShadow: `${SHADOW.card}` }}>
            <div style={{ fontSize: 28 * k, fontWeight: 600, letterSpacing: "-0.01em" }}>{p.title}</div>
            <div style={{ marginTop: 8 * k, fontSize: 22 * k, lineHeight: 1.4, color: C.ink2 }}>{p.body}</div>
          </div>
        ))}
      </div>
      {footnote ? <p style={{ ...riseIn(frame, 10 + points.length * 6, 16), margin: `${24 * k}px 0 0`, fontSize: 18 * k, color: C.ink3 }}>{footnote}</p> : null}
    </AbsoluteFill>
  );
};

export const WhySolanaCard: React.FC = () => <InfoCard eyebrow="Why Solana, and Solami" title="The rails are the product: fast, final, and gasless for the buyer." points={WHY_SOLANA_POINTS} footnote="Timings measured on Solana mainnet, 29 September 2026 (docs/REHEARSAL.md)." />;

export const TrustCard: React.FC = () => <InfoCard eyebrow="Trust and compliance" title="Built to pass the questions your bank would ask." points={TRUST_POINTS} footnote="Stablecoins are an agreed settlement asset, not legal tender. No custody, no ringgit conversion by Kutip." />;

export const GtmCard: React.FC = () => <InfoCard eyebrow="Go-to-market" title="Made in Muar, for the furniture belt first." points={GTM_POINTS} columns={3} />;

/** Team card: fill `members` from docs/submission when it exists. Until then it names the build, not people. */
export const TeamCard: React.FC<{ members?: InfoPoint[] }> = ({ members }) => (
  <InfoCard
    eyebrow="Team"
    title="Built in Malaysia, on mainnet, for the Colosseum Crypto World's Fair."
    points={members ?? [{ title: "Kutip", body: "Solana track · Superteam MY \"Build Global, Buatan Malaysia\" · Solami prize. Code at github.com/0xJian21/kutip." }]}
    columns={members ? undefined : 1}
  />
);
