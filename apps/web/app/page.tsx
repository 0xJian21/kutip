import type { Metadata } from "next";
import Link from "next/link";
import { Fingerprint } from "lucide-react";
import { HeroStatement } from "@/components/landing/hero-statement";
import { buttonClass } from "@/components/ui/button";
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
  { title: "Drop the invoice PDF", body: "Kutip reads the buyer, the total and the due date. You check it. The pay link goes out with the email you already send." },
  { title: "Your buyer scans and pays", body: "In USDC, or in SOL or USDT converted on the spot. No wallet top-up for gas: Kutip pays the network fee." },
  { title: "It settles into your treasury", body: "The moment the payment lands you see it, in ringgit. Reminders stop, the receipt goes out, and the money is swept into your own account." },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 rounded-sm">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-sm bg-accent text-on-accent">
            <svg width="15" height="15" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M3 2v10M3 7l6-5M3 7l6 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <span className="text-lg font-semibold tracking-tight text-ink">Kutip</span>
        </Link>
        <nav aria-label="Site" className="flex items-center gap-1 sm:gap-4">
          <a href="#how" className="hidden rounded-sm px-2 py-1 text-base text-ink-2 hover:text-ink sm:inline">How it works</a>
          <a href="#compare" className="hidden rounded-sm px-2 py-1 text-base text-ink-2 hover:text-ink sm:inline">Versus a wire</a>
          <Link href="/onboarding" className={buttonClass("secondary", "md")}>Sign in</Link>
          <ThemeToggle />
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl gap-10 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16 lg:pt-20">
          <div className="max-w-[34ch]">
            <p className="text-base text-ink-2">Kutip, from the Malay <em className="not-italic text-ink">kutip</em>: to collect.</p>
            <h1 className="mt-3 text-3xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-[2.75rem] sm:leading-[1.08]">
              Overseas invoices, paid in seconds, settled into your own treasury.
            </h1>
            <p className="mt-5 max-w-[46ch] text-md text-ink-2">
              An agent that chases your buyers, knows the second the money lands, and moves it into an account only you control. For Malaysian exporters selling on 30 to 60 day terms.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/onboarding" className={buttonClass("primary", "lg")}>
                <Fingerprint size={18} aria-hidden="true" />
                Continue with fingerprint / Face ID
              </Link>
              <Link href="/pay/inv_demo" className={buttonClass("ghost", "lg")}>See what your buyer sees</Link>
            </div>
            <p className="mt-4 text-sm text-ink-3">No seed phrase, no exchange account, no ringgit ever touches Kutip.</p>
          </div>
          <HeroStatement />
        </section>

        <section id="compare" className="border-y border-line bg-paper-2/60">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
            <h2 className="max-w-[28ch] text-2xl font-semibold tracking-tight text-ink">
              Bank wire: 3 days, about RM150. Kutip: 1 second, under RM0.05.
            </h2>
            <ul className="mt-8 divide-y divide-line rounded-md border border-line bg-surface sm:hidden">
              {COMPARISON.map((r) => (
                <li key={r.label} className="px-4 py-4">
                  <p className="text-base font-medium text-ink">{r.label}</p>
                  <dl className="mt-2 grid gap-1.5 text-base">
                    <div className="grid grid-cols-[6.5rem_1fr] gap-2"><dt className="text-sm text-ink-3">Bank wire</dt><dd className="text-ink-2">{r.wire}</dd></div>
                    <div className="grid grid-cols-[6.5rem_1fr] gap-2"><dt className="text-sm text-ink-3">Kutip</dt><dd className="text-ink">{r.kutip}</dd></div>
                  </dl>
                </li>
              ))}
            </ul>
            <div className="mt-8 hidden overflow-hidden rounded-md border border-line bg-surface sm:block">
              <table className="w-full text-base">
                <thead className="bg-paper-2 text-sm text-ink-2">
                  <tr>
                    <th scope="col" className="w-[28%] px-4 py-2.5 text-left font-medium sm:px-6"> </th>
                    <th scope="col" className="px-4 py-2.5 text-left font-medium">Telegraphic transfer</th>
                    <th scope="col" className="px-4 py-2.5 text-left font-medium text-ink sm:px-6">Kutip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {COMPARISON.map((r) => (
                    <tr key={r.label} className="align-top">
                      <th scope="row" className="px-4 py-3.5 text-left font-medium text-ink sm:px-6">{r.label}</th>
                      <td className="px-4 py-3.5 text-ink-2">{r.wire}</td>
                      <td className="px-4 py-3.5 text-ink sm:px-6">{r.kutip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-ink-3">Wire figures are typical Malaysian bank charges for an inbound USD telegraphic transfer. Kutip figures are the Solana network fee at the time of writing.</p>
          </div>
        </section>

        <section id="how" className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">How it works</h2>
          <ol className="mt-8 grid gap-8 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="money mt-0.5 text-money-md text-accent">{i + 1}</span>
                <div>
                  <h3 className="text-lg font-medium text-ink">{s.title}</h3>
                  <p className="mt-1.5 max-w-[38ch] text-base text-ink-2">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-t border-line">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-14 sm:grid-cols-3 sm:px-6 lg:py-16">
            <div>
              <h3 className="text-lg font-medium text-ink">Your money, your account</h3>
              <p className="mt-1.5 text-base text-ink-2">Funds sit in a Squads account you own. Kutip&apos;s agent can only sweep buyer payments into it, up to a daily limit you set, enforced on chain.</p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-ink">Buyers can&apos;t see each other</h3>
              <p className="mt-1.5 text-base text-ink-2">Each buyer pays into its own receiving account. Nothing on chain names a buyer or an invoice. Line items never leave your database.</p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-ink">Every action has a reason</h3>
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
