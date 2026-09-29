import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { InvoiceDocument } from "@/components/invoices/invoice-document";
import { InvoiceLive } from "@/components/invoices/invoice-live";
import { MessageThread, ReminderTimeline } from "@/components/invoices/timeline";
import { SimulateReply } from "@/components/invoices/simulate-reply";
import { Address } from "@/components/ui/address";
import { Card, CardHeader } from "@/components/ui/card";
import { Facts } from "@/components/ui/panel";
import { CopyField } from "@/components/ui/copy-field";
import { ownerData } from "@/lib/server/data";
import { scenarioFrom } from "@/lib/ui/scenario";
import { formatDate, localTimeLabel } from "@/lib/ui/format";

export async function generateMetadata({ params }: PageProps<"/invoices/[id]">): Promise<Metadata> {
  const data = await ownerData();
  const { id } = await params;
  const d = await data.getInvoice(id);
  return { title: d ? d.invoice.number : "Invoice" };
}

export default async function InvoicePage({ params, searchParams }: PageProps<"/invoices/[id]">) {
  const data = await ownerData();
  const { id } = await params;
  const scenario = scenarioFrom(await searchParams);
  const [detail, exporter] = await Promise.all([data.getInvoice(id, { scenario }), data.getExporter()]);
  if (!detail) notFound();
  const { invoice, buyer, messages, actions, rate } = detail;

  return (
    <>
      <Link href="/invoices" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline">
        <ArrowLeft size={14} aria-hidden="true" />
        Invoices
      </Link>

      <InvoiceLive initial={detail} exporterId={data.exporterId} />

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 lg:mt-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-5 lg:gap-6">
          <InvoiceDocument
            from={{ name: exporter.name, logo: exporter.logoUrl, lines: [exporter.registrationNo ? `SSM ${exporter.registrationNo}` : "", exporter.address || exporter.city].filter(Boolean) }}
            to={{ name: buyer.name, lines: [buyer.contactName, buyer.address || `${buyer.city}, ${buyer.countryName}`] }}
            number={invoice.number}
            issuedAt={invoice.issuedAt}
            dueDate={invoice.dueDate}
            lineItems={invoice.lineItems}
            totalUsdc={invoice.amountUsdc}
            receivedUsdc={invoice.receivedUsdc}
            rate={rate}
            note={null}
          />

          <Card>
            <CardHeader title="Messages" caption={`${messages.length} ${messages.length === 1 ? "message" : "messages"} · replies go out in ${localTimeLabel(buyer.timezone)}`} />
            <div className="mt-4">
              <MessageThread messages={messages} buyer={buyer} />
              <SimulateReply invoiceId={invoice.id} buyerName={buyer.contactName} />
            </div>
          </Card>
        </div>

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-5 lg:gap-6">
          <Card>
            <CardHeader title="Buyer" />
            <Facts
              className="mt-4"
              items={[
                { label: "Contact", value: <span className="text-left">{buyer.contactName}</span> },
                { label: "Email", value: <span className="break-all">{invoice.sendTo ?? buyer.email}</span>, muted: true },
                { label: "Location", value: `${buyer.city}, ${buyer.countryName}` },
                { label: "Reminders go out in", value: localTimeLabel(buyer.timezone), muted: true },
                { label: "Issued", value: formatDate(invoice.issuedAt), muted: true },
              ]}
            />
          </Card>

          <Card>
            <CardHeader title="Pay link" />
            <div className="mt-4 grid gap-3">
              <CopyField label="Buyer pay page" value={invoice.payUrl} href={`/pay/${invoice.id}`} />
              <CopyField label="For the buyer's AP system (x402)" value={invoice.x402Url} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Reminders" />
            <div className="mt-4"><ReminderTimeline actions={actions} buyer={buyer} /></div>
          </Card>

          <Card>
            <CardHeader title="Audit trail" />
            <Facts
              className="mt-4"
              items={[
                { label: "Receiving account", value: <Address value={buyer.usdcAta} />, muted: true },
                { label: "Reference key", value: <Address value={invoice.referencePubkey} />, muted: true },
                { label: "Memo on chain", value: <span className="tabular">{invoice.memoCode}</span>, muted: true },
              ]}
            />
            <p className="mt-3 text-xs text-ink-3">Nothing on chain names the buyer or the invoice. The memo is an opaque code only Kutip can map back.</p>
          </Card>
        </div>
      </div>
    </>
  );
}
