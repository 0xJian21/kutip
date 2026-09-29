import type { ComponentProps, ReactNode } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";

const CONTROL =
  "h-10 w-full min-w-0 rounded-md border border-line-strong bg-surface px-3.5 text-base text-ink placeholder:text-ink-3 transition-colors duration-(--dur-fast) hover:border-ink-3 focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/25 disabled:bg-paper-2 disabled:text-ink-3 disabled:hover:border-line-strong aria-invalid:border-disputed-fg aria-invalid:focus:ring-disputed-fg/25";

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className = "",
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    // content-start: a neighbour's hint or error must never stretch this field's rows and push its input down.
    <label className={`grid min-w-0 content-start gap-1.5 ${className}`}>
      <span className="text-sm font-medium text-ink">
        {label}
        {required ? <span className="text-accent"> *</span> : null}
      </span>
      {children}
      {error ? <span className="text-sm text-disputed-fg">{error}</span> : hint ? <span className="text-sm text-ink-3">{hint}</span> : null}
    </label>
  );
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`${CONTROL} tabular ${className}`} {...props} />;
}

/** Input with a fixed prefix (USD, RM, https://) that reads as part of the field. */
export function PrefixedInput({ prefix, className = "", ...props }: ComponentProps<"input"> & { prefix: ReactNode }) {
  return (
    <span className="flex h-10 min-w-0 items-center rounded-md border border-line-strong bg-surface pl-3.5 transition-colors duration-(--dur-fast) hover:border-ink-3 focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent/25 has-disabled:bg-paper-2 has-aria-invalid:border-disputed-fg">
      <span className="pointer-events-none shrink-0 whitespace-nowrap pr-2 text-sm font-medium text-ink-3">{prefix}</span>
      <input className={`h-full min-w-0 flex-1 rounded-r-md bg-transparent pr-3.5 text-base tabular text-ink placeholder:text-ink-3 focus:outline-none disabled:text-ink-3 ${className}`} {...props} />
    </span>
  );
}

export function Select({ className = "", children, ...props }: ComponentProps<"select">) {
  return (
    <span className="relative block">
      <select className={`${CONTROL} appearance-none pr-9 ${className}`} {...props}>
        {children}
      </select>
      <ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-3" />
    </span>
  );
}

/** Native date input with a calendar mark; the browser picker does the rest. */
export function DateInput({ className = "", ...props }: ComponentProps<"input">) {
  return (
    <span className="relative block">
      <CalendarDays size={16} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
      <input type="date" className={`${CONTROL} tabular pl-10 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 ${className}`} {...props} />
    </span>
  );
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea className={`${CONTROL} h-auto min-h-24 py-2.5 ${className}`} {...props} />;
}

/** Checkbox with the label in one tap target. */
export function Checkbox({ label, className = "", ...props }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className={`inline-flex cursor-pointer items-center gap-2.5 text-base text-ink ${className}`}>
      <input type="checkbox" className="h-4.5 w-4.5 rounded-xs border-line-strong accent-(--accent)" {...props} />
      {label}
    </label>
  );
}

export const controlClass = CONTROL;
