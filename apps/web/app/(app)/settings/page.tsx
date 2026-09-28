import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CompanyProfileForm } from "@/components/settings/company-profile";
import { TouchIdCard } from "@/components/settings/agent-permissions";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/panel";
import { ownerData } from "@/lib/server/data";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const data = await ownerData("/settings");
  const exporter = await data.getExporter();
  return (
    <>
      <PageHeader title="Settings" lede="Your company as buyers see it, and what the agent may do on its own." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6">
        <CompanyProfileForm initial={exporter} />
        <div className="grid content-start gap-5 lg:gap-6">
          <Card>
            <CardHeader title="Agent permissions" caption="Daily sweep cap, replies, discounts. Changes need Touch ID." />
            <Link href="/settings/agent-permissions" className="mt-4 inline-flex items-center gap-1.5 text-base font-medium text-accent underline-offset-4 hover:underline">
              Review permissions <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </Card>
          <TouchIdCard />
        </div>
      </div>
    </>
  );
}
