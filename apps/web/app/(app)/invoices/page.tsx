import type { Metadata } from "next";
import { Suspense } from "react";
import { InvoiceFilters } from "@/components/invoices/invoice-filters";
import { InvoiceTable } from "@/components/invoices/invoice-table";
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

  const [invoices, all, buyers, summary] = await Promise.all([
    data.listInvoices({ status, buyerId, query }, { scenario }),
    data.listInvoices(),
    data.listBuyers(),
    data.getDashboard(),
  ]);

  const OPEN = new Set(["sent", "seen", "overdue", "partially_paid", "disputed"]);
  const ATTN = new Set(["overdue", "disputed", "partially_paid", "seen"]);
  const counts = {
    all: all.length,
    needs_attention: all.filter((i) => ATTN.has(i.status)).length,
    overdue: all.filter((i) => i.status === "overdue").length,
    open: all.filter((i) => OPEN.has(i.status)).length,
    settled: all.filter((i) => i.status === "settled").length,
    draft: all.filter((i) => i.status === "draft").length,
  };

  const filtered = Boolean(buyerId || query || status !== "all");

  return (
    <>
      <PageHeader title="Invoices" actions={<ButtonLink href="/invoices/new">New invoice</ButtonLink>} />
      <Suspense>
        <InvoiceFilters buyers={buyers} counts={counts} />
      </Suspense>
      <div className="overflow-hidden rounded-md border border-line bg-surface">
        <InvoiceTable
          invoices={invoices}
          buyers={buyers}
          rate={summary.rate}
          empty={
            filtered ? (
              <EmptyState title="No invoices match" body="Try another status or buyer, or clear the search." compact />
            ) : (
              <EmptyState
                title="No invoices yet"
                body="Drop a PDF or fill in a form. Kutip creates the pay link and starts chasing on the due date."
                action={<ButtonLink href="/invoices/new">Create your first invoice</ButtonLink>}
              />
            )
          }
        />
      </div>
    </>
  );
}
