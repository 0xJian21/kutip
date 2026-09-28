"use client";

import { useState, type ReactNode } from "react";

/*
  Chart primitives. Plain SVG and CSS, no library. One hue (accent) per chart:
  solid where money has landed, hatched where it hasn't, grey where nothing happened.
  Every chart has a visible label per mark and a tooltip pill on hover; nothing is colour-alone.
*/

/** Rounded tooltip pill, positioned by the parent. */
export function TipPill({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`pointer-events-none inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full bg-surface px-2.5 text-xs font-medium text-ink shadow-float ${className}`}>
      {children}
    </span>
  );
}

export type FunnelStage = { key: string; label: string; short?: string; value: number; display: string; hint?: string };

/**
 * Collections funnel: Sent → Seen → Paid → Settled as a stepped area (ref 01).
 * `emphasis` is the stage to draw solid; the others are hatched. Values are counts
 * or amounts in any unit; only their ratios matter.
 */
export function Funnel({ stages, emphasis, height = 160, className = "" }: { stages: FunnelStage[]; emphasis?: string; height?: number; className?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...stages.map((s) => s.value));
  const n = stages.length;
  const top = (v: number) => 100 - (v / max) * 100;
  const isOn = (i: number) => hover === i || (hover === null && stages[i]!.key === emphasis);

  return (
    <div className={`relative ${className}`}>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {stages.map((s, i) => (
          <div key={s.key} className={`min-w-0 border-l border-line pl-2 first:border-l-0 first:pl-0 sm:pl-3 ${isOn(i) ? "" : "opacity-70"}`}>
            <div className="truncate text-xs text-ink-2 sm:text-sm">{s.short ? <><span className="sm:hidden">{s.short}</span><span className="hidden sm:inline">{s.label}</span></> : s.label}</div>
            <div className={`money truncate text-md leading-6 sm:text-money-md ${isOn(i) ? "text-ink" : "text-ink-3"}`}>{s.display}</div>
          </div>
        ))}
      </div>
      {/* Each column is a flat step that slopes down to the next column's height over its last 22%. */}
      <div className="relative mt-3 flex" style={{ height }}>
        {stages.map((s, i) => {
          const y0 = top(s.value);
          const y1 = i < n - 1 ? top(stages[i + 1]!.value) : y0;
          const clip = `polygon(0% ${y0}%, 78% ${y0}%, 100% ${y1}%, 100% 100%, 0% 100%)`;
          const on = isOn(i);
          return (
            <button
              key={s.key}
              type="button"
              tabIndex={-1}
              aria-label={`${s.label}: ${s.display}${s.hint ? `, ${s.hint}` : ""}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className="relative min-w-0 flex-1 cursor-default outline-none"
            >
              <span
                aria-hidden="true"
                className={`absolute inset-0 transition-colors duration-(--dur-fast) ${on ? "bg-linear-to-b from-accent to-accent/55" : "hatch bg-accent/8 text-accent/70"}`}
                style={{ clipPath: clip }}
              />
              {hover === i ? (
                <TipPill className="absolute left-1/2 top-2 -translate-x-1/2">
                  <span className="text-ink">{s.display}</span>
                  {s.hint ? <span className="text-ink-3">{s.hint}</span> : null}
                </TipPill>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export type DotColumn = { key: string; label: string; value: number; display?: string };

/**
 * Dot-matrix column chart (ref 05): one column of dots per period, the peak
 * column solid, the rest soft. Rows = dot resolution.
 */
export function DotMatrix({ columns, rows = 8, peakLabel = "Peak", className = "" }: { columns: DotColumn[]; rows?: number; peakLabel?: string; className?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...columns.map((c) => c.value));
  const peak = columns.reduce((best, c, i) => (c.value > columns[best]!.value ? i : best), 0);
  return (
    <div className={`relative pt-9 ${className}`}>
      <div className="flex items-end gap-1.5 sm:gap-2">
        {columns.map((c, i) => {
          const filled = c.value <= 0 ? 0 : Math.max(1, Math.round((c.value / max) * rows));
          const on = hover === i || (hover === null && i === peak);
          return (
            <button
              key={c.key}
              type="button"
              tabIndex={-1}
              aria-label={`${c.label}: ${c.display ?? c.value}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              className="relative flex flex-1 cursor-default flex-col-reverse items-center gap-1 outline-none"
            >
              {Array.from({ length: rows }).map((_, r) => (
                <span
                  key={r}
                  aria-hidden="true"
                  className={`block h-2.5 w-2.5 rounded-full transition-colors duration-(--dur-fast) ${
                    r < filled ? (on ? "bg-accent" : "bg-accent/35") : "bg-paper-2"
                  }`}
                />
              ))}
              {hover === i || (hover === null && i === peak) ? (
                <TipPill className="absolute -top-9 left-1/2 -translate-x-1/2">
                  {hover === null ? <span className="text-ink-3">{peakLabel}:</span> : null}
                  <span>{c.display ?? c.label}</span>
                </TipPill>
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5 sm:gap-2">
        {columns.map((c) => (
          <span key={c.key} className="flex-1 truncate text-center text-xs tabular text-ink-3">
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Meter: a hatched fill on a quiet track. For a limit ("swept today of the daily cap")
 * or a share ("received of invoiced"). Fill colour follows `tone`.
 */
export function Meter({
  value,
  max,
  label,
  valueText,
  maxText,
  tone = "accent",
  className = "",
}: {
  value: number;
  max: number;
  label?: string;
  valueText?: string;
  maxText?: string;
  tone?: "accent" | "paid" | "hero";
  className?: string;
}) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100));
  const color = tone === "paid" ? "text-paid-fg" : tone === "hero" ? "text-on-hero" : "text-accent";
  const track = tone === "hero" ? "bg-hero-fill" : "bg-paper-2";
  const text = tone === "hero" ? "text-on-hero-2" : "text-ink-2";
  return (
    <div className={className}>
      {label || valueText ? (
        <div className={`mb-1.5 flex items-baseline justify-between gap-3 text-sm ${text}`}>
          <span>{label}</span>
          <span className="tabular">
            {valueText ? <span className={tone === "hero" ? "font-semibold text-on-hero" : "font-semibold text-ink"}>{valueText}</span> : null}
            {maxText ? <span> / {maxText}</span> : null}
          </span>
        </div>
      ) : null}
      <div className={`h-2.5 overflow-hidden rounded-full ${track}`} role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
        <div className={`hatch h-full rounded-full transition-[width] duration-(--dur-slow) ease-(--ease-out) ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export type SeriesPoint = { key: string; label: string; received: number; outstanding: number; receivedText: string; outstandingText: string };

/**
 * Received vs outstanding over time: one column per period, received solid at the
 * base, outstanding hatched above it, a 2px surface gap between them (dataviz spacer).
 * Two series, so the legend is always drawn.
 */
export function StackedColumns({ points, height = 140, className = "" }: { points: SeriesPoint[]; height?: number; className?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...points.map((p) => p.received + p.outstanding));
  return (
    <div className={className}>
      <div className="mb-3 flex items-center gap-4 text-xs text-ink-2">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px] bg-accent" />Received</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="hatch h-2.5 w-2.5 rounded-[3px] bg-accent/10 text-accent" />Outstanding</span>
      </div>
      <div className="flex items-end gap-2 pt-9 sm:gap-3" style={{ height: height + 36 }}>
        {points.map((p, i) => {
          const r = (p.received / max) * 100;
          const o = (p.outstanding / max) * 100;
          const on = hover === i;
          return (
            <button
              key={p.key}
              type="button"
              tabIndex={-1}
              aria-label={`${p.label}: received ${p.receivedText}, outstanding ${p.outstandingText}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              className="relative flex h-full flex-1 cursor-default flex-col justify-end outline-none"
            >
              <span className="mx-auto flex w-full max-w-6 flex-col justify-end gap-0.5" style={{ height: "100%" }}>
                {o > 0 ? <span className={`hatch w-full rounded-t-[4px] bg-accent/10 text-accent transition-opacity ${on ? "" : "opacity-80"}`} style={{ height: `${o}%` }} /> : null}
                <span className={`w-full ${o > 0 ? "" : "rounded-t-[4px]"} bg-accent transition-opacity ${on ? "" : "opacity-85"}`} style={{ height: `${r}%` }} />
              </span>
              {on ? (
                <TipPill className="absolute -top-9 left-1/2 -translate-x-1/2">
                  <span>{p.receivedText}</span>
                  <span className="text-ink-3">+ {p.outstandingText} open</span>
                </TipPill>
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2 sm:gap-3">
        {points.map((p) => (
          <span key={p.key} className="flex-1 truncate text-center text-xs tabular text-ink-3">{p.label}</span>
        ))}
      </div>
    </div>
  );
}
