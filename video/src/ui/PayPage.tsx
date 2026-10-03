import type React from "react";
import { Moon, Wallet } from "lucide-react";
import { C, R, SHADOW, avatarTint, initials } from "../theme/tokens";
import { FONT, TABULAR } from "../theme/fonts";
import { Button, Card, CompanyAvatar, Inset } from "./Card";
import { KutipMark } from "./Mark";
import { StatusPill } from "./Pills";
import { UsdcFigure } from "./Money";
import { Qr } from "./Qr";
import { APP_HTTPS, DEMO } from "../data/proof";

/**
 * The buyer's pay page, recreated from apps/web/components/pay/pay-card.tsx and the
 * docs/screenshots/v2/pay-light-mobile.png screenshot, at its native 375px width.
 * `stage`: "document" (Amount due + Confirm and pay) or "qr" (Pay 11,437.50 USDC + QR + Open in wallet).
 */
export const PayPage: React.FC<{ stage: "document" | "qr"; token?: "USDC" | "SOL"; style?: React.CSSProperties }> = ({ stage, token = "USDC", style }) => {
  const inv = DEMO.invoice0142;
  const tint = avatarTint(DEMO.exporter);
  const solanaPayUrl = `solana:${encodeURIComponent(`${APP_HTTPS}/api/pay/inv_0142${token === "SOL" ? "?token=SOL" : ""}`)}`;
  return (
    <div style={{ width: 375, minHeight: 812, background: C.paper, fontFamily: FONT, color: C.ink, padding: "0 16px 24px", ...style }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 15, fontWeight: 500 }}>
          <KutipMark size={22} /> Secure payment via Kutip
        </span>
        <Moon size={16} color={C.ink2} />
      </div>

      {stage === "document" ? (
        <>
          <Card style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <CompanyAvatar name={initials(DEMO.exporter)} size={40} bg={tint.bg} fg={tint.fg} />
              <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em" }}>{DEMO.exporter}</span>
            </div>
            <div style={{ marginTop: 14, textAlign: "right" }}>
              <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.04em", color: C.ink3 }}>INVOICE</div>
              <div style={{ fontSize: 15, fontWeight: 500, ...TABULAR }}>{inv.number}</div>
              <StatusPill status="overdue" style={{ marginTop: 6 }} />
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 13, color: C.ink3 }}>Billed to</div>
              <div style={{ fontSize: 15 }}>{inv.buyer}</div>
            </div>
            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr" }}>
              <div>
                <div style={{ fontSize: 13, color: C.ink3 }}>Issued</div>
                <div style={{ fontSize: 15 }}>{inv.issued}</div>
              </div>
              <div>
                <div style={{ fontSize: 13, color: C.ink3 }}>Due</div>
                <div style={{ fontSize: 15, color: C.overdueFg }}>{inv.due}</div>
              </div>
            </div>
            <table style={{ width: "100%", marginTop: 18, borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ color: C.ink2, fontSize: 13 }}>
                  <th style={{ textAlign: "left", fontWeight: 500, padding: "0 0 8px" }}>Item</th>
                  <th style={{ textAlign: "right", fontWeight: 500, padding: "0 0 8px" }}>Qty</th>
                  <th style={{ textAlign: "right", fontWeight: 500, padding: "0 0 8px" }}>Amount, USD</th>
                </tr>
              </thead>
              <tbody>
                {inv.items.map((it) => (
                  <tr key={it.item} style={{ borderTop: `1px solid ${C.line}` }}>
                    <td style={{ padding: "10px 0" }}>{it.item}</td>
                    <td style={{ padding: "10px 0", textAlign: "right", color: C.ink2, ...TABULAR }}>{it.qty}</td>
                    <td style={{ padding: "10px 0", textAlign: "right", fontWeight: 600, ...TABULAR }}>{it.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card style={{ marginTop: 16, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: C.ink2 }}>Amount due</div>
            <UsdcFigure value={inv.usdc} size={44} style={{ marginTop: 4, display: "block" }} />
            <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.45, color: C.ink2 }}>Pay with USDC, or SOL converted on the spot. No gas fee: the amount shown is the amount that arrives.</p>
            <Button variant="secondary" size="lg" style={{ marginTop: 20, width: "100%" }}>
              Confirm and pay
            </Button>
            <p style={{ margin: "12px 0 0", textAlign: "center", fontSize: 13, lineHeight: 1.45, color: C.ink3 }}>Next: scan a QR or open your wallet. Nothing is charged until you approve there.</p>
          </Card>
        </>
      ) : (
        <Card style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>Pay {inv.usdc} USDC</span>
            <span style={{ display: "inline-flex", padding: 3, borderRadius: R.full, background: C.paper2, fontSize: 12, fontWeight: 500 }}>
              {(["USDC", "SOL"] as const).map((t) => (
                <span key={t} style={{ padding: "4px 10px", borderRadius: R.full, background: t === token ? C.surface : "transparent", boxShadow: t === token ? SHADOW.pill : undefined, color: t === token ? C.ink : C.ink2 }}>
                  {t}
                </span>
              ))}
            </span>
          </div>
          <Inset style={{ margin: "16px auto 0", width: 224, padding: 12 }}>
            <div style={{ borderRadius: R.sm, background: C.surface, padding: 8 }}>
              <Qr value={solanaPayUrl} size={184} />
            </div>
          </Inset>
          <p style={{ margin: "8px 0 0", textAlign: "center", fontSize: 14, color: C.ink2 }}>Scan with Phantom or Solflare</p>
          <Button variant="primary" size="lg" style={{ marginTop: 16, width: "100%" }}>
            <Wallet size={18} /> Open in wallet
          </Button>
          <div style={{ marginTop: 20, borderTop: `1px solid ${C.line}`, fontSize: 14 }}>
            {[
              ["Pay with", "USDC, SOL, USDT", "SOL and USDT convert automatically"],
              ["Network fee", "None", "Kutip pays it. You need 0 SOL for gas."],
              ["Goes to", DEMO.exporter, "Their own account, not Kutip's"],
            ].map(([k, v, hint]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "10px 0", borderBottom: `1px solid ${C.line}` }}>
                <span style={{ color: C.ink2, flexShrink: 0 }}>{k}</span>
                <span style={{ textAlign: "right" }}>
                  {v}
                  <span style={{ display: "block", fontSize: 12, color: C.ink3 }}>{hint}</span>
                </span>
              </div>
            ))}
          </div>
          <p style={{ margin: "12px 0 0", fontSize: 12, color: C.ink3 }}>This page updates by itself when your payment arrives.</p>
        </Card>
      )}
    </div>
  );
};
