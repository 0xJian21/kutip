"use client";

import Link from "next/link";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyField({ label, value, href }: { label: string; value: string; href?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }
  return (
    <div>
      <div className="mb-1.5 text-sm font-medium text-ink-2">{label}</div>
      <div className="flex items-center gap-1 rounded-md bg-well py-1.5 pl-3.5 pr-1.5 ring-1 ring-inset ring-line">
        {href ? (
          <Link href={href} className="min-w-0 flex-1 truncate text-base tabular text-accent underline-offset-4 hover:underline">{value}</Link>
        ) : (
          <span className="min-w-0 flex-1 truncate text-base tabular text-ink">{value}</span>
        )}
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? "Copied" : `Copy ${label}`}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-2 transition-colors duration-(--dur-fast) hover:bg-paper-2 hover:text-ink"
        >
          {copied ? <Check size={14} aria-hidden="true" className="text-paid-fg" /> : <Copy size={14} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
