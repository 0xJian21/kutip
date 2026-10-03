import type React from "react";
import { ArrowUpRight } from "lucide-react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, R } from "../theme/tokens";
import { TABULAR } from "../theme/fonts";
import { Button, HeroCard } from "./Card";
import { Amount } from "./Money";
import { Chip } from "./Pills";
import { DEMO } from "../data/proof";
import { EASE } from "../lib/anim";

/**
 * The dashboard's treasury hero (components/dashboard/treasury-hero.tsx), with the seeded
 * demo balance from the screenshots (`showBalance={false}` hides the figure). `meterFrom` animates the daily-cap meter in (450 ms).
 */
export const TreasuryCard: React.FC<{ scale?: number; width?: number; meterFrom?: number; meterValue?: number; /** The hook hides the seeded balance; the kit preview shows it. */ showBalance?: boolean; style?: React.CSSProperties }> = ({ scale = 1, width = 360, meterFrom, meterValue = 0, showBalance = true, style }) => {
  const frame = useCurrentFrame();
  const meter = meterFrom === undefined ? meterValue : interpolate(frame, [meterFrom, meterFrom + 13.5], [0, meterValue], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  return (
    <HeroCard scale={scale} style={{ width, ...style }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 * scale }}>
        <p style={{ margin: 0, fontSize: 14 * scale, fontWeight: 500, color: C.onHero2 }}>In your treasury</p>
        <Chip tone="hero" scale={scale}>
          Verified on Solana <ArrowUpRight size={12 * scale} />
        </Chip>
      </div>
      {showBalance ? (
        <>
          <Amount myr={DEMO.treasury.myr} size={44 * scale} tone="hero" style={{ marginTop: 8 * scale }} />
          <p style={{ margin: `${6 * scale}px 0 0`, fontSize: 14 * scale, color: C.onHero2, ...TABULAR }}>
            {DEMO.treasury.usdc} USDC · BNM rate {DEMO.bnmRate}
          </p>
        </>
      ) : null}
      <p style={{ margin: `${(showBalance ? 4 : 12) * scale}px 0 0`, fontSize: 12 * scale, color: C.onHero2 }}>Live on Solana mainnet. All payments arrive as USD (USDC).</p>
      <div style={{ marginTop: 20 * scale }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 * scale, color: C.onHero2 }}>
          <span>Waiting in buyer accounts</span>
          <span style={{ ...TABULAR }}>
            <span style={{ color: C.onHero, fontWeight: 600 }}>USD {DEMO.treasury.waitingUsd}</span> / {DEMO.treasury.capUsd} a day
          </span>
        </div>
        <div style={{ marginTop: 8 * scale, height: 10 * scale, borderRadius: R.full, background: C.heroFill, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${meter * 100}%`, borderRadius: R.full, color: C.onHero, backgroundImage: "repeating-linear-gradient(-45deg, currentColor 0 1.5px, transparent 1.5px 5px)" }} />
        </div>
      </div>
      <div style={{ marginTop: 20 * scale, display: "flex", gap: 8 * scale }}>
        <Button variant="hero" scale={scale}>Sweep now</Button>
        <Button variant="heroOutline" scale={scale}>Cash out to ringgit</Button>
      </div>
    </HeroCard>
  );
};
