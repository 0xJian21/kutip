import type React from "react";
import { Check } from "lucide-react";
import { useCurrentFrame } from "remotion";
import { C, R, SHADOW } from "../theme/tokens";
import { FONT, TABULAR } from "../theme/fonts";
import { StatusPill, type InvoiceStatus } from "./Pills";
import { DEMO, TIMINGS } from "../data/proof";

/**
 * The landing hero's flip card (components/landing/payment-flip.tsx): INV-2026-0154 going
 * Payment seen → Paid → Settled at the measured mainnet gaps. `seenAt` is the frame the
 * payment is first seen; Paid lands 153 ms later and Settled 7.86 s later, in real time.
 */
export const FlipCard: React.FC<{ seenAt: number; scale?: number; style?: React.CSSProperties }> = ({ seenAt, scale = 1, style }) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const paidAt = seenAt + Math.round((TIMINGS.seenToPaidMs / 1000) * fps);
  const settledAt = seenAt + Math.round((TIMINGS.seenToSettledMs / 1000) * fps);
  const steps = [
    { status: "seen" as InvoiceStatus, label: "Payment seen", time: "0.00 s", at: seenAt },
    { status: "paid" as InvoiceStatus, label: "Paid", time: `+${(TIMINGS.seenToPaidMs / 1000).toFixed(2)} s`, at: paidAt },
    { status: "settled" as InvoiceStatus, label: "Settled", time: `+${(TIMINGS.seenToSettledMs / 1000).toFixed(2)} s`, at: settledAt },
  ];
  const reached = steps.filter((s) => frame >= s.at).length;
  const status: InvoiceStatus = reached === 0 ? "sent" : steps[reached - 1].status;
  return (
    <div style={{ width: 256 * scale, padding: 16 * scale, borderRadius: R.lg * scale, background: C.surface, boxShadow: `${SHADOW.float}, inset 0 0 0 1px ${C.line}`, fontFamily: FONT, color: C.ink, ...style }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 * scale }}>
        <span style={{ fontSize: 14 * scale, fontWeight: 600, ...TABULAR }}>{DEMO.invoice0154.number}</span>
        <StatusPill status={status} scale={scale} />
      </div>
      <p style={{ margin: `${8 * scale}px 0 0`, fontSize: 24 * scale, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.1, ...TABULAR }}>
        <span style={{ marginRight: 2 * scale, fontSize: 14 * scale, fontWeight: 600, color: C.ink2, letterSpacing: 0 }}>RM</span>4<span style={{ color: C.ink3 }}>.08</span>
      </p>
      <p style={{ margin: 0, fontSize: 12 * scale, color: C.ink3, ...TABULAR }}>{DEMO.invoice0154.usdcExact} USDC received. Buyer fee: 0</p>
      <ol style={{ margin: `${12 * scale}px 0 0`, padding: `${12 * scale}px 0 0`, borderTop: `1px solid ${C.line}`, listStyle: "none", display: "grid", gap: 6 * scale }}>
        {steps.map((s, i) => {
          const on = i < reached;
          return (
            <li key={s.status} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 * scale, color: on ? C.ink : C.ink3 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 * scale }}>
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16 * scale, height: 16 * scale, borderRadius: R.full, background: on ? C.accent : "transparent", color: C.onAccent, boxShadow: on ? undefined : `inset 0 0 0 1px ${C.lineStrong}` }}>
                  {on ? <Check size={10 * scale} strokeWidth={3} /> : null}
                </span>
                {s.label}
              </span>
              <span style={{ ...TABULAR }}>{on ? s.time : ""}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
