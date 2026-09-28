import type { Metadata } from "next";
import { LiveDashboard } from "@/components/dashboard/live-dashboard";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/panel";
import { ownerData } from "@/lib/server/data";
import { scenarioFrom } from "@/lib/ui/scenario";
import { formatDate } from "@/lib/ui/format";

export const metadata: Metadata = { title: "Overview" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const data = await ownerData();
  const scenario = scenarioFrom(await searchParams);
  const [summary, buyers, invoices, exporter] = await Promise.all([
    data.getDashboard({ scenario }),
    data.listBuyers(),
    data.listInvoices(),
    data.getExporter(),
  ]);

  return (
    <>
      <PageHeader
        title="Overview"
        lede={`Ringgit at the Bank Negara reference rate for ${formatDate(summary.rate.date)}.`}
        actions={<ButtonLink href="/invoices/new">New invoice</ButtonLink>}
      />
      <LiveDashboard initial={summary} buyers={buyers} invoices={invoices} exporter={exporter} exporterId={data.exporterId} />
    </>
  );
}
