import type { ReactNode } from "react";

/**
 * A card is a white surface on the grey canvas. One idea per card; never nest one in another.
 * `inset` is the grey well inside a card (QR, invoice paper, code).
 */
export function Card({
  children,
  className = "",
  padded = true,
  as: Tag = "section",
  id,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  as?: "section" | "div" | "article" | "aside";
  id?: string;
}) {
  return <Tag id={id} className={`min-w-0 rounded-xl bg-surface shadow-card ${padded ? "p-5 sm:p-6" : ""} ${className}`}>{children}</Tag>;
}

/** Title row for a card. `aside` takes a link, a pill, a menu button or a short caption. */
export function CardHeader({
  title,
  caption,
  aside,
  className = "",
}: {
  title: ReactNode;
  caption?: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`flex items-start justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
        {caption ? <p className="mt-0.5 text-sm text-ink-2">{caption}</p> : null}
      </div>
      {aside ? <div className="flex shrink-0 items-center gap-2 text-sm text-ink-2">{aside}</div> : null}
    </header>
  );
}

/** Grey well inside a card. */
export function Inset({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`min-w-0 rounded-lg bg-well ${className}`}>{children}</div>;
}

/** The one gradient surface: the treasury hero. Everything inside it uses on-hero tokens. */
export function HeroCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`hero-surface relative overflow-hidden rounded-2xl p-6 sm:p-7 ${className}`}>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-hero-fill blur-2xl"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 -left-10 h-56 w-56 rounded-full bg-hero-fill blur-3xl"
      />
      <div className="relative">{children}</div>
    </section>
  );
}
