import type { Metadata } from "next";
import Link from "next/link";
import { Onboarding } from "@/components/onboarding/onboarding";
import { KutipMark } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { safeNext } from "@/lib/server/access";
import { demoData } from "@/lib/server/data";

export const metadata: Metadata = { title: "Get started" };

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const next = safeNext((await searchParams).next);
  const data = demoData();
  const [exporter, rulebook] = await Promise.all([data.getExporter(), data.getRulebook()]);
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 rounded-full">
          <KutipMark size={28} />
          <span className="text-lg font-semibold tracking-tight text-ink">Kutip</span>
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex-1 px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
        <Onboarding exporter={exporter} rulebook={rulebook} next={next} />
      </main>
    </div>
  );
}
