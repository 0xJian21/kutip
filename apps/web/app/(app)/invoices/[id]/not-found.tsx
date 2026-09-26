import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";

export default function InvoiceNotFound() {
  return (
    <div className="rounded-md border border-line bg-surface">
      <EmptyState
        title="This invoice doesn't exist"
        body="It may have been deleted, or the link is wrong."
        action={<ButtonLink variant="secondary" href="/invoices">Back to invoices</ButtonLink>}
      />
    </div>
  );
}
