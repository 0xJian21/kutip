import type { Metadata } from "next";
import { NewInvoice } from "@/components/invoices/new-invoice";
import { PageHeader } from "@/components/ui/panel";
import { ownerData } from "@/lib/server/data";

export const metadata: Metadata = { title: "New invoice" };

export default async function NewInvoicePage() {
  const data = await ownerData();
  const buyers = await data.listBuyers();
  return (
    <>
      <PageHeader title="New invoice" lede="Drop the PDF you already send. Kutip reads it, you check it, and the pay link goes out with the email." />
      <div className="max-w-3xl">
        <NewInvoice buyers={buyers} />
      </div>
    </>
  );
}
