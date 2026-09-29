import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Rows that end with an amount and a status (recent payments, needs you, invoices on phones,
 * inbox threads). Every row is a subgrid of the list, so the amount and status columns share
 * one width across rows: amounts right-align in a column and the status sits last, flush right,
 * vertically centred, however long a name is. On phones the amount and status stack at the right.
 * `stacked`: amount over status at every width, for narrow cards (pass it to each RowItem too).
 */
export function RowList({ children, label, stacked = false, className = "" }: { children: ReactNode; label?: string; stacked?: boolean; className?: string }) {
  return (
    <ul aria-label={label} className={`grid grid-cols-[auto_minmax(0,1fr)_auto] divide-y divide-line ${stacked ? "" : "sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]"} ${className}`}>
      {children}
    </ul>
  );
}

export function RowItem({
  lead,
  children,
  amount,
  status,
  href,
  onClick,
  selected = false,
  stacked = false,
  className = "",
}: {
  lead?: ReactNode;
  /** Title and meta lines. A title link here is stretched over the row when `href` is set. */
  children: ReactNode;
  amount?: ReactNode;
  status?: ReactNode;
  href?: string;
  onClick?: () => void;
  selected?: boolean;
  stacked?: boolean;
  className?: string;
}) {
  return (
    <li
      className={`relative col-span-full grid grid-cols-subgrid items-center gap-x-3 px-5 py-3 transition-colors duration-(--dur-fast) sm:gap-x-4 sm:px-6 ${href || onClick ? "hover:bg-paper-2/50" : ""} ${selected ? "bg-accent-soft/60" : ""} ${className}`}
    >
      <div className="self-start pt-0.5">{lead}</div>
      <div className="min-w-0">
        {href ? (
          <Link href={href} onClick={onClick} className="block min-w-0 after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-md focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent">
            {children}
          </Link>
        ) : onClick ? (
          <button type="button" onClick={onClick} aria-current={selected ? "true" : undefined} className="block w-full min-w-0 text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-md focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent">
            {children}
          </button>
        ) : (
          children
        )}
      </div>
      {/* Phones: one column, amount over status. From 640px: `contents`, so each is its own column. */}
      <div className={`flex flex-col items-end gap-1.5 ${stacked ? "" : "sm:contents"}`}>
        {amount !== undefined ? <div className="text-right">{amount}</div> : stacked ? null : <div className="hidden sm:block" />}
        {status !== undefined ? <div className="flex justify-end">{status}</div> : stacked ? null : <div className="hidden sm:block" />}
      </div>
    </li>
  );
}
