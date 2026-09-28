import { formatMyr, formatRate, formatUsdc, toMyr, type BnmRate } from "@/lib/ui/money";

type Size = "sm" | "md" | "lg" | "xl" | "2xl";

// The two display sizes step down one notch under 640px so a 13-digit ringgit figure fits a phone.
const SIZE_CLASS: Record<Size, string> = {
  sm: "text-money-sm",
  md: "text-money-md",
  lg: "text-money-lg",
  xl: "text-money-lg sm:text-money-xl",
  "2xl": "text-money-xl sm:text-money-2xl",
};

/**
 * A ringgit amount as one figure: bold integer, muted decimals, small "RM".
 * `tone="hero"` puts it on the gradient card.
 */
export function Amount({
  sen,
  size = "lg",
  tone = "ink",
  className = "",
}: {
  sen: bigint;
  size?: Size;
  tone?: "ink" | "hero";
  className?: string;
}) {
  const [int, frac] = formatMyr(sen, { symbol: false }).split(".");
  const main = tone === "hero" ? "text-on-hero" : "text-ink";
  const soft = tone === "hero" ? "text-on-hero-2" : "text-ink-3";
  return (
    <span className={`money inline-flex items-baseline whitespace-nowrap ${SIZE_CLASS[size]} ${main} ${className}`}>
      <span className={`mr-[0.18em] text-[0.5em] font-semibold tracking-normal ${soft}`}>RM</span>
      <span>{int}</span>
      <span className={soft}>.{frac}</span>
    </span>
  );
}

/**
 * Ringgit first and large, USD second and small, the BNM rate as a footnote.
 */
export function MoneyFigure({
  usdc,
  rate,
  size = "lg",
  label,
  align = "left",
  footnote = true,
  tone = "ink",
  className = "",
}: {
  usdc: bigint;
  rate: BnmRate;
  size?: Size;
  label?: string;
  align?: "left" | "right" | "center";
  /** "at BNM reference rate x" under the USD line. Once per screen is enough. */
  footnote?: boolean;
  tone?: "ink" | "hero";
  className?: string;
}) {
  const myr = toMyr(usdc, rate);
  const alignClass = align === "right" ? "items-end text-right" : align === "center" ? "items-center text-center" : "items-start";
  const labelClass = tone === "hero" ? "text-on-hero-2" : "text-ink-2";
  const subClass = tone === "hero" ? "text-on-hero-2" : "text-ink-2";
  const noteClass = tone === "hero" ? "text-on-hero-2/80" : "text-ink-3";
  return (
    <div className={`flex flex-col ${alignClass} ${className}`}>
      {label ? <div className={`mb-1.5 text-sm font-medium ${labelClass}`}>{label}</div> : null}
      <Amount sen={myr} size={size} tone={tone} />
      <div className={`mt-1.5 text-base tabular ${subClass}`}>
        {formatUsdc(usdc)} USD
        {footnote ? <span className={noteClass}> · BNM rate {formatRate(rate)}</span> : null}
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
      <span className={`whitespace-nowrap tabular ${className}`}>
        <span className="font-semibold text-ink">{formatMyr(myr)}</span>
        <span className="text-ink-3"> · {formatUsdc(usdc)} USD</span>
      </span>
    );
  }
  return (
    <span className={`inline-flex flex-col items-end whitespace-nowrap tabular ${className}`}>
      <span className="font-semibold text-ink">{formatMyr(myr)}</span>
      <span className="text-sm text-ink-3">{formatUsdc(usdc)} USD</span>
    </span>
  );
}
