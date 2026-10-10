"use client";

import { UserPlus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { addBuyer } from "@/lib/data/actions";
import { unwrap } from "@/lib/data/result";
import { BUYER_COUNTRIES } from "@/lib/ui/countries";
import type { Buyer } from "@/lib/ui/types";

const EMPTY = { name: "", contactName: "", email: "", country: "US", city: "", address: "" };

/**
 * Add a buyer from the New invoice form. `first`: the account has no buyers yet, so this is
 * step one and is shown open and highlighted. Saving opens the buyer's payment account on
 * Solana (a few seconds); the form says so while it waits.
 */
export function AddBuyer({ first, initialName = "", onAdded, onCancel }: { first: boolean; initialName?: string; onAdded: (b: Buyer) => void; onCancel?: () => void }) {
  const [v, setV] = useState({ ...EMPTY, name: initialName });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));

  async function save() {
    setError(null);
    setSaving(true);
    try {
      onAdded(unwrap(await addBuyer(v)));
      setV(EMPTY);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="add-buyer-title" className="rounded-lg bg-accent-soft/40 p-4 ring-2 ring-accent">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
          <UserPlus size={16} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 id="add-buyer-title" className="text-base font-semibold text-ink">{first ? "Step 1: add your first buyer" : "New buyer"}</h3>
          <p className="mt-0.5 text-sm text-ink-2">
            {first ? "Every invoice goes to a buyer. " : ""}Kutip opens a payment account on Solana for each buyer, so their payments are matched without you checking.
          </p>
        </div>
      </div>
      {/* Its own fieldset: the invoice form below stays editable while this saves. */}
      <fieldset disabled={saving} className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Company" required>
          <Input value={v.name} onChange={set("name")} placeholder="Harbourline Imports LLC" autoComplete="off" autoFocus />
        </Field>
        <Field label="Contact person" required>
          <Input value={v.contactName} onChange={set("contactName")} placeholder="Dana Lee" autoComplete="off" />
        </Field>
        <Field label="Accounts email" required className="sm:col-span-2" hint="Invoices, reminders and receipts go here">
          <Input type="email" inputMode="email" value={v.email} onChange={set("email")} placeholder="accounts@buyer.com" autoComplete="off" />
        </Field>
        <Field label="Country" required>
          <Select value={v.country} onChange={set("country")}>
            {BUYER_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="City" required>
          <Input value={v.city} onChange={set("city")} placeholder="Seattle" autoComplete="off" />
        </Field>
        <Field label="Billing address" className="sm:col-span-2" hint="Optional. Shown under “Billed to” on the invoice">
          <Input value={v.address} onChange={set("address")} placeholder="1201 Western Ave, Seattle WA 98101" autoComplete="off" />
        </Field>
      </fieldset>
      {error ? <p role="alert" className="mt-3 text-sm text-disputed-fg">{error}</p> : null}
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {saving ? <span className="mr-auto text-sm text-ink-2" aria-live="polite">Opening the buyer's payment account on Solana…</span> : null}
        {onCancel ? <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>Cancel</Button> : null}
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? "Adding…" : "Add buyer"}
        </Button>
      </div>
    </section>
  );
}
