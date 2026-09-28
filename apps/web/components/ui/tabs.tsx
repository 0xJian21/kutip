"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export type TabItem<V extends string = string> = { value: V; label: ReactNode; count?: number; href?: string; countTone?: "default" | "warn" };

/**
 * Two shapes of tab, one vocabulary:
 * - "segmented": a grey track with a white active segment (view switches, pay-in token, period).
 * - "pills": free-standing pills, active one solid ink (status filters, top-level nav).
 * Items with `href` render as links; otherwise `onChange` fires.
 */
export function Tabs<V extends string>({
  items,
  value,
  onChange,
  variant = "pills",
  size = "md",
  label,
  className = "",
}: {
  items: TabItem<V>[];
  value: V;
  onChange?: (v: V) => void;
  variant?: "segmented" | "pills";
  size?: "sm" | "md";
  label: string;
  className?: string;
}) {
  const h = size === "sm" ? "h-8 px-3 text-sm" : "h-9 px-3.5 text-base";
  const track = variant === "segmented" ? "inline-flex rounded-full bg-paper-2 p-1" : "flex flex-wrap gap-1.5";
  const seg = (active: boolean) =>
    variant === "segmented"
      ? active
        ? "bg-surface text-ink shadow-pill"
        : "text-ink-2 hover:text-ink"
      : active
        ? "bg-ink text-paper"
        : "bg-surface text-ink-2 shadow-pill hover:text-ink";
  return (
    <nav aria-label={label} className={className}>
      <ul className={track}>
        {items.map((it) => {
          const active = it.value === value;
          const cls = `inline-flex ${h} items-center gap-1.5 whitespace-nowrap rounded-full font-medium transition-colors duration-(--dur-fast) ${seg(active)}`;
          const count =
            it.count !== undefined ? (
              <span className={`tabular text-xs ${active ? (variant === "pills" ? "text-paper/70" : "text-ink-3") : it.countTone === "warn" && it.count > 0 ? "text-overdue-fg" : "text-ink-3"}`}>{it.count}</span>
            ) : null;
          return (
            <li key={it.value}>
              {it.href ? (
                <Link href={it.href} aria-current={active ? "page" : undefined} className={cls}>
                  {it.label}
                  {count}
                </Link>
              ) : (
                <button type="button" aria-pressed={active} onClick={() => onChange?.(it.value)} className={cls}>
                  {it.label}
                  {count}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
