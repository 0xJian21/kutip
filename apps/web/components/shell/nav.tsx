"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import { Bot, BookOpen, FileText, LayoutGrid, Landmark, LogOut, Menu, Plus, Settings, X } from "lucide-react";
import { Avatar, KutipMark } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { buttonClass } from "@/components/ui/button";
import { endSession } from "@/lib/data/actions";

const ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/agent", label: "Agent activity", icon: Bot },
  { href: "/rulebook", label: "Rulebook", icon: BookOpen },
  { href: "/treasury", label: "Treasury", icon: Landmark },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

function Wordmark() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 rounded-full">
      <KutipMark size={28} />
      <span className="text-lg font-semibold tracking-tight text-ink">Kutip</span>
    </Link>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="grid gap-1">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex h-10 items-center gap-3 rounded-full px-3.5 text-base transition-colors duration-(--dur-fast) ${
                active ? "bg-surface font-medium text-ink shadow-pill" : "text-ink-2 hover:bg-surface/70 hover:text-ink"
              }`}
            >
              <Icon size={17} strokeWidth={1.9} aria-hidden="true" className={active ? "text-accent" : "text-ink-3"} />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ExporterRow({ name, logoUrl }: { name: string; logoUrl?: string }) {
  return (
    <div className="flex items-center gap-3 px-1">
      <Avatar name={name} src={logoUrl} size="md" shape="square" />
      <div className="min-w-0">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-ink" title={name}>{name}</p>
        <p className="text-xs text-ink-3">Exporter</p>
      </div>
    </div>
  );
}

function OwnerRow({ name }: { name: string }) {
  const { logout, authenticated } = usePrivy();
  const router = useRouter();
  const signOut = async () => {
    // Both halves: Privy's client session and Kutip's own cookie, so a re-sign-in starts clean.
    if (authenticated) await logout().catch(() => undefined);
    await endSession();
    router.replace("/onboarding");
  };
  return (
    <div className="flex items-center gap-3">
      <Avatar name={name} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{name}</p>
        <button type="button" onClick={() => void signOut()} className="inline-flex items-center gap-1 text-xs text-ink-3 hover:text-ink">
          <LogOut size={11} aria-hidden="true" /> Sign out
        </button>
      </div>
      <ThemeToggle />
    </div>
  );
}

/**
 * Desktop rail. The aside stretches with the page (so its background never
 * stops short); the inner column is sticky and viewport-high. Bottom padding
 * keeps the owner row clear of the dev-tools badge.
 */
export function SideNav({ exporterName, ownerName, logoUrl }: { exporterName: string; ownerName: string; logoUrl?: string }) {
  return (
    <aside className="hidden w-[248px] shrink-0 self-stretch border-r border-line bg-paper lg:block">
      <div className="sticky top-0 flex h-screen flex-col px-4 pb-16 pt-5">
        <div className="px-1"><Wordmark /></div>
        <div className="mt-6"><ExporterRow name={exporterName} logoUrl={logoUrl} /></div>
        <nav aria-label="Main" className="mt-6">
          <NavList />
        </nav>
        <div className="mt-4">
          <Link href="/invoices/new" className={buttonClass("primary", "md", "w-full")}>
            <Plus size={16} aria-hidden="true" />
            New invoice
          </Link>
        </div>
        <div className="mt-auto px-1"><OwnerRow name={ownerName} /></div>
      </div>
    </aside>
  );
}

export function TopBar({ exporterName, ownerName, logoUrl }: { exporterName: string; ownerName: string; logoUrl?: string }) {
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
      <div className="flex min-w-0 items-center gap-3">
        <Wordmark />
        {current ? <span className="truncate text-sm text-ink-3">/ {current.label}</span> : null}
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-paper-2"
      >
        <Menu size={18} aria-hidden="true" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-30" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-ink/30" />
          <div className="absolute inset-y-0 right-0 flex w-[300px] max-w-[88vw] flex-col rounded-l-lg bg-paper px-4 pb-6 pt-5 shadow-float">
            <div className="flex items-center justify-between gap-3">
              <ExporterRow name={exporterName} logoUrl={logoUrl} />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-surface">
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <nav aria-label="Main" className="mt-6">
              <NavList onNavigate={() => setOpen(false)} />
            </nav>
            <div className="mt-4">
              <Link href="/invoices/new" onClick={() => setOpen(false)} className={buttonClass("primary", "md", "w-full")}>
                <Plus size={16} aria-hidden="true" />
                New invoice
              </Link>
            </div>
            <div className="mt-auto px-1"><OwnerRow name={ownerName} /></div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
