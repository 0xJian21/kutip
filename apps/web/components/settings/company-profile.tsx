"use client";

import { Upload } from "lucide-react";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { companyProfileSave, logoUpload } from "@/lib/data/treasury-actions";
import type { Exporter } from "@/lib/ui/types";

/** Settings → Company (IMPROVEMENTS R1): what buyers see on invoices, the pay page and receipts. */
export function CompanyProfileForm({ initial }: { initial: Exporter }) {
  const [c, setC] = useState({ name: initial.name, registrationNo: initial.registrationNo, city: initial.city, address: initial.address, contactEmail: initial.contactEmail });
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setNotice(null);
    start(async () => {
      const r = await companyProfileSave(c);
      setNotice(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: r.error });
    });
  }

  function upload(file: File | undefined) {
    if (!file) return;
    setNotice(null);
    start(async () => {
      const form = new FormData();
      form.set("logo", file);
      const r = await logoUpload(form);
      if (r.ok) setLogoUrl(r.value.logoUrl);
      setNotice(r.ok ? { ok: true, text: "Logo updated. It shows on invoices, the pay page and receipts." } : { ok: false, text: r.error });
    });
  }

  return (
    <Card>
      <CardHeader title="Company" caption="Shown on invoices, pay pages and receipts so buyers know who they are paying." />
      <form className="mt-5 grid gap-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="Company logo" hint="PNG, JPEG or WebP, under 512 KB. Square works best.">
          <label className="flex cursor-pointer flex-wrap items-center gap-4 rounded-md border border-dashed border-line-strong bg-well p-4 transition-colors duration-(--dur-fast) hover:border-accent">
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} disabled={pending} />
            <Avatar name={c.name || "Your company"} src={logoUrl} size="lg" shape="square" />
            <span className="min-w-[9rem] flex-1 text-base text-ink">{logoUrl ? "Choose another file to replace it." : "Drop a logo here, or click to choose"}</span>
            <span className={buttonClass("outline", "sm")}><Upload size={14} aria-hidden="true" /> Choose file</span>
          </label>
        </Field>
        <Field label="Legal name" required><Input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} required /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="SSM registration number" hint="For e-invoicing later"><Input value={c.registrationNo} onChange={(e) => setC({ ...c, registrationNo: e.target.value })} /></Field>
          <Field label="City"><Input value={c.city} onChange={(e) => setC({ ...c, city: e.target.value })} /></Field>
        </div>
        <Field label="Registered address" hint="Printed under your name on invoices"><Textarea value={c.address} onChange={(e) => setC({ ...c, address: e.target.value })} /></Field>
        <Field label="Contact email" required hint="Buyers who reply to an invoice email reach this address"><Input type="email" value={c.contactEmail} onChange={(e) => setC({ ...c, contactEmail: e.target.value })} required /></Field>
        {notice ? <p role={notice.ok ? "status" : "alert"} className={`text-sm ${notice.ok ? "text-paid-fg" : "text-disputed-fg"}`}>{notice.text}</p> : null}
        <div className="flex justify-end"><Button type="submit" disabled={pending}>Save</Button></div>
      </form>
    </Card>
  );
}
