import type { Metadata } from "next";
import Link from "next/link";
import { Hero } from "@/components/landing/hero";
import { Problem } from "@/components/landing/problem";
import { Faq, Features, FinalCta, HowItWorks, LiveProof, Trust, WhoFor } from "@/components/landing/sections";
import { KutipMark } from "@/components/ui/avatar";
import { buttonClass } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export const metadata: Metadata = {
  title: "Kutip · Overseas invoices, paid in seconds, settled into your own treasury",
};

export default function LandingPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 rounded-full">
          <KutipMark size={30} />
          <span className="text-lg font-semibold tracking-tight text-ink">Kutip</span>
        </Link>
        <nav aria-label="Site" className="flex items-center gap-1 sm:gap-2">
          <a href="#how" className="hidden rounded-full px-3.5 py-2 text-base text-ink-2 transition-colors duration-(--dur-fast) hover:bg-surface hover:text-ink sm:inline">How it works</a>
          <a href="#compare" className="hidden rounded-full px-3.5 py-2 text-base text-ink-2 transition-colors duration-(--dur-fast) hover:bg-surface hover:text-ink sm:inline">Versus a wire</a>
          <a href="#proof" className="hidden rounded-full px-3.5 py-2 text-base text-ink-2 transition-colors duration-(--dur-fast) hover:bg-surface hover:text-ink md:inline">Live proof</a>
          <Link href="/onboarding?next=/dashboard" className={buttonClass("outline", "md")}>Sign in</Link>
          <ThemeToggle />
        </nav>
      </header>

      <main className="flex-1">
        <Hero />
        <Problem />

        <HowItWorks />
        <LiveProof />
        <Features />
        <Trust />
        <WhoFor />
        <Faq />
        <FinalCta />
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-8 text-sm text-ink-3 sm:px-6">
          <span className="flex items-center gap-2.5">
            <KutipMark size={22} />
            <span>Built in Malaysia on Solana. <em className="not-italic text-ink-2">Kutip</em>, Malay for &ldquo;to collect&rdquo;.</span>
          </span>
          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#proof" className="hover:text-ink">Live proof</a>
            <a href="#faq" className="hover:text-ink">FAQ</a>
            <a href="https://github.com/0xJian21/kutip" target="_blank" rel="noopener noreferrer" className="hover:text-ink">GitHub</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
