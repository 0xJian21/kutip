import type { Metadata } from "next";
import { InboxView } from "@/components/inbox/inbox-view";
import { PageHeader } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { inbox } from "@/app/api/agent/_lib/deps";
import { MOCK } from "@/lib/server/auth";
import { ownerData } from "@/lib/server/data";

export const metadata: Metadata = { title: "Inbox" };

export default async function InboxPage({ searchParams }: PageProps<"/inbox">) {
  const data = await ownerData("/inbox");
  const header = (
    <PageHeader
      title="Inbox"
      lede="Every conversation with your buyers, one thread per invoice. The agent reads each message and drafts a reply; you approve what goes out."
    />
  );
  if (MOCK) return <>{header}<EmptyState title="The inbox needs the real database" body="Turn off NEXT_PUBLIC_KUTIP_MOCK to see buyer messages." /></>;

  const { thread } = await searchParams;
  const asked = typeof thread === "string" ? thread : undefined;
  const [threads, buyers, invoices, treasury, askedDetail] = await Promise.all([
    inbox().listThreads(data.exporterId),
    data.listBuyers(),
    data.listInvoices({ status: "all" }),
    data.getTreasury(),
    asked ? inbox().getThread(data.exporterId, asked) : null,
  ]);
  const selected = asked ?? threads[0]?.invoiceId;
  const detail = asked ? askedDetail : selected ? await inbox().getThread(data.exporterId, selected) : null;

  return (
    <>
      {header}
      <InboxView
        exporterId={data.exporterId}
        initialThreads={threads}
        initialDetail={detail}
        buyers={buyers}
        invoices={invoices.filter((i) => i.status !== "draft").map((i) => ({ id: i.id, number: i.number, buyerId: i.buyerId }))}
        rate={treasury.rate}
        openOnMobile={typeof thread === "string"}
      />
    </>
  );
}
