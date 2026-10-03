import type React from "react";
import { ArrowUpRight } from "lucide-react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, R, SHADOW } from "../theme/tokens";
import { FONT, TABULAR } from "../theme/fonts";
import { EASE_EXPO, EASE_IN } from "../lib/anim";
import { Chip } from "../ui/Pills";
import { proofById, shortSig, solscanTx, type Proof } from "../data/proof";

/**
 * "Mainnet proof" card: what happened, the short signature, the Solscan URL and the timing.
 * Every signature is a real one from docs/REHEARSAL.md. Bottom-right by default.
 */
export const ProofCard: React.FC<{ proof?: Proof; id?: string; position?: "bottom-right" | "bottom-left" | "center"; scale?: number; style?: React.CSSProperties }> = ({ proof, id, position = "bottom-right", scale = 1, style }) => {
  const p = proof ?? proofById(id ?? "pay-sol");
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const portrait = height > width;
  const s = scale * (portrait ? 0.85 : 1);
  const inP = interpolate(frame, [0, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_EXPO });
  const outP = interpolate(frame, [durationInFrames - 9, durationInFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_IN });
  const pos: React.CSSProperties =
    position === "center"
      ? { left: "50%", top: "50%", translate: `-50% calc(-50% + ${(1 - inP) * 24}px)` }
      : position === "bottom-left"
        ? { left: 96 * s, bottom: 190 * s, translate: `0px ${(1 - inP) * 24 + outP * 12}px` }
        : { right: 96 * s, bottom: 190 * s, translate: `0px ${(1 - inP) * 24 + outP * 12}px` };
  return (
    <div style={{ position: "absolute", width: 600 * s, padding: 24 * s, borderRadius: R.xl, background: C.surface, boxShadow: `${SHADOW.float}, inset 0 0 0 1px ${C.line}`, fontFamily: FONT, color: C.ink, opacity: inP * (1 - outP), ...pos, ...style }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 * s }}>
        <Chip tone="accent" scale={1.3 * s}>
          Verified on Solana <ArrowUpRight size={14 * s} />
        </Chip>
        <span style={{ fontSize: 16 * s, color: C.ink3, ...TABULAR }}>{p.date} · mainnet</span>
      </div>
      <p style={{ margin: `${16 * s}px 0 0`, fontSize: 24 * s, lineHeight: 1.3, fontWeight: 500 }}>{p.label}</p>
      {p.timing ? <p style={{ margin: `${8 * s}px 0 0`, fontSize: 20 * s, color: C.ink2, ...TABULAR }}>{p.timing}</p> : null}
      <div style={{ marginTop: 16 * s, padding: `${12 * s}px ${16 * s}px`, borderRadius: R.md, background: C.well, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 * s, fontSize: 18 * s, ...TABULAR }}>
        <span style={{ color: C.ink2 }}>
          Signature <span style={{ color: C.ink, fontWeight: 600 }}>{shortSig(p.signature, 6)}</span>
        </span>
        <span style={{ color: C.accent, whiteSpace: "nowrap" }}>{solscanTx(p.signature).replace("https://", "").slice(0, 22)}…</span>
      </div>
    </div>
  );
};
