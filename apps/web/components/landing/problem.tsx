/**
 * "The problem": a wire takes days and costs a hundred ringgit or more; Kutip takes about a second.
 * Drawn to scale on one time axis, so Kutip is a sliver at zero. Estimates are labelled as such.
 */
const DAYS = 5;

export function Problem() {
  return (
    <section id="compare" aria-labelledby="problem-title" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
      <h2 id="problem-title" className="max-w-[22ch] text-3xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-[2.5rem]">
        A wire takes days and eats a slice of every invoice.
      </h2>
      <p className="mt-4 max-w-[58ch] text-lg text-ink-2">
        When a buyer in Sydney or Dallas pays by telegraphic transfer, the money sits with the banks for days, and fees plus the exchange spread come off before it reaches you.
      </p>

      <figure className="mt-12 rounded-xl bg-surface p-5 shadow-card sm:p-8">
        <figcaption className="sr-only">Time for money to arrive, to scale: a bank wire takes 2 to 5 days; Kutip takes about 1 second.</figcaption>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
          {/* Bank wire: arrives some time between day 2 and day 5. */}
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-base font-medium text-ink">Bank wire</p>
              <p className="text-sm tabular text-ink-2">Arrives in 2 to 5 days</p>
            </div>
            <div className="relative mt-3 h-10 overflow-hidden rounded-md bg-paper-2">
              <div className="absolute inset-y-0 left-0 bg-ink/15" style={{ width: `${(2 / DAYS) * 100}%` }} />
              <div className="hatch absolute inset-y-0 bg-ink/5 text-ink/30" style={{ left: `${(2 / DAYS) * 100}%`, width: `${(3 / DAYS) * 100}%` }} />
            </div>
          </div>
          {/* Kutip: about one second, which on a five-day axis is a hairline at zero. */}
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-base font-medium text-ink">Kutip</p>
              <p className="text-sm tabular text-ink-2">Arrives in about 1 second</p>
            </div>
            <div className="relative mt-3 h-10 rounded-md bg-paper-2">
              <div className="absolute inset-y-0 left-0 w-1 rounded-l-md bg-accent" />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-accent">That line is the whole wait.</span>
            </div>
          </div>
          <div className="relative -mt-4 h-5 text-xs tabular text-ink-3" aria-hidden="true">
            {Array.from({ length: DAYS + 1 }, (_, d) => (
              <span key={d} className="absolute -translate-x-1/2 whitespace-nowrap first:translate-x-0 last:-translate-x-full" style={{ left: `${(d / DAYS) * 100}%` }}>
                {d === 0 ? "Sent" : `Day ${d}`}
              </span>
            ))}
          </div>
        </div>

        <dl className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-px overflow-hidden rounded-lg bg-line ring-1 ring-line sm:grid-cols-3">
          <div className="bg-surface p-5">
            <dt className="text-sm text-ink-2">Wire fees, both banks</dt>
            <dd className="mt-1 text-2xl font-bold tracking-tight tabular text-ink">RM 50 to 150</dd>
            <dd className="mt-1 text-xs text-ink-3">Estimate per inbound USD transfer</dd>
          </div>
          <div className="bg-surface p-5">
            <dt className="text-sm text-ink-2">Exchange spread</dt>
            <dd className="mt-1 text-2xl font-bold tracking-tight tabular text-ink">1% to 3%</dd>
            <dd className="mt-1 text-xs text-ink-3">Estimate, hidden in the bank&apos;s rate</dd>
          </div>
          <div className="bg-surface p-5">
            <dt className="text-sm text-ink-2">With Kutip</dt>
            <dd className="mt-1 text-2xl font-bold tracking-tight tabular text-accent">Under RM 0.05</dd>
            <dd className="mt-1 text-xs text-ink-3">Network fee per payment, paid by Kutip. The buyer pays none.</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-ink-3">
          Wire figures are estimates of typical Malaysian bank charges for an inbound USD telegraphic transfer and vary by bank and correspondent. The Kutip figure is the Solana network fee measured on our mainnet payments in September 2026.
        </p>
      </figure>
    </section>
  );
}
