import type React from "react";
import { useCurrentFrame } from "remotion";
import { C, R } from "../theme/tokens";
import { FONT } from "../theme/fonts";

export type InvoiceStatus = "draft" | "sent" | "seen" | "paid" | "settled" | "partially_paid" | "overdue" | "disputed";
export type AgentStatus = "proposed" | "approved" | "executed" | "rejected" | "escalated";

const INVOICE: Record<InvoiceStatus, { label: string; bg: string; fg: string; ring?: boolean }> = {
  draft: { label: "Draft", bg: C.paper2, fg: C.ink2, ring: true },
  sent: { label: "Sent", bg: C.paper2, fg: C.ink2 },
  seen: { label: "Payment seen", bg: C.seenBg, fg: C.seenFg },
  paid: { label: "Paid", bg: C.paidBg, fg: C.paidFg },
  settled: { label: "Settled", bg: C.settledBg, fg: C.settledFg },
  partially_paid: { label: "Partly paid", bg: C.partialBg, fg: C.partialFg },
  overdue: { label: "Overdue", bg: C.overdueBg, fg: C.overdueFg },
  disputed: { label: "Disputed", bg: C.disputedBg, fg: C.disputedFg },
};

const AGENT: Record<AgentStatus, { label: string; bg: string; fg: string }> = {
  proposed: { label: "Needs your approval", bg: C.partialBg, fg: C.partialFg },
  approved: { label: "Approved", bg: C.seenBg, fg: C.seenFg },
  executed: { label: "Done", bg: C.paidBg, fg: C.paidFg },
  rejected: { label: "Rejected", bg: C.paper2, fg: C.ink2 },
  escalated: { label: "Escalated to you", bg: C.overdueBg, fg: C.overdueFg },
};

/** A dot and a word. `live` pulses the dot (the product's "seen" ping), driven by the frame. */
const Pill: React.FC<{ label: string; bg: string; fg: string; ring?: boolean; live?: boolean; scale?: number; style?: React.CSSProperties }> = ({ label, bg, fg, ring, live, scale = 1, style }) => {
  const frame = useCurrentFrame();
  const ping = live ? (frame % 30) / 30 : 0;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6 * scale,
        height: 24 * scale,
        padding: `0 ${10 * scale}px 0 ${8 * scale}px`,
        borderRadius: R.full,
        background: bg,
        color: fg,
        fontFamily: FONT,
        fontSize: 13 * scale,
        fontWeight: 500,
        lineHeight: 1,
        whiteSpace: "nowrap",
        boxShadow: ring ? `inset 0 0 0 1px ${C.line}` : undefined,
        ...style,
      }}
    >
      <span style={{ position: "relative", display: "inline-flex", width: 6 * scale, height: 6 * scale }}>
        {live ? <span style={{ position: "absolute", inset: 0, borderRadius: R.full, background: "currentColor", opacity: 0.6 * (1 - ping), scale: `${1 + ping * 2.2}` }} /> : null}
        <span style={{ position: "relative", width: 6 * scale, height: 6 * scale, borderRadius: R.full, background: "currentColor" }} />
      </span>
      {label}
    </span>
  );
};

export const StatusPill: React.FC<{ status: InvoiceStatus; scale?: number; style?: React.CSSProperties }> = ({ status, scale, style }) => (
  <Pill {...INVOICE[status]} live={status === "seen"} scale={scale} style={style} />
);

export const AgentStatusPill: React.FC<{ status: AgentStatus; scale?: number; style?: React.CSSProperties }> = ({ status, scale, style }) => (
  <Pill {...AGENT[status]} scale={scale} style={style} />
);

/** Neutral chip for small facts: a rule id, a token, "Verified on Solana". */
export const Chip: React.FC<{ children: React.ReactNode; tone?: "neutral" | "accent" | "hero"; scale?: number; style?: React.CSSProperties }> = ({ children, tone = "neutral", scale = 1, style }) => {
  const look =
    tone === "accent"
      ? { background: C.accentSoft, color: C.accent }
      : tone === "hero"
        ? { background: C.heroFill, color: C.onHero, boxShadow: `inset 0 0 0 1px ${C.heroLine}` }
        : { background: C.paper2, color: C.ink2 };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4 * scale,
        height: 24 * scale,
        padding: `0 ${10 * scale}px`,
        borderRadius: R.full,
        fontFamily: FONT,
        fontSize: 12 * scale,
        fontWeight: 500,
        whiteSpace: "nowrap",
        lineHeight: 1,
        ...look,
        ...style,
      }}
    >
      {children}
    </span>
  );
};
