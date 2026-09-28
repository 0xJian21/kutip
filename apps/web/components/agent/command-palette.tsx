"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { CommandPanel } from "./command-panel";

/** ⌘K / Ctrl+K anywhere in the owner app opens the agent command bar in a dialog. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Ask the agent">
      <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" />
      <div className="relative max-h-[76vh] w-full max-w-[640px] overflow-y-auto rounded-2xl bg-paper p-3 shadow-float sm:p-4">
        <CommandPanel autoFocus onNavigate={() => setOpen(false)} />
        <p className="mt-2 px-1 text-xs text-ink-3">
          <kbd className="rounded bg-paper-2 px-1.5 py-0.5 font-sans">Esc</kbd> to close · the agent previews first and never acts without your OK
        </p>
      </div>
    </div>
  );
}
