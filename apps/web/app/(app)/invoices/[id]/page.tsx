import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { InvoiceLive } from "@/components/invoices/invoice-live";
import { MessageThread, ReminderTimeline } from "@/components/invoices/timeline";
import { Address } from "@/components/ui/address";
import { Facts, Panel } from "@/components/ui/panel";
import { CopyField } from "@/components/ui/copy-field";
import { data } from "@/lib/ui/data";
import { scenarioFrom } from "@/lib/ui/scenario";
import { formatDate, localTimeLabel } from "@/lib/ui/format";
import { formatUsdc } from "@/lib/ui/money";

export async function generateMetadata({ params }: PageProps<"/invoices/[id]">): Promise<Metadata> {
  const { id } = await params;
  const d = await data.getInvoice(id);
  return { title: d ? d.invoice.number : "Invoice" };
}

export default async function InvoicePage({ params, searchParams }: PageProps<"/invoices/[id]">) {
  const { id } = await params;
  const scenario = scenarioFrom(await searchParams);
  const detail = await data.getInvoice(id, { scenario });
  if (!detail) notFound();
  const { invoice, buyer, messages, actions } = detail;

  return (
    <>
      <Link href="/invoices" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline">
        <ArrowLeft size={14} aria-hidden="true" />
        Invoices
      </Link>

      <InvoiceLive initial={detail} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr] lg:gap-8">
        <div className="grid content-start gap-6">
          <Panel title="Line items" padded={false}>
            <table className="w-full text-base">
              <thead className="sr-only">
                <tr><th>Item</th><th>Qty</th><th>Unit</th><th>Total</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {invoice.lineItems.map((li, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2.5 text-ink sm:px-6">{li.description}</td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-right tabular text-ink-2">{li.quantity} ×</td>
                    <td className="px-2 py-2.5 text-right tabular text-ink-2">{formatUsdc(li.unitPriceUsdc)}</td>
                    <td className="px-4 py-2.5 text-right tabular font-medium text-ink sm:px-6">{formatUsdc(li.unitPriceUsdc * BigInt(li.quantity))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-line bg-paper-2/60">
                  <td colSpan={3} className="px-4 py-2.5 text-right text-sm text-ink-2 sm:px-6">Total, USD</td>
                  <td className="px-4 py-2.5 text-right tabular font-semibold text-ink sm:px-6">{formatUsdc(invoice.amountUsdc)}</td>
                </tr>
              </tfoot>
            </table>
          </Panel>

          <Panel title="Messages" aside={`${messages.length} ${messages.length === 1 ? "message" : "messages"}`}>
            <MessageThread messages={messages} buyer={buyer} />
          </Panel>
        </div>

        <div className="grid content-start gap-6">
          <Panel title="Buyer">
            <Facts
              items={[
                { label: "Contact", value: <span className="text-left">{buyer.contactName}</span> },
                { label: "Email", value: <span className="break-all">{buyer.email}</span>, muted: true },
                { label: "Location", value: `${buyer.city}, ${buyer.countryName}` },
                { label: "Reminders go out in", value: localTimeLabel(buyer.timezone), muted: true },
                { label: "Issued", value: formatDate(invoice.issuedAt), muted: true },
              ]}
            />
          </Panel>

          <Panel title="Pay link">
            <CopyField label="Buyer pay page" value={invoice.payUrl} href={`/pay/${invoice.id}`} />
            <div className="mt-3">
              <CopyField label="For the buyer's AP system (x402)" value={invoice.x402Url} />
            </div>
          </Panel>

          <Panel title="Reminders">
            <ReminderTimeline actions={actions} buyer={buyer} />
          </Panel>

          <Panel title="Audit trail">
            <Facts
              items={[
                { label: "Receiving account", value: <Address value={buyer.usdcAta} />, muted: true },
                { label: "Reference key", value: <Address value={invoice.referencePubkey} />, muted: true },
                { label: "Memo on chain", value: <span className="tabular">{invoice.memoCode}</span>, muted: true },
              ]}
            />
            <p className="mt-3 text-xs text-ink-3">Nothing on chain names the buyer or the invoice. The memo is an opaque code only Kutip can map back.</p>
          </Panel>
        </div>
      </div>
    </>
  );
}
