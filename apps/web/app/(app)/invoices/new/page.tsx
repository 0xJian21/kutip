import type { Metadata } from "next";
import { NewInvoice } from "@/components/invoices/new-invoice";
import { PageHeader } from "@/components/ui/panel";
import { ownerData } from "@/lib/server/data";

export const metadata: Metadata = { title: "New invoice" };

/** Only EMAIL_ALLOWLIST=* (set once a sending domain is verified, see README) lets Kutip email any buyer. */
const emailRestricted = () => !process.env.RESEND_API_KEY || !(process.env.EMAIL_ALLOWLIST ?? "").split(",").map((a) => a.trim()).includes("*");

export default async function NewInvoicePage() {
  const data = await ownerData();
  const [buyers, exporter, summary] = await Promise.all([data.listBuyers(), data.getExporter(), data.getDashboard()]);
  return (
    <>
      <PageHeader title="New invoice" lede="The buyer gets the pay link by email and pays in one scan. Kutip chases it from the due date." />
      {/* New key per request: the sidebar link to this same URL starts a fresh form instead of showing the last invoice. */}
      <NewInvoice key={crypto.randomUUID()} buyers={buyers} exporter={exporter} rate={summary.rate} emailRestricted={emailRestricted()} />
    </>
  );
}
