import { ExternalLink } from "lucide-react";
import { shortAddress, solscanAccount, solscanTx } from "@/lib/ui/format";

/** Audit-trail detail: shortened, caption-sized, links out to Solscan. */
export function Address({ value, kind = "account", label }: { value: string; kind?: "account" | "tx"; label?: string }) {
  const href = kind === "tx" ? solscanTx(value) : solscanAccount(value);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={value}
      className="inline-flex items-center gap-1 whitespace-nowrap text-sm tabular text-ink-2 underline-offset-4 transition-colors duration-(--dur-fast) hover:text-accent hover:underline"
    >
      {label ?? shortAddress(value)}
      <ExternalLink size={12} aria-hidden="true" />
    </a>
  );
}
