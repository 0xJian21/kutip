"use client";

import Link from "next/link";
import { Check, Copy, FileText, MessageCircle, Plus, Send, Trash2, Upload } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { Button, ButtonLink, buttonClass } from "@/components/ui/button";
import { Card, CardHeader, Inset } from "@/components/ui/card";
import { Checkbox, Field, Input, PrefixedInput, Select, DateInput } from "@/components/ui/field";
import { CopyField } from "@/components/ui/copy-field";
import { QrCode } from "@/components/pay/qr-code";
import { InvoiceDocument } from "@/components/invoices/invoice-document";
import { createInvoice, readInvoicePdf } from "@/lib/data/actions";
import { unwrap } from "@/lib/data/result";
import { formatUsdc, formatUsdcExact, parseUsdc, type BnmRate } from "@/lib/ui/money";
import { formatDate } from "@/lib/ui/format";
import type { Buyer, Exporter, LineItem } from "@/lib/ui/types";

type Line = { description: string; quantity: string; unitPrice: string };
type Phase = "edit" | "reading" | "created";

const EMPTY_LINES: Line[] = [{ description: "", quantity: "1", unitPrice: "" }];
const priceInput = (n: bigint) => formatUsdcExact(n).replace(/,/g, "").replace(/0{1,4}$/, "");

/**
 * Form on the left, the invoice as a document on the right, updating as you type.
 * "Import from PDF" fills the form through the extractor (server action); the
 * PDF can also be dropped anywhere on the form. Send creates the invoice with a
 * fresh reference key and emails the pay link.
 */
const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

/**
 * `emailRestricted`: no verified sending domain yet (EMAIL_ALLOWLIST is not "*"), so only the
 * owner's own inbox gets mail; anyone else gets a pay link to share instead. Said up front.
 */
export function NewInvoice({ buyers, exporter, rate, emailRestricted }: { buyers: Buyer[]; exporter: Exporter; rate: BnmRate; emailRestricted: boolean }) {
  const [phase, setPhase] = useState<Phase>("edit");
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [buyerId, setBuyerId] = useState(buyers[0]?.id ?? "");
  const [sendTo, setSendTo] = useState(buyers[0]?.email ?? "");
  const [sendToTouched, setSendToTouched] = useState(false);
  const [saveForBuyer, setSaveForBuyer] = useState(true);
  const [ccMe, setCcMe] = useState(false);
  const [number, setNumber] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [lines, setLines] = useState<Line[]>(EMPTY_LINES);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<Extract<Awaited<ReturnType<typeof createInvoice>>, { ok: true }>["value"] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      const x = unwrap(await readInvoicePdf(form));
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

  function onDrop(e: DragEvent<HTMLElement>) {
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
    if (!EMAIL.test(sendTo.trim())) return (setSendToTouched(true), setError("Enter the buyer's email, like accounts@buyer.com."));
    const lineItems = lines
      .filter((l) => l.description.trim() || l.unitPrice.trim())
      .map((l) => ({ description: l.description.trim(), quantity: Number.parseInt(l.quantity, 10), unitPriceUsdc: parseUsdc(l.unitPrice) }));
    if (total <= 0n || lineItems.some((l) => !l.description || !Number.isFinite(l.quantity) || l.quantity <= 0 || l.unitPriceUsdc === null)) {
      return setError("Every line needs an item, a quantity and a price.");
    }
    setError(null);
    setCreating(true);
    try {
      setCreated(unwrap(await createInvoice({ buyerId, number, dueDate, lineItems: lineItems.map((l) => ({ ...l, unitPriceUsdc: l.unitPriceUsdc! })), sendTo: sendTo.trim(), ccMe, saveForBuyer: changedAddress && saveForBuyer })));
      setPhase("created");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  const buyer = buyers.find((b) => b.id === buyerId);
  const reading = phase === "reading";
  const changedAddress = !!buyer && sendTo.trim().toLowerCase() !== buyer.email.toLowerCase();
  const sendToError = sendToTouched && !EMAIL.test(sendTo.trim()) ? "Enter the buyer's email, like accounts@buyer.com" : undefined;

  function chooseBuyer(id: string) {
    setBuyerId(id);
    setSendTo(buyers.find((b) => b.id === id)?.email ?? "");
    setSendToTouched(false);
    setSaveForBuyer(true);
  }

  // What the preview shows: every line the form has, even half-filled.
  const previewLines: LineItem[] = lines
    .filter((l) => l.description.trim() || l.unitPrice.trim())
    .map((l) => ({ description: l.description, quantity: Math.max(0, Number.parseInt(l.quantity, 10) || 0), unitPriceUsdc: parseUsdc(l.unitPrice) ?? 0n }));

  function reset() {
    setPhase("edit");
    setCreated(null);
    setFileName(null);
    setNumber("");
    setDueDate("");
    setSendTo(buyer?.email ?? "");
    setSendToTouched(false);
    setCcMe(false);
    setLines(EMPTY_LINES);
    setWarnings([]);
    setError(null);
  }

  const document = (
    <InvoiceDocument
      from={{ name: exporter.name, logo: exporter.logoUrl, lines: [exporter.registrationNo ? `SSM ${exporter.registrationNo}` : "", exporter.address || exporter.city].filter(Boolean) }}
      to={buyer ? { name: buyer.name, lines: [buyer.contactName, `${buyer.city}, ${buyer.countryName}`] } : undefined}
      number={created?.number ?? number}
      issuedAt=""
      dueDate={dueDate || undefined}
      lineItems={previewLines}
      totalUsdc={total}
      rate={rate}
      aside={
        <div className="w-32 shrink-0">
          {created ? (
            <div className="rounded-md bg-surface p-1.5 ring-1 ring-inset ring-line"><QrCode value={created.payUrl} /></div>
          ) : (
            <div className="flex aspect-square items-center justify-center rounded-md bg-well text-center text-xs text-ink-3 ring-1 ring-inset ring-line">Pay QR appears once sent</div>
          )}
        </div>
      }
    />
  );

  if (phase === "created" && created) {
    const { id: invoiceId, payUrl } = created;
    const delivered = created.delivery === "sent";
    const notSent =
      created.delivery === "skipped"
        ? "Email not sent: Kutip can only email you until a domain is verified."
        : created.delivery === "recorded"
          ? "Email not sent: no email provider is set up yet."
          : "Email not sent: the email provider refused it.";
    // Numbers and dates from the server's invoice, never retyped.
    const share = `Invoice ${created.number} from ${exporter.name}: USD ${formatUsdc(created.amountUsdc)}, due ${formatDate(created.dueDate)}. Pay online in USDC or SOL, no network fee: ${payUrl}`;
    return (
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-6">
        <Card>
          <CardHeader title={delivered ? "Invoice sent" : "Invoice created"} caption={created.number} />
          {delivered ? (
            <p className="mt-4 text-base text-ink">
              Emailed to {created.sentTo}{created.cc ? `, with a copy to ${created.cc}` : ""}. The first reminder goes out three days before {formatDate(created.dueDate)}.
            </p>
          ) : (
            <div role="status" className="mt-4">
              <Inset className="px-4 py-3.5">
                <p className="text-base font-medium text-ink">{notSent}</p>
                <p className="mt-1 text-sm text-ink-2">Nothing went to {created.sentTo}. Send the buyer the pay link yourself; the attempt is recorded on the invoice.</p>
              </Inset>
            </div>
          )}
          <div className="mt-5"><CopyField label="Pay link" value={payUrl} href={`/pay/${invoiceId}`} /></div>
          <div className="mt-3 flex flex-wrap gap-2">
            <CopyButton value={payUrl} variant={delivered ? "outline" : "secondary"} />
            <a
              href={`https://wa.me/?text=${encodeURIComponent(share)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass("outline", "md")}
            >
              <MessageCircle size={15} aria-hidden="true" />
              Share on WhatsApp
            </a>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-5">
            <ButtonLink href={`/invoices/${invoiceId}`}>View invoice</ButtonLink>
            <ButtonLink variant="ghost" href={`/pay/${invoiceId}`}>Open pay page</ButtonLink>
            <Button variant="ghost" onClick={reset}>Create another</Button>
          </div>
        </Card>
        <div>{document}</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-6">
      {/* The whole form accepts a dropped PDF. */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`min-w-0 rounded-xl transition-shadow duration-(--dur-fast) ${dragging ? "ring-2 ring-accent" : ""}`}
      >
      <Card as="section">
        <input ref={inputRef} type="file" accept="application/pdf" className="sr-only" onChange={(e) => accept(e.target.files?.[0])} />
        <CardHeader
          title="Invoice details"
          caption={fileName ? `Read from ${fileName}. Check every field.` : "Fill in the form, or import the PDF you already send."}
          aside={
            <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={reading}>
              <Upload size={14} aria-hidden="true" />
              Import from PDF
            </Button>
          }
        />

        {reading ? (
          <Inset className="mt-5 flex items-center gap-3 px-4 py-3" aria-live="polite">
            <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <FileText size={16} aria-hidden="true" />
              <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full bg-accent/20" />
            </span>
            <span>
              <span className="block text-base font-medium text-ink">Reading {fileName}…</span>
              <span className="block text-sm text-ink-2">Finding the buyer, line items, total and due date.</span>
            </span>
          </Inset>
        ) : null}
        {error ? <p role="alert" className="mt-4 text-base text-disputed-fg">{error}</p> : null}
        {warnings.length ? (
          <ul className="mt-4 grid gap-1 rounded-md bg-partial-bg px-4 py-3 text-sm text-partial-fg" aria-label="Check before sending">
            {warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        ) : null}

        <fieldset disabled={reading} className="mt-5 grid gap-5">
          <Field label="Buyer" required>
            <Select value={buyerId} onChange={(e) => chooseBuyer(e.target.value)}>
              {buyers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <div className="grid gap-2.5">
            <Field
              label="Send to"
              required
              error={sendToError}
              hint={emailRestricted ? "Until a sending domain is verified, Kutip emails only your own inbox. Anyone else gets a pay link you share." : `The invoice and its pay link go here; replies come back to ${exporter.contactEmail || "your email"}.`}
            >
              <Input type="email" inputMode="email" autoComplete="off" value={sendTo} aria-invalid={sendToError ? true : undefined} onChange={(e) => setSendTo(e.target.value)} onBlur={() => setSendToTouched(true)} placeholder="accounts@buyer.com" />
            </Field>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {changedAddress && buyer ? <Checkbox label={<span className="text-sm">Use for {buyer.name} from now on</span>} checked={saveForBuyer} onChange={(e) => setSaveForBuyer(e.target.checked)} /> : null}
              <Checkbox
                label={<span className="text-sm">{exporter.contactEmail ? `CC me (${exporter.contactEmail})` : "CC me (add your email in Settings)"}</span>}
                checked={ccMe}
                disabled={!exporter.contactEmail}
                onChange={(e) => setCcMe(e.target.checked)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Invoice number" hint="Leave blank for the next number">
              <Input value={number} placeholder="INV-2026-0162" onChange={(e) => setNumber(e.target.value)} />
            </Field>
            <Field label="Due date" hint="Reminders start 3 days before" required>
              <DateInput value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-ink">Line items <span className="text-accent">*</span></span>
              <span className="text-sm text-ink-3">Prices in USD</span>
            </div>
            <div className="grid gap-2">
              {lines.map((l, i) => {
                const unit = parseUsdc(l.unitPrice);
                const qty = Number.parseInt(l.quantity, 10) || 0;
                return (
                  // Phone: item + remove, then qty · price · amount. Desktop: one row.
                  <div key={i} className="grid grid-cols-[72px_minmax(0,1fr)_minmax(0,1fr)_32px] items-center gap-2 rounded-md bg-well p-2.5 lg:grid-cols-[minmax(0,1fr)_52px_108px_84px_32px]">
                    <Input aria-label="Item" placeholder="Teak dining table, 200 cm" value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} className="col-span-3 lg:col-span-1" />
                    <button
                      type="button"
                      aria-label="Remove line"
                      disabled={lines.length === 1}
                      onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                      className="inline-flex h-10 w-9 items-center justify-center rounded-full text-ink-3 transition-colors duration-(--dur-fast) hover:bg-paper-2 hover:text-ink disabled:opacity-30 lg:order-last"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                    <Input aria-label="Quantity" inputMode="numeric" className="text-right" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} />
                    <PrefixedInput prefix="USD" aria-label="Unit price" inputMode="decimal" placeholder="0.00" className="text-right" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: e.target.value })} />
                    <span className="truncate text-right tabular text-base text-ink">{unit === null ? "" : formatUsdc(unit * BigInt(qty))}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setLines((ls) => [...ls, { description: "", quantity: "1", unitPrice: "" }])}>
                <Plus size={14} aria-hidden="true" />
                Add a line
              </Button>
              <p className="text-base text-ink-2">
                Total <span className="ml-2 tabular text-lg font-semibold text-ink">{formatUsdc(total)} USD</span>
              </p>
            </div>
          </div>
        </fieldset>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <p className="max-w-[36ch] text-sm text-ink-3">Line items stay private. Only the total and an opaque code go on chain.</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/invoices" className="inline-flex h-10 items-center rounded-full px-3.5 text-base font-medium text-ink-2 hover:bg-paper-2 hover:text-ink">Cancel</Link>
            <Button variant="outline" disabled title="Drafts arrive with the invoice update">Save draft</Button>
            <Button variant="secondary" onClick={create} disabled={creating || reading}>
              <Send size={15} aria-hidden="true" />
              {creating ? "Sending…" : "Send invoice"}
            </Button>
          </div>
        </div>
      </Card>
      </div>

      <div className="lg:sticky lg:top-8 lg:self-start">
        <p className="mb-2 text-sm font-medium text-ink-2">Preview: what the buyer receives</p>
        {document}
      </div>
    </div>
  );
}

function CopyButton({ value, variant }: { value: string; variant: "outline" | "secondary" }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant={variant}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
    >
      {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
      {copied ? "Copied" : "Copy pay link"}
    </Button>
  );
}
