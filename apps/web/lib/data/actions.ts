"use server";

/**
 * Server actions: the only way client components read or write data. Owner actions
 * check the session and scope every call to its exporter; fetchPayInvoice is public.
 */
import Anthropic from "@anthropic-ai/sdk";
import { createMailer, explainAction, extractInvoice, formatUsdc, haikuClassifier, jevClassifier } from "@kutip/agent";
import { Keypair } from "@kutip/solana";
import { refresh } from "next/cache";
import { MOCK, signIn, signOut } from "@/lib/server/auth";
import { getPayInvoice, ownerDataOrThrow } from "@/lib/server/data";
import { validateRulebook } from "@/lib/server/access";
import { recipientEmail } from "@/lib/server/input";
import { llmBudget } from "@/lib/server/llm-budget";
import { handleBuyerReply } from "@/lib/server/replies";
import { store } from "@/lib/server/store";
import { inbox } from "@/app/api/agent/_lib/deps";
import type { LineItem, Rulebook } from "@/lib/ui/types";
import { toResult, UserError } from "./result";

function anthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new UserError("Reading PDFs is not configured on this server (ANTHROPIC_API_KEY)");
  return new Anthropic({ apiKey });
}

/** Sign-in (R3): linked users get a session and go straight in; unlinked ones continue through onboarding. */
async function establishSessionImpl(accessToken: string): Promise<{ linked: true; exporterId: string } | { linked: false }> {
  const r = await signIn(accessToken);
  return r.linked ? { linked: true, exporterId: r.session.exporterId } : { linked: false };
}

export async function endSession(): Promise<void> {
  await signOut();
}

export async function fetchDashboard() {
  return (await ownerDataOrThrow()).getDashboard();
}

export async function fetchAgentActions() {
  return (await ownerDataOrThrow()).listAgentActions();
}

export async function fetchInvoice(id: string) {
  return (await ownerDataOrThrow()).getInvoice(id);
}

export async function fetchPayInvoice(id: string) {
  return getPayInvoice(id);
}

/** Reject any proposed action, or approve one that needs no signature (Squads proposals go through useApproveProposal). */
export async function decideAction(id: string, decision: "approved" | "rejected") {
  return (await ownerDataOrThrow({ write: true })).decideAction(id, decision);
}

export async function saveRulebook(rulebook: Rulebook) {
  return (await ownerDataOrThrow({ write: true })).saveRulebook(validateRulebook(rulebook));
}

const PDF_MAX_BYTES = 4 * 1024 * 1024;

export type ExtractedDraft = {
  buyerId: string | null;
  buyerName: string;
  invoiceNumber: string;
  dueDate: string | null;
  lineItems: LineItem[];
  totalUsdc: bigint;
  warnings: string[];
};

/** New invoice, step 1: Haiku reads the PDF (rule I1). Only the PDF is sent; no stored buyer data. */
async function readInvoicePdfImpl(form: FormData): Promise<ExtractedDraft> {
  const data = await ownerDataOrThrow();
  const file = form.get("pdf");
  if (!(file instanceof File) || file.size === 0) throw new UserError("No PDF received");
  // Vercel caps request bodies at 4.5 MB, so anything larger would 413 before reaching us (FOLLOWUPS).
  if (file.size > PDF_MAX_BYTES) throw new UserError("That PDF is over 4 MB. Export a smaller one or fill in the form.");
  llmBudget.spend(data.exporterId);
  const x = await extractInvoice(anthropic(), new Uint8Array(await file.arrayBuffer()));
  const buyers = await data.listBuyers();
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const match = buyers.find((b) => norm(b.name) === norm(x.buyerName)) ?? buyers.find((b) => norm(x.buyerName).includes(norm(b.name).slice(0, 8)) || norm(b.name).includes(norm(x.buyerName).slice(0, 8)));
  const warnings = [...x.warnings];
  if (!match) warnings.push(`No buyer called "${x.buyerName}" yet; choose one`);
  return { buyerId: match?.id ?? null, buyerName: x.buyerName, invoiceNumber: x.invoiceNumber, dueDate: x.dueDate, lineItems: x.lineItems, totalUsdc: x.totalUsdc, warnings };
}

/** Invoice email with the pay link (SPEC F3). Deterministic template: amounts and dates are never LLM-written. */
function mailer() {
  return createMailer({
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM ?? "Kutip <onboarding@resend.dev>",
    allowlist: (process.env.EMAIL_ALLOWLIST ?? "").split(",").map((a) => a.trim()).filter(Boolean),
    log: (m) => console.warn(`[email] ${m}`),
  });
}

/**
 * New invoice, step 2: create it as sent with a fresh Solana Pay reference key, then email the pay link
 * to the address on the form (EMAIL_ALLOWLIST still decides what is really sent). Every attempt is
 * recorded on the message with its outcome, so a skipped email is never shown as sent.
 */
async function createInvoiceImpl(input: {
  buyerId: string;
  number?: string;
  dueDate: string;
  lineItems: LineItem[];
  /** The buyer's address from the form (pre-filled from the buyer, editable). */
  sendTo: string;
  /** Copy the owner (the exporter's contact email). */
  ccMe?: boolean;
  /** Use `sendTo` for this buyer from now on (reminders and replies go to the buyer's email). */
  saveForBuyer?: boolean;
}): Promise<{ id: string; number: string; payUrl: string; amountUsdc: bigint; dueDate: string; sentTo: string; cc?: string; delivery: "sent" | "recorded" | "skipped" | "failed" }> {
  const { exporterId } = await ownerDataOrThrow({ write: true });
  if (MOCK) throw new UserError("Creating invoices needs the real database (NEXT_PUBLIC_KUTIP_MOCK is on)");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) throw new UserError("Enter a due date");
  if (input.lineItems.length === 0 || input.lineItems.some((l) => l.quantity <= 0 || l.unitPriceUsdc < 0n)) throw new UserError("Every line needs a quantity and a price");
  const sendTo = recipientEmail(input.sendTo);
  const [exporter, buyers, contact] = await Promise.all([store().getExporter(exporterId), store().listBuyers(exporterId), inbox().getContactEmail(exporterId)]);
  const buyer = buyers.find((b) => b.id === input.buyerId);
  if (!buyer) throw new UserError("Choose a buyer");
  const cc = input.ccMe ? contact?.trim() || undefined : undefined;
  if (input.ccMe && !cc) throw new UserError("Add your email under Settings, Company to get a copy");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date());
  const inv = await store().createInvoice({
    exporterId,
    buyerId: buyer.id,
    number: input.number?.trim() || undefined,
    lineItems: input.lineItems,
    issuedAt: today,
    dueDate: input.dueDate,
    referencePubkey: Keypair.generate().publicKey.toBase58(),
    status: "sent",
    sendTo,
    ...(cc ? { sendCc: cc } : {}),
  });
  if (input.saveForBuyer && sendTo.toLowerCase() !== buyer.email.toLowerCase()) await store().setBuyerEmail(exporterId, buyer.id, sendTo);
  const from = exporter?.name ?? "Kutip";
  const email = {
    subject: `Invoice ${inv.number} from ${from}`,
    body: [
      `Hi ${buyer.contactName},`,
      "",
      `Please find invoice ${inv.number} for USD ${formatUsdc(inv.amountUsdc)}, due ${inv.dueDate}.`,
      "",
      `Pay online in USDC or SOL; the network fee is covered: ${inv.payUrl}`,
      "",
      "Thank you,",
      from,
    ].join("\n"),
  };
  // Reply-To = the exporter's own address (IMPROVEMENTS E2.2, Session 8c).
  const delivery = await mailer().send(sendTo, email, { replyTo: contact ?? undefined, ...(cc ? { cc } : {}) });
  await store().recordMessage({ invoiceId: inv.id, direction: "out", from, subject: email.subject, body: email.body, toAddress: sendTo, delivery });
  return { id: inv.id, number: inv.number, payUrl: inv.payUrl, amountUsdc: inv.amountUsdc, dueDate: inv.dueDate, sentTo: sendTo, ...(cc ? { cc } : {}), delivery };
}

/** Demo scene (SPEC F8): a buyer reply goes through Jev (Haiku fallback) → rules engine → agent log. */
async function simulateBuyerReplyImpl(invoiceId: string, body: string) {
  const { exporterId } = await ownerDataOrThrow({ write: true });
  if (MOCK) throw new UserError("Buyer replies need the real database (NEXT_PUBLIC_KUTIP_MOCK is on)");
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_DEMO_CONTROLS !== "1") throw new UserError("Simulated replies are turned off");
  if (!body.trim()) throw new UserError("Write the buyer's reply first");
  llmBudget.spend(exporterId);
  const client = anthropic();
  const haiku = haikuClassifier(client);
  const key = process.env.OPENROUTER_API_KEY;
  const out = await handleBuyerReply({
    store: store(),
    classifier: key ? jevClassifier({ apiKey: key, fallback: haiku }) : haiku,
    explain: (ctx, req) => explainAction(client, ctx, req),
    exporterId,
    invoiceId,
    subject: "Re: your invoice",
    body: body.slice(0, 4000),
    now: new Date(),
  });
  refresh();
  return { intent: out.classification.label, confidence: out.classification.confidence, action: out.action };
}

// User-facing errors travel as data (see ./result): production hides thrown messages.
export async function establishSession(accessToken: string) {
  return toResult(() => establishSessionImpl(accessToken));
}
export async function readInvoicePdf(form: FormData) {
  return toResult(() => readInvoicePdfImpl(form));
}
export async function createInvoice(input: Parameters<typeof createInvoiceImpl>[0]) {
  return toResult(() => createInvoiceImpl(input), { duplicate: `Invoice number ${input.number} is already used. Change it, or clear it to use the next number.` });
}
export async function simulateBuyerReply(invoiceId: string, body: string) {
  return toResult(() => simulateBuyerReplyImpl(invoiceId, body));
}
