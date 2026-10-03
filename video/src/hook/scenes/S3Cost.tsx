import type React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, R } from "../../theme/tokens";
import { TABULAR } from "../../theme/fonts";
import { beat, HOOK } from "../../lib/beat";
import { liftOut, useLayout } from "../../lib/anim";
import { Chip } from "../../ui/Pills";
import { DEMO, WIRE } from "../../data/proof";
import { Caption, Giant, GreyWorld, Line } from "./shared";

/** "Three days for the wire. ~RM150 in fees (est.). A spreadsheet of who still owes." */
export const S3Cost: React.FC = () => {
  const frame = useCurrentFrame();
  const { gutter, k, portrait, height, width } = useLayout();
  const t0 = 0;
  const t1 = beat(HOOK.s3Fees - HOOK.s3Days);
  const t2 = beat(HOOK.s3Sheet - HOOK.s3Days);
  const giant = portrait ? 230 : 300;
  const top = portrait ? height * 0.2 : height * 0.26;
  const rows = DEMO.overdue;
  return (
    <GreyWorld>
      {/* 1. 3 days */}
      <div style={{ position: "absolute", left: gutter, top, ...liftOut(frame, t1, 8, -40) }}>
        <Giant size={giant} from={t0}>{WIRE.daysShort}</Giant>
        <Line from={t0 + 6} size={64} color={C.ink2} weight={500} style={{ marginTop: 20 * k }}>for the wire.</Line>
      </div>
      {/* 2. ~RM150 est. */}
      {frame >= t1 ? (
        <div style={{ position: "absolute", left: gutter, top, ...liftOut(frame, t2, 8, -40) }}>
          <Giant size={giant} from={t1} style={{ ...TABULAR }}>{WIRE.feesHook}</Giant>
          <div style={{ display: "flex", alignItems: "center", gap: 24 * k, marginTop: 20 * k }}>
            <Line from={t1 + 6} size={64} color={C.ink2} weight={500}>in fees.</Line>
            <div style={{ opacity: interpolate(frame, [t1 + 10, t1 + 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
              <Chip scale={3.2 * k}>est.</Chip>
            </div>
          </div>
          <Caption from={t1 + 14} style={{ marginTop: 24 * k }}>Estimate of typical Malaysian bank charges for an inbound USD transfer, both banks.</Caption>
        </div>
      ) : null}
      {/* 3. The spreadsheet */}
      {frame >= t2 ? (
        <div style={{ position: "absolute", left: gutter, right: gutter, top: portrait ? height * 0.14 : height * 0.18 }}>
          <Line from={t2} size={portrait ? 84 : 96}>A spreadsheet of who still owes.</Line>
          <div style={{ marginTop: 40 * k, borderRadius: R.md, background: C.surface, boxShadow: `inset 0 0 0 1px ${C.line}`, overflow: "hidden", fontSize: 26 * k, ...TABULAR, width: portrait ? "100%" : Math.min(1400, width - gutter * 2) }}>
            <div style={{ display: "grid", gridTemplateColumns: portrait ? "1.4fr 1fr 1fr" : "1.6fr 1fr 1fr 1fr", padding: `${12 * k}px ${24 * k}px`, background: C.paper2, color: C.ink2, fontSize: 20 * k, fontWeight: 500 }}>
              <span>Buyer</span>
              <span>Invoice</span>
              <span style={{ textAlign: "right" }}>USD</span>
              {portrait ? null : <span style={{ textAlign: "right" }}>Status</span>}
            </div>
            {rows.map((r, i) => {
              const at = t2 + 8 + i * 4;
              const p = interpolate(frame, [at, at + 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              return (
                <div key={r.number} style={{ display: "grid", gridTemplateColumns: portrait ? "1.4fr 1fr 1fr" : "1.6fr 1fr 1fr 1fr", padding: `${14 * k}px ${24 * k}px`, borderTop: `1px solid ${C.line}`, opacity: p, translate: `0px ${(1 - p) * 10}px` }}>
                  <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.buyer}</span>
                  <span style={{ color: C.ink2 }}>{r.number}</span>
                  <span style={{ textAlign: "right", fontWeight: 600 }}>{r.usd}</span>
                  {portrait ? null : <span style={{ textAlign: "right", color: C.ink2 }}>{r.status}</span>}
                </div>
              );
            })}
          </div>
          <Caption from={t2 + 30}>Seeded demo data from the Kutip dashboard. Chased by hand across four time zones.</Caption>
        </div>
      ) : null}
    </GreyWorld>
  );
};
