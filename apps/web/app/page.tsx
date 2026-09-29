import type { Metadata } from "next";
import Link from "next/link";
import { Hero } from "@/components/landing/hero";
import { Problem } from "@/components/landing/problem";
import { KutipMark } from "@/components/ui/avatar";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export const metadata: Metadata = {
  title: "Kutip · Overseas invoices, paid in seconds, settled into your own treasury",
};

const STEPS = [
  { title: "Send the invoice", body: "Fill in the form or import the PDF you already send. Kutip reads the buyer, the total and the due date; you check it; the pay link goes out by email." },
  { title: "Your buyer scans and pays", body: "In USDC, or in SOL or USDT converted on the spot. No wallet top-up for gas: Kutip pays the network fee." },
  { title: "It settles into your treasury", body: "The moment the payment lands you see it, in ringgit. Reminders stop, the receipt goes out, and the money is swept into your own account." },
];

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
          <Link href="/onboarding?next=/dashboard" className={buttonClass("outline", "md")}>Sign in</Link>
          <ThemeToggle />
        </nav>
      </header>

      <main className="flex-1">
        <Hero />
        <Problem />

        <section id="how" className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
          <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">How it works</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <Card className="h-full">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-on-accent">{i + 1}</span>
                  <h3 className="mt-4 text-lg font-semibold tracking-tight text-ink">{s.title}</h3>
                  <p className="mt-1.5 max-w-[38ch] text-base text-ink-2">{s.body}</p>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6 lg:pb-24">
          <div className="grid gap-8 border-t border-line pt-12 sm:grid-cols-3">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-ink">Your money, your account</h3>
              <p className="mt-1.5 text-base text-ink-2">Funds sit in a Squads account you own. Kutip&apos;s agent can only sweep buyer payments into it, up to a daily limit you set, enforced on chain.</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-ink">Buyers can&apos;t see each other</h3>
              <p className="mt-1.5 text-base text-ink-2">Each buyer pays into its own receiving account. Nothing on chain names a buyer or an invoice. Line items never leave your database.</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-ink">Every action has a reason</h3>
              <p className="mt-1.5 text-base text-ink-2">Each reminder, sweep and alert is logged with the rule it followed and how confident the agent was. Anything outside the rules waits for your tap.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-ink-3 sm:px-6">
          <span>Kutip · Made in Muar, Johor</span>
          <span>Built on Solana · Squads · Solami · Jupiter</span>
        </div>
      </footer>
    </div>
  );
}
