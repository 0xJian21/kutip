import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Fingerprint } from "lucide-react";
import { HeroStatement } from "@/components/landing/hero-statement";
import { KutipMark } from "@/components/ui/avatar";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export const metadata: Metadata = {
  title: "Kutip · Overseas invoices, paid in seconds, settled into your own treasury",
};

const COMPARISON: Array<{ label: string; wire: string; kutip: string }> = [
  { label: "Money arrives", wire: "2 to 5 days", kutip: "About 1 second" },
  { label: "Cost per payment", wire: "RM150 wire fee, plus 1 to 3% hidden in the FX rate", kutip: "Under RM0.05. Your buyer pays no fee either." },
  { label: "Which invoice was this for?", wire: "You work it out from the amount", kutip: "Matched automatically, receipt emailed" },
  { label: "Chasing late payers", wire: "You, across time zones", kutip: "The agent, in the buyer's working hours, within your rules" },
  { label: "Who holds the money", wire: "The bank, until it clears", kutip: "You. It lands in an account only your passkey controls." },
];

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
        <section className="mx-auto grid w-full max-w-6xl gap-10 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16 lg:pt-20">
          <div className="max-w-[36ch]">
            <p className="text-base text-ink-2">Kutip, from the Malay <em className="not-italic text-ink">kutip</em>: to collect.</p>
            <h1 className="mt-3 text-3xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-[2.875rem] sm:leading-[1.06]">
              Overseas invoices, paid in seconds, settled into your own treasury.
            </h1>
            <p className="mt-5 max-w-[46ch] text-md text-ink-2">
              An agent that chases your buyers, knows the second the money lands, and moves it into an account only you control. For Malaysian exporters selling on 30 to 60 day terms.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/onboarding" className={buttonClass("primary", "lg")}>
                <Fingerprint size={18} aria-hidden="true" />
                Continue with Touch ID or Face ID
              </Link>
              <Link href="/pay/inv_demo" className={buttonClass("ghost", "lg")}>
                See what your buyer sees <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <p className="mt-4 text-sm text-ink-3">No seed phrase, no exchange account, no ringgit ever touches Kutip.</p>
          </div>
          <HeroStatement />
        </section>

        <section id="compare" className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
          <h2 className="max-w-[28ch] text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Bank wire: 3 days, about RM150. Kutip: 1 second, under RM0.05.
          </h2>
          <Card padded={false} className="mt-8 sm:hidden">
            <ul className="divide-y divide-line">
              {COMPARISON.map((r) => (
                <li key={r.label} className="px-5 py-4">
                  <p className="text-base font-medium text-ink">{r.label}</p>
                  <dl className="mt-2 grid gap-1.5 text-base">
                    <div className="grid grid-cols-[6.5rem_1fr] gap-2"><dt className="text-sm text-ink-3">Bank wire</dt><dd className="text-ink-2">{r.wire}</dd></div>
                    <div className="grid grid-cols-[6.5rem_1fr] gap-2"><dt className="text-sm text-ink-3">Kutip</dt><dd className="text-ink">{r.kutip}</dd></div>
                  </dl>
                </li>
              ))}
            </ul>
          </Card>
          <Card padded={false} className="mt-8 hidden overflow-hidden sm:block">
            <Table>
              <THead>
                <tr>
                  <TH className="w-[28%]"> </TH>
                  <TH>Telegraphic transfer</TH>
                  <TH className="text-ink">Kutip</TH>
                </tr>
              </THead>
              <TBody>
                {COMPARISON.map((r) => (
                  <TR key={r.label} className="align-top">
                    <th scope="row" className="px-4 py-3.5 text-left font-medium text-ink first:pl-5 sm:first:pl-6">{r.label}</th>
                    <TD className="text-ink-2">{r.wire}</TD>
                    <TD className="text-ink">{r.kutip}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
          <p className="mt-3 text-sm text-ink-3">Wire figures are typical Malaysian bank charges for an inbound USD telegraphic transfer. Kutip figures are the Solana network fee at the time of writing.</p>
        </section>

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
