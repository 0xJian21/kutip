import { Address } from "@/components/ui/address";
import { Card, CardHeader, Inset } from "@/components/ui/card";
import { Amount } from "@/components/ui/money";
import { Facts } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import { bpsDiff, formatBps, formatRate, formatSol, formatUsdc, formatUsdcExact, toMyr } from "@/lib/ui/money";
import { formatDateTime } from "@/lib/ui/format";
import type { BnmRate, Invoice, Payment } from "@/lib/ui/types";

function paidLine(p: Payment): string {
  if (p.inputMint === "SOL" && p.inputAmount !== undefined) return `${formatSol(p.inputAmount)} SOL`;
  if (p.inputMint === "USDT" && p.inputAmount !== undefined) return `${formatUsdc(p.inputAmount)} USDT`;
  return `${formatUsdc(p.amount)} USDC`;
}

/**
 * Execution receipt. What the buyer paid, what landed (to six decimals),
 * how the swap executed against its quote, and the ringgit value at the BNM rate.
 */
export function ReceiptCard({ payment, invoice, rate }: { payment: Payment; invoice: Invoice; rate: BnmRate }) {
  const swapped = payment.inputMint !== undefined && payment.inputAmount !== undefined;
  const slippage = swapped && payment.quotedInput ? bpsDiff(payment.quotedInput, payment.inputAmount!) : null;
  const myr = toMyr(payment.amount, rate);
  const final = payment.commitment === "finalized";
  const title = final ? "Payment received" : payment.commitment === "confirmed" ? "Payment received, becoming final" : "Payment seen, checking";

  return (
    <Card>
      <CardHeader title={title} aside={<StatusPill status={final ? "settled" : payment.commitment === "confirmed" ? "paid" : "seen"} />} />
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <Amount sen={myr} size="lg" />
        <div className="text-sm tabular text-ink-2">at BNM reference rate {formatRate(rate)}</div>
      </div>
      <Facts
        className="mt-4"
        items={[
          { label: swapped ? `Buyer paid in ${payment.inputMint}` : "Buyer paid", value: paidLine(payment) },
          { label: "You received, exactly", value: `${formatUsdcExact(payment.amount)} USDC` },
          ...(swapped && payment.quotedInput
            ? [
                { label: `Quoted ${payment.inputMint} at payment time`, value: `${formatSol(payment.quotedInput)} ${payment.inputMint}`, muted: true },
                {
                  label: "Execution vs quote",
                  value: (
                    <span className={slippage !== null && slippage < 0n ? "text-overdue-fg" : "text-paid-fg"}>
                      {slippage !== null ? formatBps(slippage) : "—"}
                      <span className="text-ink-3"> (buyer side)</span>
                    </span>
                  ),
                },
              ]
            : []),
          { label: "Invoice amount", value: `${formatUsdc(invoice.amountUsdc)} USD`, muted: true },
          { label: "Network fee", value: <span>paid by Kutip <span className="text-ink-3">· buyer paid 0 SOL</span></span>, muted: true },
          { label: "Received via", value: payment.via === "x402" ? "x402 (buyer's AP system)" : "Pay link", muted: true },
          ...(payment.issues.length ? [{ label: "Note", value: <span className="text-partial-fg">{payment.issues.join("; ")}</span> }] : []),
        ]}
      />
      <Inset className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm text-ink-2">
        <span className="tabular">
          {final && payment.finalizedAt ? `Final ${formatDateTime(payment.finalizedAt)} MYT` : `Seen ${formatDateTime(payment.observedAt)} MYT`}
          <span className="text-ink-3"> · slot {payment.slot.toLocaleString("en-MY")}</span>
        </span>
        <Address value={payment.signature} kind="tx" label="View on Solscan" />
      </Inset>
    </Card>
  );
}
