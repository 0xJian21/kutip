import { Check } from "lucide-react";
import type { ReactNode } from "react";

export type Step = { key: string; label: ReactNode; caption?: ReactNode };

/**
 * Horizontal stepper. `done` = steps complete, so the step at index `done` is the
 * current one. Used for the invoice life (Sent → Seen → Paid → Settled) and onboarding.
 * `live` pulses the current node while something is in flight.
 */
export function Stepper({ steps, done, live = false, size = "md", className = "" }: { steps: Step[]; done: number; live?: boolean; size?: "sm" | "md"; className?: string }) {
  const node = size === "sm" ? "h-6 w-6" : "h-8 w-8";
  return (
    <ol className={`grid ${className}`} style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-label="Progress">
      {steps.map((s, i) => {
        const complete = i < done;
        const current = i === done;
        return (
          <li key={s.key} className="relative min-w-0" aria-current={current ? "step" : undefined}>
            <div className="flex items-center">
              <span
                className={`relative z-10 inline-flex shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-(--dur-base) ${node} ${
                  complete
                    ? "bg-accent text-on-accent"
                    : current
                      ? "border-2 border-accent bg-surface text-accent"
                      : "border-2 border-line bg-surface text-ink-3"
                }`}
              >
                {complete ? <Check size={size === "sm" ? 12 : 14} strokeWidth={3} aria-hidden="true" /> : i + 1}
                {current && live ? <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full bg-accent/30" /> : null}
              </span>
              {i < steps.length - 1 ? (
                <span aria-hidden="true" className="relative mx-2 h-0.5 flex-1 overflow-hidden rounded-full bg-line">
                  <span
                    className={`absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-(--dur-slow) ease-(--ease-out)`}
                    style={{ width: complete ? "100%" : "0%" }}
                  />
                </span>
              ) : null}
            </div>
            <div className={`mt-2 truncate pr-2 text-sm ${complete || current ? "font-medium text-ink" : "text-ink-3"}`}>{s.label}</div>
            {s.caption !== undefined ? <div className="truncate pr-2 text-xs tabular text-ink-3">{s.caption}</div> : null}
          </li>
        );
      })}
    </ol>
  );
}
