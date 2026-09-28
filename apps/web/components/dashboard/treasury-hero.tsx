import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { HeroCard } from "@/components/ui/card";
import { Meter } from "@/components/ui/charts";
import { Amount } from "@/components/ui/money";
import { Chip } from "@/components/ui/status-pill";
import { formatRate, formatUsdc, toMyr, type BnmRate } from "@/lib/ui/money";
import { solscanAccount } from "@/lib/ui/format";

/**
 * The one gradient card. Balance in ringgit, USDC beneath, the agent's daily
 * cap as a meter, and the two money actions. "Sweep now" waits for Session 8b's
 * manual sweep (PLAN.md Requests); "Cash out" goes to the treasury page.
 */
export function TreasuryHero({
  balanceUsdc,
  rate,
  vault,
  waitingUsdc,
  dailyLimitUsdc,
}: {
  balanceUsdc: bigint;
  rate: BnmRate;
  vault?: string;
  /** Sitting in buyer accounts, not yet swept. */
  waitingUsdc?: bigint;
  dailyLimitUsdc?: bigint;
}) {
  return (
    <HeroCard>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-on-hero-2">In your treasury</p>
        {vault ? (
          <a href={solscanAccount(vault)} target="_blank" rel="noopener noreferrer" className="rounded-full">
            <Chip tone="hero">
              Verified on Solana <ArrowUpRight size={12} aria-hidden="true" />
            </Chip>
          </a>
        ) : null}
      </div>
      <Amount sen={toMyr(balanceUsdc, rate)} size="xl" tone="hero" className="mt-2" />
      <p className="mt-1.5 text-sm tabular text-on-hero-2">
        {formatUsdc(balanceUsdc)} USDC · BNM rate {formatRate(rate)}
      </p>
      {waitingUsdc !== undefined && dailyLimitUsdc !== undefined ? (
        <Meter
          tone="hero"
          className="mt-5"
          label="Waiting in buyer accounts"
          value={Number(waitingUsdc / 1_000_000n)}
          max={Number(dailyLimitUsdc / 1_000_000n)}
          valueText={`USD ${formatUsdc(waitingUsdc, 0)}`}
          maxText={`${formatUsdc(dailyLimitUsdc, 0)} a day`}
        />
      ) : null}
      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="hero" disabled title="Manual sweep arrives with the treasury update">
          Sweep now
        </Button>
        <Link href="/treasury" className={buttonClass("heroOutline")}>
          Cash out to ringgit
        </Link>
      </div>
      <p className="mt-3 text-xs text-on-hero-2">Sweep now arrives with the next treasury update. Until then the agent sweeps once a day.</p>
    </HeroCard>
  );
}
