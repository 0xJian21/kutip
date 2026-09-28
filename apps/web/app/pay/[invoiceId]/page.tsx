import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PayCard } from "@/components/pay/pay-card";
import { KutipMark } from "@/components/ui/avatar";
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
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-4 py-3">
        <span className="inline-flex items-center gap-2 text-sm text-ink-2">
          <KutipMark size={22} />
          Secure payment via Kutip
        </span>
        <ThemeToggle />
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-10 pt-1">
        <PayCard initial={pay} solHref={solHref} />
        {/* Session 8c: buyer message thread ("Questions about this invoice? Message {exporter}") renders here, scoped to this invoice. */}
        <section id="buyer-messages" aria-label="Messages about this invoice" className="mt-4" />
        <p className="mt-6 text-center text-xs text-ink-3">
          Kutip builds this payment for you and covers the network fee. Your wallet shows the exact amount before you approve.
          <br />Made in Muar, Malaysia.
        </p>
      </main>
    </div>
  );
}
