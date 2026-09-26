import { formatMyr, formatRate, formatUsdc, toMyr, type BnmRate } from "@/lib/ui/money";

type Size = "md" | "lg" | "xl" | "2xl";

const SIZE_CLASS: Record<Size, string> = {
  md: "text-money-md",
  lg: "text-money-lg",
  xl: "text-money-xl",
  "2xl": "text-money-2xl",
};

/**
 * The hero figure: ringgit first and large, USD second and small,
 * with the BNM reference rate as a quiet footnote.
 */
export function MoneyFigure({
  usdc,
  rate,
  size = "lg",
  label,
  align = "left",
  className = "",
}: {
  usdc: bigint;
  rate: BnmRate;
  size?: Size;
  label?: string;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  const myr = toMyr(usdc, rate);
  const alignClass = align === "right" ? "items-end text-right" : align === "center" ? "items-center text-center" : "items-start";
  return (
    <div className={`flex flex-col ${alignClass} ${className}`}>
      {label ? <div className="text-sm text-ink-2 mb-1">{label}</div> : null}
      <div className={`money ${SIZE_CLASS[size]} text-ink`}>
        <span className="text-[0.5em] font-medium align-baseline mr-1">RM</span>
        {formatMyr(myr, { symbol: false })}
      </div>
      <div className="mt-1 text-base tabular text-ink-2">
        {formatUsdc(usdc)} USD
        <span className="text-ink-3"> · at BNM reference rate {formatRate(rate)}</span>
      </div>
    </div>
  );
}

/** Inline amount for tables and rows: MYR bold, USD small under or beside. */
export function MoneyCell({
  usdc,
  rate,
  stacked = true,
  className = "",
}: {
  usdc: bigint;
  rate: BnmRate;
  stacked?: boolean;
  className?: string;
}) {
  const myr = toMyr(usdc, rate);
  if (!stacked) {
    return (
      <span className={`tabular ${className}`}>
        <span className="font-semibold text-ink">{formatMyr(myr)}</span>
        <span className="text-ink-3"> · {formatUsdc(usdc)} USD</span>
      </span>
    );
  }
  return (
    <span className={`inline-flex flex-col items-end tabular ${className}`}>
      <span className="font-semibold text-ink">{formatMyr(myr)}</span>
      <span className="text-sm text-ink-3">{formatUsdc(usdc)} USD</span>
    </span>
  );
}
