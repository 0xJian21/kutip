"use client";

import { Sparkles, X } from "lucide-react";
import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { CommandBar } from "@/components/ui/command-bar";
import { Skeleton } from "@/components/ui/states";
import { runCommand } from "./actions";
import { PreviewCard, type Preview } from "./preview-card";

export const SUGGESTIONS = ["What’s due this week?", "Who is overdue?", "Sweep now", "Cash out RM 10k", "What’s on this week?"];

/**
 * The agent command bar with its answer (IMPROVEMENTS A1). The agent routes the request to one
 * tool and shows a preview; numbers come from code, and nothing acts until a button is pressed.
 */
export function CommandPanel({ className = "", autoFocus = false, onNavigate }: { className?: string; autoFocus?: boolean; onNavigate?: () => void }) {
  const [asked, setAsked] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function ask(text: string) {
    setAsked(text);
    setError(null);
    start(async () => {
      const r = await runCommand(text);
      if (r.ok) setPreview(r.value);
      else {
        setPreview(null);
        setError(r.error);
      }
    });
  }

  function close() {
    setAsked(null);
    setPreview(null);
    setError(null);
    onNavigate?.();
  }

  return (
    <div className={className}>
      <CommandBar suggestions={asked ? [] : SUGGESTIONS} onSubmit={ask} autoFocus={autoFocus} />
      {asked ? (
        <Card className="mt-3" aria-live="polite">
          <div className="mb-3 flex items-start justify-between gap-3">
            <p className="flex min-w-0 items-center gap-2 text-sm text-ink-2">
              <Sparkles size={14} aria-hidden="true" className="shrink-0 text-accent" />
              <span className="truncate">“{asked}”</span>
              {preview?.via === "jev" ? <span className="shrink-0 text-xs text-ink-3">· routed by Jev</span> : null}
            </p>
            <button type="button" onClick={close} aria-label="Close answer" className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-paper-2 hover:text-ink">
              <X size={14} aria-hidden="true" />
            </button>
          </div>
          {pending ? (
            <div className="grid gap-2" aria-label="The agent is working">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : error ? (
            <p role="alert" className="text-sm text-disputed-fg">{error}</p>
          ) : preview ? (
            <PreviewCard key={asked} preview={preview} onAsk={ask} onDone={close} />
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
