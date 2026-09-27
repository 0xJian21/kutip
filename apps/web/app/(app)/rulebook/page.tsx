import type { Metadata } from "next";
import { RulebookForm } from "@/components/rulebook/rulebook-form";
import { PageHeader } from "@/components/ui/panel";
import { ownerData } from "@/lib/server/data";
import { scenarioFrom } from "@/lib/ui/scenario";

export const metadata: Metadata = { title: "Rulebook" };

export default async function RulebookPage({ searchParams }: PageProps<"/rulebook">) {
  const data = await ownerData();
  const scenario = scenarioFrom(await searchParams);
  const rulebook = await data.getRulebook({ scenario });
  return (
    <>
      <PageHeader title="Rulebook" lede="The agent can only act inside these rules. Change a number and it applies from the next action." />
      <div className="max-w-3xl">
        <RulebookForm initial={rulebook} />
      </div>
    </>
  );
}
