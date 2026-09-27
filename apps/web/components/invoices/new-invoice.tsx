"use client";

import Link from "next/link";
import { FileText, Upload } from "lucide-react";
import { useId, useRef, useState, type DragEvent } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { CopyField } from "@/components/ui/copy-field";
import { Panel } from "@/components/ui/panel";
import { QrCode } from "@/components/pay/qr-code";
import { createInvoice, readInvoicePdf } from "@/lib/data/actions";
import { formatUsdc, formatUsdcExact, parseUsdc } from "@/lib/ui/money";
import { formatDate } from "@/lib/ui/format";
import type { Buyer } from "@/lib/ui/types";

type Line = { description: string; quantity: string; unitPrice: string };
type Phase = "drop" | "reading" | "edit" | "created";

const EMPTY_LINES: Line[] = [{ description: "", quantity: "1", unitPrice: "" }];
const priceInput = (n: bigint) => formatUsdcExact(n).replace(/,/g, "").replace(/0{1,4}$/, "");

/** Drop a PDF → Haiku reads it (server action) → editable fields → createInvoice → pay link + QR. */
export function NewInvoice({ buyers }: { buyers: Buyer[] }) {
  const [phase, setPhase] = useState<Phase>("drop");
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [buyerId, setBuyerId] = useState(buyers[0]?.id ?? "");
  const [number, setNumber] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [lines, setLines] = useState<Line[]>(EMPTY_LINES);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ id: string; number: string; payUrl: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const headingId = useId();

  const total = lines.reduce((sum, l) => {
    const unit = parseUsdc(l.unitPrice);
    const qty = Number.parseInt(l.quantity, 10);
    return unit === null || !Number.isFinite(qty) ? sum : sum + unit * BigInt(Math.max(0, qty));
  }, 0n);

  async function accept(file: File | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("That isn't a PDF. Drop the invoice as a PDF, or fill in the form instead.");
      return;
    }
    setError(null);
    setFileName(file.name);
    setPhase("reading");
    try {
      const form = new FormData();
      form.set("pdf", file);
      const x = await readInvoicePdf(form);
      if (x.buyerId) setBuyerId(x.buyerId);
      setNumber(x.invoiceNumber);
      if (x.dueDate) setDueDate(x.dueDate);
      setLines(x.lineItems.length ? x.lineItems.map((l) => ({ description: l.description, quantity: String(l.quantity), unitPrice: priceInput(l.unitPriceUsdc) })) : EMPTY_LINES);
      setWarnings(x.warnings);
    } catch (e) {
      setError(`Couldn't read that PDF (${(e as Error).message}). Fill in the form instead.`);
    }
    setPhase("edit");
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    accept(e.dataTransfer.files[0]);
  }

  function setLine(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  async function create() {
    if (!buyerId) return setError("Choose a buyer.");
    if (!dueDate) return setError("Enter a due date.");
    const lineItems = lines
      .filter((l) => l.description.trim() || l.unitPrice.trim())
      .map((l) => ({ description: l.description.trim(), quantity: Number.parseInt(l.quantity, 10), unitPriceUsdc: parseUsdc(l.unitPrice) }));
    if (total <= 0n || lineItems.some((l) => !l.description || !Number.isFinite(l.quantity) || l.quantity <= 0 || l.unitPriceUsdc === null)) {
      return setError("Every line needs an item, a quantity and a price.");
    }
    setError(null);
    setCreating(true);
    try {
      setCreated(await createInvoice({ buyerId, number, dueDate, lineItems: lineItems.map((l) => ({ ...l, unitPriceUsdc: l.unitPriceUsdc! })) }));
      setPhase("created");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  const buyer = buyers.find((b) => b.id === buyerId);

  if (phase === "created" && created) {
    const { id: invoiceId, payUrl } = created;
    return (
      <Panel title="Invoice created and sent" aside={<span className="tabular">{created.number}</span>}>
        <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-start">
          <div className="mx-auto w-44 rounded-md border border-line bg-paper p-3 sm:mx-0">
            <QrCode value={payUrl} />
          </div>
          <div className="grid gap-4">
            <p className="text-base text-ink">
              Sent to {buyer?.contactName} at {buyer?.email}. The first reminder goes out three days before {formatDate(dueDate)}.
            </p>
            <CopyField label="Pay link" value={payUrl} href={`/pay/${invoiceId}`} />
            <div className="flex flex-wrap gap-2">
              <ButtonLink href={`/invoices/${invoiceId}`}>View invoice</ButtonLink>
              <ButtonLink variant="secondary" href={`/pay/${invoiceId}`}>Open pay page</ButtonLink>
            </div>
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <div className="grid gap-6">
      {phase !== "edit" ? (
        <div
          role="button"
          tabIndex={0}
          aria-labelledby={headingId}
          onClick={() => phase === "drop" && inputRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && phase === "drop" && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex min-h-56 cursor-pointer flex-col items-center justify-center gap-3 rounded-md border border-dashed px-6 py-10 text-center transition-colors duration-(--dur-fast) ${
            dragging ? "border-accent bg-accent-soft/60 shadow-float" : "border-line-strong bg-surface hover:bg-paper-2/60"
          }`}
        >
          <input ref={inputRef} type="file" accept="application/pdf" className="sr-only" onChange={(e) => accept(e.target.files?.[0])} />
          {phase === "reading" ? (
            <>
              <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
                <FileText size={18} aria-hidden="true" />
                <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full bg-accent/20" />
              </span>
              <p id={headingId} className="text-md font-medium text-ink" aria-live="polite">AI is reading your invoice…</p>
              <p className="text-base text-ink-2">{fileName}. Finding the buyer, line items, total and due date.</p>
            </>
          ) : (
            <>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-paper-2 text-ink-2">
                <Upload size={18} aria-hidden="true" />
              </span>
              <p id={headingId} className="text-md font-medium text-ink">Drop the invoice PDF here</p>
              <p className="text-base text-ink-2">or click to choose a file. Kutip reads it and fills the form for you to check.</p>
              <button type="button" onClick={(e) => { e.stopPropagation(); setPhase("edit"); }} className="mt-1 text-base font-medium text-accent underline-offset-4 hover:underline">
                Fill in the form instead
              </button>
            </>
          )}
        </div>
      ) : null}

      {error ? <p role="alert" className="text-base text-disputed-fg">{error}</p> : null}
      {phase === "edit" && warnings.length ? (
        <ul className="grid gap-1 rounded-md border border-partial-fg/30 bg-partial-bg px-4 py-3 text-base text-partial-fg" aria-label="Check before sending">
          {warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      ) : null}

      {phase === "edit" ? (
        <Panel title="Check the details" aside={fileName ? <span className="truncate">Read from {fileName}</span> : undefined}>
          <div className="grid gap-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Buyer" className="sm:col-span-1">
                <Select value={buyerId} onChange={(e) => setBuyerId(e.target.value)}>
                  {buyers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </Field>
              <Field label="Invoice number">
                <Input value={number} placeholder="Next number" onChange={(e) => setNumber(e.target.value)} />
              </Field>
              <Field label="Due date" hint="Reminders start 3 days before">
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </Field>
            </div>

            <div>
              <div className="mb-2 grid grid-cols-[1fr_72px_112px_112px] gap-2 text-sm font-medium text-ink-2">
                <span>Item</span><span className="text-right">Qty</span><span className="text-right">Unit, USD</span><span className="text-right">Total</span>
              </div>
              <div className="grid gap-2">
                {lines.map((l, i) => {
                  const unit = parseUsdc(l.unitPrice);
                  const qty = Number.parseInt(l.quantity, 10) || 0;
                  return (
                    <div key={i} className="grid grid-cols-[1fr_72px_112px_112px] items-center gap-2">
                      <Input aria-label="Item" value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} />
                      <Input aria-label="Quantity" inputMode="numeric" className="text-right" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} />
                      <Input aria-label="Unit price" inputMode="decimal" className="text-right" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: e.target.value })} />
                      <span className="text-right tabular text-base text-ink">{unit === null ? "—" : formatUsdc(unit * BigInt(qty))}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <button type="button" onClick={() => setLines((ls) => [...ls, { description: "", quantity: "1", unitPrice: "" }])} className="text-base font-medium text-accent underline-offset-4 hover:underline">
                  Add a line
                </button>
                <p className="text-base text-ink-2">
                  Total <span className="ml-2 tabular text-lg font-semibold text-ink">{formatUsdc(total)} USD</span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <p className="text-sm text-ink-3">Line items stay private. Only the total and an opaque code go on chain.</p>
              <div className="flex gap-2">
                <Link href="/invoices" className="inline-flex h-9 items-center rounded-sm px-3 text-base font-medium text-ink-2 hover:bg-paper-2 hover:text-ink">Cancel</Link>
                <Button onClick={create} disabled={creating}>{creating ? "Creating…" : "Create and send"}</Button>
              </div>
            </div>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
