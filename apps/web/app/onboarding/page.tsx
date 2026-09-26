import type { Metadata } from "next";
import Link from "next/link";
import { Onboarding } from "@/components/onboarding/onboarding";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { data } from "@/lib/ui/data";

export const metadata: Metadata = { title: "Get started" };

export default async function OnboardingPage() {
  const [exporter, rulebook] = await Promise.all([data.getExporter(), data.getRulebook()]);
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 rounded-sm">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-sm bg-accent text-on-accent">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M3 2v10M3 7l6-5M3 7l6 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <span className="text-md font-semibold tracking-tight text-ink">Kutip</span>
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex-1 px-4 pb-16 pt-6 sm:px-6">
        <Onboarding exporter={exporter} rulebook={rulebook} />
      </main>
    </div>
  );
}
