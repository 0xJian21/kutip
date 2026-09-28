import {
  AGENT_STATUS_CLASS,
  AGENT_STATUS_LABEL,
  INVOICE_STATUS_CLASS,
  INVOICE_STATUS_HINT,
  INVOICE_STATUS_LABEL,
  type AgentActionStatus,
  type InvoiceStatus,
} from "@/lib/ui/status";

const PILL = "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full pl-2 pr-2.5 text-sm font-medium";

/** A dot and a word. The dot carries the hue; the word carries the meaning. */
function Dot({ live = false }: { live?: boolean }) {
  return (
    <span aria-hidden="true" className="relative inline-flex h-1.5 w-1.5">
      {live ? <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-60" /> : null}
      <span className="relative h-1.5 w-1.5 rounded-full bg-current" />
    </span>
  );
}

export function StatusPill({ status, className = "" }: { status: InvoiceStatus; className?: string }) {
  return (
    <span title={INVOICE_STATUS_HINT[status]} className={`${PILL} ${INVOICE_STATUS_CLASS[status]} ${className}`}>
      <Dot live={status === "seen"} />
      {INVOICE_STATUS_LABEL[status]}
    </span>
  );
}

export function AgentStatusPill({ status, className = "" }: { status: AgentActionStatus; className?: string }) {
  return (
    <span className={`${PILL} ${AGENT_STATUS_CLASS[status]} ${className}`}>
      <Dot />
      {AGENT_STATUS_LABEL[status]}
    </span>
  );
}

/** Neutral chip for small facts: a rule id, a token, "Verified on Solana". */
export function Chip({ children, tone = "neutral", className = "" }: { children: React.ReactNode; tone?: "neutral" | "accent" | "hero"; className?: string }) {
  const look =
    tone === "accent"
      ? "bg-accent-soft text-accent"
      : tone === "hero"
        ? "border border-hero-line bg-hero-fill text-on-hero"
        : "bg-paper-2 text-ink-2";
  return <span className={`inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-xs font-medium ${look} ${className}`}>{children}</span>;
}
