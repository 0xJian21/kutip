import type { ComponentProps, ReactNode } from "react";

const CONTROL =
  "h-9 w-full rounded-sm border border-line-strong bg-surface px-3 text-base text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:bg-paper-2 disabled:text-ink-3";

export function Field({
  label,
  hint,
  error,
  children,
  className = "",
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`grid gap-1.5 ${className}`}>
      <span className="text-sm font-medium text-ink-2">{label}</span>
      {children}
      {error ? <span className="text-sm text-disputed-fg">{error}</span> : hint ? <span className="text-sm text-ink-3">{hint}</span> : null}
    </label>
  );
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`${CONTROL} tabular ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return <select className={`${CONTROL} ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea className={`${CONTROL} h-auto min-h-24 py-2 ${className}`} {...props} />;
}

export const controlClass = CONTROL;
