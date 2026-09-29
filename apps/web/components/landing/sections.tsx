import Link from "next/link";
import { ArrowUpRight, Bot, Fingerprint, Inbox, Landmark, ScanLine, Sparkles, Terminal } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

const SOLSCAN = (sig: string) => `https://solscan.io/tx/${sig}`;
const short = (sig: string) => `${sig.slice(0, 4)}…${sig.slice(-4)}`;

const H2 = "max-w-[22ch] text-3xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-[2.5rem]";
const SECTION = "mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-24";

// ---------------------------------------------------------------------------------------------
// How it works: a real sequence, so it gets numbers and a rail.
// ---------------------------------------------------------------------------------------------

const STEPS = [
  {
    title: "Send the invoice",
    body: "Fill in the form or import the PDF you already send. Kutip checks the buyer, total and due date with you, then emails a formal invoice with one pay link.",
    detail: "Reminders start three days before the due date, in the buyer's working hours.",
  },
  {
    title: "Your buyer pays from any wallet",
    body: "In USDC, or in SOL converted to the exact amount inside the same payment. No gas to top up: Kutip pays the network fee, so the buyer sends exactly what the invoice says.",
    detail: "Any Solana wallet app, such as Phantom; one scan on a phone.",
  },
  {
    title: "The money lands; the agent does the rest",
    body: "You see it in ringgit the second it arrives. The agent matches it to the invoice, stops the reminders, emails the receipt, and sweeps it into your treasury within your daily limit.",
    detail: "Every step is logged with the rule it followed.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className={SECTION}>
      <h2 id="how-title" className={H2}>Three steps, and two of them are not yours.</h2>
      <ol className="relative mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
        {/* The rail joining the steps, behind the numbers (desktop). */}
        <span aria-hidden="true" className="absolute left-4 right-[calc(33%-1rem)] top-4 hidden h-0.5 bg-linear-to-r from-accent to-accent/25 md:block" />
        {STEPS.map((s, i) => (
          <li key={s.title} className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-x-4 md:block">
            <span className="relative z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-on-accent ring-4 ring-paper">{i + 1}</span>
            <div className="md:mt-6">
              <h3 className="text-xl font-semibold tracking-tight text-ink">{s.title}</h3>
              <p className="mt-2 max-w-[40ch] text-base leading-relaxed text-ink-2">{s.body}</p>
              <p className="mt-3 text-sm text-ink-3">{s.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// Live proof: real mainnet transactions from the Sep 29 rehearsal (docs/REHEARSAL.md).
// ---------------------------------------------------------------------------------------------

const PROOF = [
  { label: "Buyer pays INV-2026-0154 in SOL; exactly 1.000000 USDC lands", sig: "5GDG5XPL8cJwDPJTvvqbgnKcL5SThS9t5GgVDYeVh6fQFgTHJxayc7KqM84KZwBy75by2jBcfdAsA8HHvtjv3AMV" },
  { label: "An AP bot pays INV-2026-0155 over x402, 402 to 200 in 4.5 s", sig: "5taDgww4YGWphCH5rMiGLjM3253HeZa2LbQcbhy9bqNHHAznh58hA7h7J1cuRJ1eB7S5MtdrUVMvD9jXL1sM1AWm" },
  { label: "Sweep now: two buyer accounts into the treasury, agent-signed", sig: "47KoPjR6tVT5pLGwfAADGT5LKLXmGcjSeX5hSc6rGGFDdwyF14gSxuPX6QnJyvLR3z74vUPmjrCK4JN4qhkpfobP" },
  { label: "Cash-out proposal approved with Touch ID", sig: "3b7KNHLUENg36RWemfqc6N2nXhTbjZSDeQqu9xkkzeSio9rPojq6JgJGRSXk1wYRtLU2vg3qiwm8duBpcmjYKTq1" },
];

export function LiveProof() {
  return (
    <section id="proof" aria-labelledby="proof-title" className={SECTION}>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start lg:gap-16">
        <div>
          <h2 id="proof-title" className={H2}>Not a mock-up. Measured on Solana mainnet.</h2>
          <p className="mt-4 max-w-[46ch] text-lg text-ink-2">
            From our production rehearsal on 29 September 2026: a real buyer wallet paying a real invoice, timed by the listener that watches every payment. Open any line on Solscan.
          </p>
        </div>
        <figure className="rounded-xl bg-surface shadow-card ring-1 ring-line">
          <figcaption className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-4 sm:px-6">
            <span className="text-base font-semibold text-ink">Payment receipt, INV-2026-0154</span>
            <span className="text-sm tabular text-ink-3">29 Sep 2026</span>
          </figcaption>
          <dl className="grid grid-cols-3 divide-x divide-line border-b border-line">
            {[
              ["Seen to paid", "0.15", "s"],
              ["To settled", "7.9", "s"],
              ["Buyer's network fee", "0", "SOL"],
            ].map(([k, v, unit]) => (
              <div key={k} className="flex flex-col justify-between px-4 py-5 sm:px-6">
                <dt className="text-sm text-ink-2">{k}</dt>
                <dd className="mt-1 text-3xl font-bold tracking-tight tabular text-ink sm:text-4xl">
                  {v}<span className="ml-1 text-base font-semibold text-ink-3">{unit}</span>
                </dd>
              </div>
            ))}
          </dl>
          <ul className="divide-y divide-line">
            {PROOF.map((p) => (
              <li key={p.sig}>
                <a href={SOLSCAN(p.sig)} target="_blank" rel="noopener noreferrer" className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-3.5 transition-colors duration-(--dur-fast) hover:bg-paper-2/50 sm:px-6">
                  <span className="text-base text-ink">{p.label.split(/(INV-\d{4}-\d+)/).map((part, i) => (i % 2 ? <span key={i} className="whitespace-nowrap">{part}</span> : part))}</span>
                  <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm tabular text-accent">
                    {short(p.sig)} <ArrowUpRight size={14} aria-hidden="true" />
                    <span className="sr-only">(opens Solscan)</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </figure>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// Features: a bento with one large tile, not a row of identical cards.
// ---------------------------------------------------------------------------------------------

const FEATURES = [
  { icon: Terminal, title: "A command bar that answers", body: "Ask \"Who is overdue?\" or \"Sweep now\" in plain words. It shows you the answer or the action first; nothing moves until you confirm." },
  { icon: ScanLine, title: "SOL in, exact USDC out", body: "A buyer holding SOL still pays the exact invoice amount: the conversion happens inside their payment, and you get the receipt with the rate." },
  { icon: Bot, title: "Your buyers' AP bots can pay too", body: "Invoices speak x402, the HTTP payment standard, so an accounts-payable agent can settle them without a person clicking." },
  { icon: Fingerprint, title: "Touch ID for every approval", body: "Cash-outs, new addresses and permission changes are signed with your passkey. No seed phrase to lose." },
  { icon: Landmark, title: "A treasury only you control", body: "Payments sweep into a Squads account you own. Kutip's agent can only move buyer payments into it, capped per day on chain." },
];

export function Features() {
  return (
    <section id="features" aria-labelledby="features-title" className={SECTION}>
      <h2 id="features-title" className={H2}>Everything a finance admin chases by hand, handled.</h2>
      <div className="mt-12 grid gap-4 md:grid-cols-6">
        <article className="rounded-xl bg-surface p-6 shadow-card md:col-span-6 lg:col-span-3 lg:row-span-2 sm:p-8">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-accent-soft text-accent"><Sparkles size={18} aria-hidden="true" /></span>
          <h3 className="mt-5 text-2xl font-semibold tracking-tight text-ink">An agent that collects, and an inbox for every reply</h3>
          <p className="mt-3 max-w-[48ch] text-base leading-relaxed text-ink-2">
            Friendly, firm and final reminders in the buyer&apos;s working hours, never more than one a day. When a buyer answers, the agent reads it as a promise to pay, a question or a dispute, drafts a reply and waits for you. Discounts, disputes and anything about money always come to you.
          </p>
          <ul className="mt-6 grid gap-2 text-sm text-ink-2">
            {[
              [Inbox, "One thread per invoice, from email, WhatsApp notes or the pay page"],
              [Bot, "Every action logged with its rule and confidence"],
            ].map(([Icon, text]) => {
              const I = Icon as typeof Inbox;
              return (
                <li key={text as string} className="flex items-start gap-2.5">
                  <I size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-accent" />
                  {text as string}
                </li>
              );
            })}
          </ul>
        </article>
        {FEATURES.map(({ icon: Icon, title, body }, i) => (
          <article key={title} className={`rounded-xl bg-surface p-6 shadow-card md:col-span-3 ${i < 2 ? "lg:col-span-3" : "lg:col-span-2"}`}>
            <Icon size={18} aria-hidden="true" className="text-accent" />
            <h3 className="mt-4 text-lg font-semibold tracking-tight text-ink">{title}</h3>
            <p className="mt-1.5 text-base text-ink-2">{body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// Trust and compliance: the posture from docs/SPEC.md §6, in plain words.
// ---------------------------------------------------------------------------------------------

const TRUST = [
  { title: "Non-custodial", body: "Funds sit in your own Squads multisig. Kutip holds only an agent key limited to sweeping into it, and a fee-payer key with a small float for network fees." },
  { title: "No ringgit touches Kutip", body: "You cash out yourself: USDC goes to your own whitelisted deposit address at a Securities Commission-registered exchange, and you sell there. Kutip never converts or holds ringgit." },
  { title: "Every paying wallet screened", body: "Before a payment is built, the buyer's wallet is checked against the OFAC sanctions list and basic history signals. A flagged wallet is refused." },
  { title: "A trail you can audit", body: "Every payment, sweep and approval has an on-chain signature, and every agent decision a written reason and the rule behind it." },
  { title: "Clear about the rules", body: "Stablecoins are an agreed settlement asset, not legal tender. We would apply to Bank Negara Malaysia's Digital Asset Innovation Hub before ever adding custody or ringgit conversion." },
  { title: "Ringgit stablecoin, when it's allowed", body: "When a ringgit stablecoin such as MYRC is approved for this use, buyers could pay in it and the conversion step disappears. Until then, USD in and your own cash-out." },
];

export function Trust() {
  return (
    <section id="trust" aria-labelledby="trust-title" className={SECTION}>
      <div className="rounded-2xl bg-paper-2/70 p-6 ring-1 ring-line sm:p-10">
        <h2 id="trust-title" className={H2}>Built to pass the questions your bank would ask.</h2>
        <dl className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
          {TRUST.map((t) => (
            <div key={t.title} className="border-t border-line-strong pt-4">
              <dt className="text-lg font-semibold tracking-tight text-ink">{t.title}</dt>
              <dd className="mt-1.5 text-base text-ink-2">{t.body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// Who it's for.
// ---------------------------------------------------------------------------------------------

export function WhoFor() {
  return (
    <section aria-labelledby="who-title" className={SECTION}>
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <h2 id="who-title" className={H2}>Made in Muar, for the furniture belt first.</h2>
          <p className="mt-4 max-w-[50ch] text-lg leading-relaxed text-ink-2">
            Muar and Batu Pahat ship teak and rubberwood furniture to Australia, the United States, the Gulf and Japan on 30 to 60 day terms. The finance admin chases every invoice by email across four time zones and waits days for each wire. Kutip is built around that desk.
          </p>
        </div>
        <div className="grid content-start gap-3 lg:pt-3">
          {[
            ["Today", "Malaysian furniture and wood-product exporters selling to overseas buyers in USD."],
            ["Next", "Any Malaysian SME invoicing abroad: rubber gloves, electronics parts, food, services."],
            ["After that", "Exporters across emerging markets who lose days and margin to correspondent banking."],
          ].map(([when, what]) => (
            <div key={when} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-4 rounded-lg bg-surface px-5 py-4 shadow-card">
              <span className="text-sm font-medium text-accent">{when}</span>
              <span className="text-base text-ink">{what}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// FAQ: native <details>, keyboard and screen-reader friendly with no script.
// ---------------------------------------------------------------------------------------------

const FAQ = [
  { q: "Does my buyer need to know anything about crypto?", a: "They need a Solana wallet app holding USDC or SOL. They open the pay link, check the invoice and press Pay. There is no gas to top up; Kutip pays the network fee." },
  { q: "How do I get ringgit?", a: "From your treasury you send USDC to your own whitelisted deposit address at a Securities Commission-registered exchange, approve it with Touch ID, and sell for ringgit there. Kutip alerts you when the rate beats its 30-day average." },
  { q: "Can Kutip take my money?", a: "No. The treasury is a Squads multisig you control with your passkey. Kutip's agent key can only sweep buyer payments into that treasury, up to the daily limit you set, and the limit is enforced on chain." },
  { q: "What if a buyer disputes an invoice or asks for a discount?", a: "The agent stops reminding, marks it for you and drafts a holding reply. Discounts above your rulebook's limit, disputes and anything about amounts always wait for your decision." },
  { q: "Can buyers see each other or my other invoices?", a: "No. Each buyer pays into its own receiving account, nothing on chain names a buyer or an invoice, and line items never leave your database." },
];

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className={SECTION}>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:gap-16">
        <h2 id="faq-title" className={H2}>Questions finance teams ask first.</h2>
        <div className="divide-y divide-line border-y border-line">
          {FAQ.map((f) => (
            <details key={f.q} className="group py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md py-4 text-lg font-medium text-ink [&::-webkit-details-marker]:hidden">
                {f.q}
                <span aria-hidden="true" className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-paper-2 text-ink-2 transition-transform duration-(--dur-fast) group-open:rotate-45">+</span>
              </summary>
              <p className="max-w-[62ch] pb-5 text-base leading-relaxed text-ink-2">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// Final call to action.
// ---------------------------------------------------------------------------------------------

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6 lg:pb-28">
      <div className="flex flex-col items-start justify-between gap-8 rounded-2xl bg-surface p-8 shadow-card ring-1 ring-line sm:p-12 lg:flex-row lg:items-center">
        <div>
          <h2 id="cta-title" className="max-w-[20ch] text-3xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-[2.5rem]">Send your next invoice with Kutip.</h2>
          <p className="mt-3 max-w-[48ch] text-lg text-ink-2">Set up takes a few minutes: your company, a passkey, and a treasury that is yours from the first payment.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/onboarding" className={buttonClass("primary", "lg")}>Get started</Link>
          <Link href="/pay/inv_demo" className={buttonClass("outline", "lg")}>See what your buyer sees</Link>
        </div>
      </div>
    </section>
  );
}
