import type { Metadata } from "next";
import { AgentPermissionsForm } from "@/components/settings/agent-permissions";
import { PageHeader } from "@/components/ui/panel";
import { ErrorState } from "@/components/ui/states";
import { ownerData } from "@/lib/server/data";
import { readAgentPermissions } from "@/lib/treasury/permissions";

export const metadata: Metadata = { title: "Agent permissions" };

export default async function AgentPermissionsPage() {
  const data = await ownerData("/settings/agent-permissions");
  let view: Awaited<ReturnType<typeof readAgentPermissions>> | null = null;
  let error: string | undefined;
  try {
    view = await readAgentPermissions(data.exporterId);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  return (
    <>
      <PageHeader eyebrow="Settings" title="Agent permissions" lede="What Kutip's agent may do without asking you. You approved these once with Touch ID during setup; changing them asks again." />
      {view ? <AgentPermissionsForm initial={view} /> : <ErrorState title="Couldn't read the agent's permissions" message={error} />}
    </>
  );
}
