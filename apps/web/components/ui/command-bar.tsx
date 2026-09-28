"use client";

import { ArrowUp, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";

/**
 * Agent command bar shell (IMPROVEMENTS A1). Visual only until Session 8c wires
 * `onSubmit`; without it the bar reads as a preview and the submit stays disabled.
 */
export function CommandBar({
  placeholder = "Ask Kutip: “What’s due this week?”, “Remind Najd about INV-0141”, “Sweep now”",
  suggestions = [],
  onSubmit,
  autoFocus = false,
  className = "",
}: {
  placeholder?: string;
  suggestions?: string[];
  onSubmit?: (text: string) => void | Promise<void>;
  autoFocus?: boolean;
  className?: string;
}) {
  const [text, setText] = useState("");
  const wired = Boolean(onSubmit);
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!wired || !text.trim()) return;
    void onSubmit?.(text.trim());
    setText("");
  }
  return (
    <form onSubmit={submit} className={className} aria-label="Ask the agent">
      <div className="flex items-center gap-2 rounded-full border border-line bg-surface py-1.5 pl-4 pr-1.5 shadow-card transition-colors duration-(--dur-fast) focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent/20">
        <Sparkles size={18} aria-hidden="true" className="shrink-0 text-accent" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          aria-label="Ask the agent"
          disabled={!wired}
          autoFocus={autoFocus}
          className="h-9 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink-3 focus:outline-none disabled:cursor-default"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!wired || !text.trim()}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-paper transition-colors duration-(--dur-fast) hover:bg-ink/85 disabled:opacity-40"
        >
          <ArrowUp size={16} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>
      {suggestions.length ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              disabled={!wired}
              onClick={() => (wired ? void onSubmit?.(s) : setText(s))}
              className="inline-flex h-7 items-center rounded-full bg-paper-2 px-3 text-xs font-medium text-ink-2 transition-colors duration-(--dur-fast) hover:bg-accent-soft hover:text-accent disabled:cursor-default disabled:hover:bg-paper-2 disabled:hover:text-ink-2"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}
      {!wired ? <p className="mt-2 text-xs text-ink-3">The agent answers here soon. It will preview every action and ask before it moves money.</p> : null}
    </form>
  );
}
