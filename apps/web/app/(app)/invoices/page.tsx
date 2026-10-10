import type { Metadata } from "next";
import { InvoiceBrowser } from "@/components/invoices/invoice-filters";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { ownerData } from "@/lib/server/data";
import { scenarioFrom } from "@/lib/ui/scenario";
import type { InvoiceFilter, InvoiceStatus } from "@/lib/ui/types";

export const metadata: Metadata = { title: "Invoices" };

const STATUSES: InvoiceStatus[] = ["draft", "sent", "seen", "paid", "settled", "partially_paid", "overdue", "disputed"];

export default async function InvoicesPage({ searchParams }: PageProps<"/invoices">) {
  const data = await ownerData();
  const sp = await searchParams;
  const scenario = scenarioFrom(sp);
  const statusParam = typeof sp.status === "string" ? sp.status : "all";
  const status = (["all", "open", "needs_attention", ...STATUSES] as string[]).includes(statusParam) ? (statusParam as InvoiceFilter["status"]) : "all";
  const buyerId = typeof sp.buyer === "string" ? sp.buyer : undefined;
  const query = typeof sp.q === "string" ? sp.q : undefined;

  const [invoices, buyers, summary] = await Promise.all([data.listInvoices(undefined, { scenario }), data.listBuyers(), data.getDashboard()]);

  return (
    <>
      <PageHeader title="Invoices" actions={<ButtonLink href="/invoices/new">New invoice</ButtonLink>} />
      {/* Keyed by the URL filter: a link to another filtered view (dashboard, nav) starts from it. */}
      <InvoiceBrowser
        key={`${status}|${buyerId}|${query}`}
        invoices={invoices}
        buyers={buyers}
        rate={summary.rate}
        initial={{ status: status ?? "all", buyerId: buyerId ?? "", query: query ?? "" }}
        noMatch={<EmptyState title="No invoices match" body="Try another status or buyer, or clear the search." compact />}
        empty={
          <EmptyState
            title="No invoices yet"
            body="Fill in the form or import a PDF. Kutip creates the pay link and starts chasing on the due date."
            action={<ButtonLink href="/invoices/new">Create your first invoice</ButtonLink>}
          />
        }
      />
    </>
  );
}
