import {
  AGENT_STATUS_CLASS,
  AGENT_STATUS_LABEL,
  INVOICE_STATUS_CLASS,
  INVOICE_STATUS_HINT,
  INVOICE_STATUS_LABEL,
  type AgentActionStatus,
  type InvoiceStatus,
} from "@/lib/ui/status";

export function StatusPill({ status, className = "" }: { status: InvoiceStatus; className?: string }) {
  return (
    <span
      title={INVOICE_STATUS_HINT[status]}
      className={`inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-sm font-medium ${INVOICE_STATUS_CLASS[status]} ${className}`}
    >
      {INVOICE_STATUS_LABEL[status]}
    </span>
  );
}

export function AgentStatusPill({ status, className = "" }: { status: AgentActionStatus; className?: string }) {
  return (
    <span
      className={`inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-sm font-medium ${AGENT_STATUS_CLASS[status]} ${className}`}
    >
      {AGENT_STATUS_LABEL[status]}
    </span>
  );
}
