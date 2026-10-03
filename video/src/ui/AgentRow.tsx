import type React from "react";
import { Fingerprint } from "lucide-react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, R, SHADOW } from "../theme/tokens";
import { FONT, TABULAR } from "../theme/fonts";
import { Button, Card } from "./Card";
import { AgentStatusPill, Chip } from "./Pills";
import { DEMO } from "../data/proof";
import { EASE_EXPO } from "../lib/anim";

/**
 * An "Agent needs you" row (components/agent/action-row.tsx) for the cash-out proposal,
 * with Approve / Reject, and from `touchAt` the passkey prompt the product shows:
 * "Your device will ask for Touch ID or Face ID to sign your decision."
 */
export const AgentRow: React.FC<{ touchAt?: number; scale?: number; width?: number; style?: React.CSSProperties }> = ({ touchAt, scale = 1, width = 520, style }) => {
  const frame = useCurrentFrame();
  const a = DEMO.cashOutProposal;
  const touch = touchAt === undefined ? 0 : interpolate(frame, [touchAt, touchAt + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_EXPO });
  return (
    <Card scale={scale} padding={0} style={{ width, position: "relative", ...style }}>
      <div style={{ padding: `${20 * scale}px ${24 * scale}px ${12 * scale}px`, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ fontSize: 18 * scale, fontWeight: 600, letterSpacing: "-0.01em" }}>Agent needs you</div>
        <div style={{ fontSize: 13 * scale, color: C.ink2, marginTop: 2 * scale }}>Anything outside the rules waits for you</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", alignItems: "center", gap: 16 * scale, padding: `${16 * scale}px ${24 * scale}px` }}>
        <div style={{ display: "grid", gap: 8 * scale, minWidth: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: `2px ${12 * scale}px` }}>
            <span style={{ fontSize: 14 * scale, fontWeight: 500 }}>{a.kind}</span>
            <span style={{ fontSize: 14 * scale, color: C.ink2 }}>{DEMO.exporterShort}</span>
            <span style={{ fontSize: 14 * scale, color: C.ink3, ...TABULAR }}>13 h ago</span>
          </div>
          <p style={{ margin: 0, fontSize: 16 * scale, lineHeight: 1.4 }}>{a.decision}</p>
          <p style={{ margin: 0, fontSize: 15 * scale, lineHeight: 1.4, color: C.ink2 }}>{a.reason}</p>
          <div style={{ display: "flex", gap: 12 * scale, paddingTop: 4 * scale }}>
            <Chip scale={scale}>Rule {a.rule}</Chip>
            <Chip scale={scale}>{a.confidence} confidence</Chip>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 * scale }}>
          <AgentStatusPill status="proposed" scale={scale} />
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 * scale }}>
            <Button variant="ghost" size="sm" scale={scale}>Reject</Button>
            <Button variant="secondary" size="sm" scale={scale}>Approve</Button>
          </span>
        </div>
      </div>
      {touchAt !== undefined ? (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: -28 * scale,
            translate: `-50% ${(1 - touch) * 16}px`,
            opacity: touch,
            display: "inline-flex",
            alignItems: "center",
            gap: 10 * scale,
            padding: `${10 * scale}px ${16 * scale}px ${10 * scale}px ${12 * scale}px`,
            borderRadius: R.full,
            background: C.surface,
            boxShadow: `${SHADOW.float}, inset 0 0 0 1px ${C.line}`,
            fontFamily: FONT,
            fontSize: 14 * scale,
            fontWeight: 500,
            color: C.ink,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28 * scale, height: 28 * scale, borderRadius: R.full, background: C.accentSoft, color: C.accent }}>
            <Fingerprint size={16 * scale} />
          </span>
          Confirm with Touch ID to sign your decision
        </div>
      ) : null}
    </Card>
  );
};
