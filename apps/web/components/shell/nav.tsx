"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Bot, BookOpen, FileText, LayoutList, Landmark, Menu, Plus, X } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { buttonClass } from "@/components/ui/button";

const ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutList },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/agent", label: "Agent activity", icon: Bot },
  { href: "/rulebook", label: "Rulebook", icon: BookOpen },
  { href: "/treasury", label: "Treasury", icon: Landmark },
] as const;

function Wordmark() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 rounded-sm">
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-sm bg-accent text-on-accent">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M3 2v10M3 7l6-5M3 7l6 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="text-md font-semibold tracking-tight text-ink">Kutip</span>
    </Link>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="grid gap-0.5">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`relative flex h-9 items-center gap-2.5 rounded-sm px-2.5 text-base transition-colors duration-(--dur-fast) ${
                active ? "bg-surface font-medium text-ink" : "text-ink-2 hover:bg-surface/60 hover:text-ink"
              }`}
            >
              {active ? <span aria-hidden="true" className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent" /> : null}
              <Icon size={16} strokeWidth={1.75} aria-hidden="true" className={active ? "text-accent" : "text-ink-3"} />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function SideNav({ exporterName, ownerName }: { exporterName: string; ownerName: string }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r border-line bg-paper-2 px-3 py-4 lg:flex">
      <div className="px-2.5">
        <Wordmark />
        <p className="mt-3 truncate text-sm text-ink-2" title={exporterName}>
          {exporterName}
        </p>
      </div>
      <nav aria-label="Main" className="mt-6">
        <NavList />
      </nav>
      <div className="mt-4 px-0.5">
        <Link href="/invoices/new" className={buttonClass("primary", "md", "w-full")}>
          <Plus size={16} aria-hidden="true" />
          New invoice
        </Link>
      </div>
      <div className="mt-auto flex items-center justify-between px-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{ownerName}</p>
          <p className="text-xs text-ink-3">Owner · signed in with passkey</p>
        </div>
        <ThemeToggle />
      </div>
    </aside>
  );
}

export function TopBar({ exporterName, ownerName }: { exporterName: string; ownerName: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const current = ITEMS.find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-paper/95 px-4 backdrop-blur-sm lg:hidden">
      <div className="flex items-center gap-3">
        <Wordmark />
        {current ? <span className="text-sm text-ink-3">/ {current.label}</span> : null}
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-ink-2 hover:bg-paper-2"
      >
        <Menu size={18} aria-hidden="true" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-30" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-ink/30" />
          <div className="absolute inset-y-0 right-0 flex w-[280px] max-w-[85vw] flex-col bg-paper-2 px-3 py-4 shadow-float">
            <div className="flex items-center justify-between px-2.5">
              <p className="truncate text-sm text-ink-2">{exporterName}</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-ink-2 hover:bg-surface">
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <nav aria-label="Main" className="mt-5">
              <NavList onNavigate={() => setOpen(false)} />
            </nav>
            <div className="mt-4 px-0.5">
              <Link href="/invoices/new" onClick={() => setOpen(false)} className={buttonClass("primary", "md", "w-full")}>
                <Plus size={16} aria-hidden="true" />
                New invoice
              </Link>
            </div>
            <div className="mt-auto flex items-center justify-between px-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{ownerName}</p>
                <p className="text-xs text-ink-3">Owner · passkey</p>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
