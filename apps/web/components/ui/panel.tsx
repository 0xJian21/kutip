import type { ReactNode } from "react";
import { Card, CardHeader } from "./card";

/**
 * Panel = Card with an optional title row. Kept for the screens that predate
 * the Session 8 redesign; new screens compose Card + CardHeader directly.
 */
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
  const hasHeader = Boolean(title || aside);
  return (
    <Card className={`overflow-hidden ${className}`} padded={false}>
      {hasHeader ? <CardHeader title={title} aside={aside} className="px-5 pt-5 sm:px-6 sm:pt-6" /> : null}
      <div className={padded ? `px-5 pb-5 sm:px-6 sm:pb-6 ${hasHeader ? "pt-4" : "pt-5 sm:pt-6"}` : hasHeader ? "pt-4" : ""}>{children}</div>
    </Card>
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
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {lede ? <p className="mt-1.5 max-w-[65ch] text-base text-ink-2">{lede}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Definition list used by receipts and detail cards. */
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
        <div key={i} className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-4 py-2.5 first:pt-0 last:pb-0">
          <dt className="text-base text-ink-2">{it.label}</dt>
          <dd className={`min-w-0 text-right tabular ${it.muted ? "text-ink-2" : "text-ink"}`}>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
