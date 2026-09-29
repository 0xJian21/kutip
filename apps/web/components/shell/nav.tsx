"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useState, type ReactNode } from "react";
import { Bot, BookOpen, CalendarDays, FileText, Inbox, LayoutGrid, Landmark, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Plus, Settings, X } from "lucide-react";
import { Avatar, KutipMark } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { buttonClass } from "@/components/ui/button";
import { endSession } from "@/lib/data/actions";
import { RAIL_COOKIE } from "@/lib/ui/rail";

const ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/agent", label: "Agent activity", icon: Bot },
  { href: "/rulebook", label: "Rulebook", icon: BookOpen },
  { href: "/treasury", label: "Treasury", icon: Landmark },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/dashboard" aria-label={compact ? "Kutip, overview" : undefined} className="flex items-center gap-2.5 rounded-full">
      <KutipMark size={28} />
      {compact ? null : <span className="text-lg font-semibold tracking-tight text-ink">Kutip</span>}
    </Link>
  );
}

/** Label beside an icon in the collapsed rail. Visual only: the control keeps its own accessible name. */
function Tip({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute left-full top-1/2 z-40 ml-3 -translate-y-1/2 whitespace-nowrap rounded-full bg-surface px-3 py-1 text-sm font-medium text-ink opacity-0 shadow-float transition-opacity duration-(--dur-fast) group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      {children}
    </span>
  );
}

function NavList({ onNavigate, compact = false }: { onNavigate?: () => void; compact?: boolean }) {
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
              className={`group relative flex h-10 items-center rounded-full text-base transition-colors duration-(--dur-fast) ${compact ? "w-10 justify-center" : "gap-3 px-3.5"} ${
                active ? "bg-surface font-medium text-ink shadow-pill" : "text-ink-2 hover:bg-surface/70 hover:text-ink"
              }`}
            >
              <Icon size={17} strokeWidth={1.9} aria-hidden="true" className={active ? "text-accent" : "text-ink-3"} />
              {compact ? <><span className="sr-only">{label}</span><Tip>{label}</Tip></> : label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ExporterRow({ name, logoUrl, compact = false }: { name: string; logoUrl?: string; compact?: boolean }) {
  if (compact) return <div title={name}><Avatar name={name} src={logoUrl} size="md" shape="square" /></div>;
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

function useSignOut() {
  const { logout, authenticated } = usePrivy();
  const router = useRouter();
  return async () => {
    // Both halves: Privy's client session and Kutip's own cookie, so a re-sign-in starts clean.
    if (authenticated) await logout().catch(() => undefined);
    await endSession();
    router.replace("/onboarding");
  };
}

function OwnerRow({ name, compact = false }: { name: string; compact?: boolean }) {
  const signOut = useSignOut();
  if (compact) {
    return (
      <div className="flex flex-col items-center gap-2">
        <ThemeToggle />
        <button type="button" onClick={() => void signOut()} aria-label="Sign out" className="group relative inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-3 hover:bg-surface/70 hover:text-ink">
          <LogOut size={16} aria-hidden="true" />
          <Tip>Sign out</Tip>
        </button>
        <div title={name}><Avatar name={name} size="sm" /></div>
      </div>
    );
  }
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
 * Desktop rail: 248px, or a 72px icon rail when collapsed (toggle button or ⌘B / Ctrl+B,
 * remembered per browser). The aside stretches with the page (so its background never
 * stops short); the inner column is sticky and viewport-high. Bottom padding keeps the
 * owner row clear of the dev-tools badge. Phones use TopBar's sheet instead.
 */
export function SideNav({ exporterName, ownerName, logoUrl, initialCollapsed = false }: { exporterName: string; ownerName: string; logoUrl?: string; initialCollapsed?: boolean }) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  useEffect(() => {
    document.cookie = `${RAIL_COOKIE}=${collapsed ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  }, [collapsed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const toggleLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";
  const toggle = (
    <button
      type="button"
      onClick={() => setCollapsed((c) => !c)}
      aria-label={toggleLabel}
      aria-expanded={!collapsed}
      aria-keyshortcuts="Meta+B Control+B"
      title={`${toggleLabel} (⌘B)`}
      className="group relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-3 transition-colors duration-(--dur-fast) hover:bg-surface/70 hover:text-ink"
    >
      {collapsed ? <PanelLeftOpen size={16} aria-hidden="true" /> : <PanelLeftClose size={16} aria-hidden="true" />}
    </button>
  );

  return (
    <aside
      data-collapsed={collapsed || undefined}
      className={`hidden shrink-0 self-stretch border-r border-line bg-paper transition-[width] duration-(--dur-base) ease-out motion-reduce:transition-none lg:block ${collapsed ? "w-[72px]" : "w-[248px]"}`}
    >
      <div className={`sticky top-0 flex h-screen flex-col pb-16 pt-5 ${collapsed ? "items-center px-3" : "px-4"}`}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-3"><Wordmark compact />{toggle}</div>
        ) : (
          <div className="flex items-center justify-between gap-2 px-1"><Wordmark />{toggle}</div>
        )}
        <div className="mt-6"><ExporterRow name={exporterName} logoUrl={logoUrl} compact={collapsed} /></div>
        <nav aria-label="Main" className="mt-6">
          <NavList compact={collapsed} />
        </nav>
        <div className="mt-4">
          {collapsed ? (
            <Link href="/invoices/new" aria-label="New invoice" className={`group relative ${buttonClass("primary", "md", "w-10 px-0!")}`}>
              <Plus size={16} aria-hidden="true" />
              <Tip>New invoice</Tip>
            </Link>
          ) : (
            <Link href="/invoices/new" className={buttonClass("primary", "md", "w-full")}>
              <Plus size={16} aria-hidden="true" />
              New invoice
            </Link>
          )}
        </div>
        <div className={`mt-auto ${collapsed ? "" : "px-1"}`}><OwnerRow name={ownerName} compact={collapsed} /></div>
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
