import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PayCard } from "@/components/pay/pay-card";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getPayInvoice } from "@/lib/server/data";
import { appUrl } from "@/lib/server/store";
import { scenarioFrom } from "@/lib/ui/scenario";

export async function generateMetadata({ params }: PageProps<"/pay/[invoiceId]">): Promise<Metadata> {
  const { invoiceId } = await params;
  const p = await getPayInvoice(invoiceId);
  return { title: p ? `Pay ${p.invoiceNumber} to ${p.exporterName}` : "Pay" };
}

export default async function PayPage({ params, searchParams }: PageProps<"/pay/[invoiceId]">) {
  const { invoiceId } = await params;
  const scenario = scenarioFrom(await searchParams);
  const pay = await getPayInvoice(invoiceId, { scenario });
  if (!pay) notFound();
  // Solana Pay: encode the link because it carries a query string (PLAN.md Session 3 Request).
  const solEnabled = process.env.PAYMENTS_SOL_ENABLED !== "false" && pay.acceptedTokens.includes("SOL");
  const solHref = solEnabled ? `solana:${encodeURIComponent(`${appUrl()}/api/pay/${pay.invoiceId}?token=SOL`)}` : undefined;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between px-4 py-3">
        <span className="inline-flex items-center gap-2 text-sm text-ink-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-sm bg-accent text-on-accent">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M3 2v10M3 7l6-5M3 7l6 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          Secure payment via Kutip
        </span>
        <ThemeToggle />
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-10 pt-2">
        <PayCard initial={pay} solHref={solHref} />
        <p className="mt-6 text-center text-xs text-ink-3">
          Kutip builds this payment for you and covers the network fee. Your wallet shows the exact amount before you approve.
          <br />Made in Muar, Malaysia.
        </p>
      </main>
    </div>
  );
}
