import type { ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Amount } from "./money";
import { formatUsdc, toMyr, type BnmRate } from "@/lib/ui/money";

/**
 * Signed change pill. `good` says whether up is good (received) or bad (overdue);
 * colour follows direction × good, so a rising overdue figure reads as a warning.
 */
export function Delta({ bps, good = true, label, className = "" }: { bps: bigint; good?: boolean; label?: string; className?: string }) {
  const up = bps > 0n;
  const flat = bps === 0n;
  const abs = up ? bps : -bps;
  const pct = `${(Number(abs) / 100).toFixed(1)}%`;
  const positive = flat ? null : up === good;
  const tone = flat ? "bg-paper-2 text-ink-2" : positive ? "bg-paid-bg text-paid-fg" : "bg-overdue-bg text-overdue-fg";
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full px-2 text-xs font-semibold tabular ${tone} ${className}`} title={label}>
      {flat ? null : <Icon size={12} strokeWidth={2.5} aria-hidden="true" />}
      {flat ? "0.0%" : `${up ? "+" : "−"}${pct}`}
      {label ? <span className="sr-only"> {label}</span> : null}
    </span>
  );
}

/**
 * KPI tile: label, ringgit figure, USD line, optional delta and a footer slot
 * (a link, a count, a caption). Used in a row of four on the dashboard.
 */
export function Stat({
  label,
  usdc,
  rate,
  delta,
  deltaGood,
  deltaLabel,
  footer,
  size = "md",
  className = "",
}: {
  label: string;
  usdc: bigint;
  rate: BnmRate;
  delta?: bigint;
  deltaGood?: boolean;
  deltaLabel?: string;
  footer?: ReactNode;
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 flex-col ${className}`}>
      <span className="text-sm font-medium text-ink-2">{label}</span>
      <Amount sen={toMyr(usdc, rate)} size={size === "lg" ? "xl" : "md"} className="mt-2.5" />
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm tabular text-ink-3">
        <span>{formatUsdc(usdc)} USD</span>
        {delta !== undefined ? <Delta bps={delta} good={deltaGood} label={deltaLabel} /> : null}
      </div>
      {footer ? <div className="mt-3 text-sm">{footer}</div> : null}
    </div>
  );
}
