import type { ReactNode } from "react";

/** One idea per panel. Never nest a panel inside a panel. */
export function Panel({
  title,
  aside,
  children,
  className = "",
  padded = true,
}: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={`rounded-md border border-line bg-surface ${className}`}>
      {title || aside ? (
        <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-3 sm:px-6">
          <h2 className="text-lg font-medium text-ink">{title}</h2>
          {aside ? <div className="text-sm text-ink-2">{aside}</div> : null}
        </header>
      ) : null}
      <div className={padded ? "px-4 py-4 sm:px-6 sm:py-5" : ""}>{children}</div>
    </section>
  );
}

export function PageHeader({
  title,
  lede,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1 text-sm text-ink-2">{eyebrow}</div> : null}
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {lede ? <p className="mt-1 max-w-[65ch] text-base text-ink-2">{lede}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Definition list used by receipts and detail panels. */
export function Facts({
  items,
  className = "",
}: {
  items: Array<{ label: ReactNode; value: ReactNode; muted?: boolean }>;
  className?: string;
}) {
  return (
    <dl className={`divide-y divide-line ${className}`}>
      {items.map((it, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 py-2.5 first:pt-0 last:pb-0">
          <dt className="text-base text-ink-2">{it.label}</dt>
          <dd className={`text-right tabular ${it.muted ? "text-ink-2" : "text-ink"}`}>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
