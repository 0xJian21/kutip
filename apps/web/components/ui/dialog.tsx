"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Modal sheet for a flow that needs the owner's attention (Sweep now, Cash out).
 * Native <dialog> for focus trapping and Escape; the card look of the daylight ledger.
 * On phones it sits at the bottom of the screen, full width.
 */
export function Dialog({ open, onClose, title, caption, children, className = "" }: { open: boolean; onClose: () => void; title: ReactNode; caption?: ReactNode; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={`fixed inset-x-0 bottom-0 m-0 w-full max-w-none rounded-t-2xl bg-surface p-0 text-ink shadow-float backdrop:bg-ink/30 sm:inset-0 sm:m-auto sm:max-h-[90vh] sm:w-[min(100%-2rem,34rem)] sm:rounded-2xl ${className}`}
    >
      <div className="max-h-[85vh] overflow-y-auto p-5 sm:p-6">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
            {caption ? <p className="mt-0.5 text-sm text-ink-2">{caption}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-paper-2 hover:text-ink">
            <X size={16} aria-hidden="true" />
          </button>
        </header>
        <div className="mt-4">{children}</div>
      </div>
    </dialog>
  );
}
