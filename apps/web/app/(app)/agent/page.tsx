import type { Metadata } from "next";
import { ActionList } from "@/components/agent/action-list";
import { PageHeader } from "@/components/ui/panel";
import { data } from "@/lib/ui/data";
import { scenarioFrom } from "@/lib/ui/scenario";

export const metadata: Metadata = { title: "Agent activity" };

export default async function AgentPage({ searchParams }: PageProps<"/agent">) {
  const scenario = scenarioFrom(await searchParams);
  const [actions, buyers, invoices] = await Promise.all([data.listAgentActions({ scenario }), data.listBuyers(), data.listInvoices()]);
  return (
    <>
      <PageHeader
        title="Agent activity"
        lede="Everything the agent did or wants to do, with the reason and the rule it followed. It proposes; the rulebook decides; anything outside it waits for you."
      />
      <ActionList initial={actions} buyers={buyers} invoices={invoices} />
    </>
  );
}
