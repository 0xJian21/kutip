/**
 * Every outgoing buyer email as a formal business letter: the exporter's letterhead, a subject line,
 * greeting, the message, an invoice summary, one "View & pay invoice" button with a plain URL,
 * how to pay, sign-off and footer. HTML (tables, inline CSS, 600px, dark-mode overrides) plus a
 * plain-text alternative. Pure. Every number and date is formatted here from the invoice; the
 * writer (Haiku) only supplies `paragraphs`, which are escaped.
 */
import { formatUsdc } from "./money";

export type LetterKind = "invoice" | "reminder_friendly" | "reminder_firm" | "reminder_final" | "receipt" | "reply";

export type LetterInput = {
  kind: LetterKind;
  letterhead: { name: string; registrationNo?: string; address?: string; logoUrl?: string; contactEmail?: string };
  recipientName: string;
  sender: { name: string; title: string };
  /** `issuedAt` is optional: the agent's invoice records don't carry it, and the row is left out. */
  invoice: { number: string; issuedAt?: string; dueDate: string; amountUsdc: bigint; payUrl: string; status?: string };
  /** BNM USD/MYR (4 implied decimals) for the ringgit line; omitted when unknown. */
  rate?: { myrPerUsd: bigint; date: string };
  /** Receipts: what arrived and when. */
  paid?: { amountUsdc: bigint; at: string };
  /** The message itself, one string per paragraph. Empty = the default wording for the kind. */
  paragraphs: string[];
  /** For "N days overdue" (ISO time); defaults to the current time. */
  now?: string;
};

const DOC_LABEL: Record<LetterKind, string> = {
  invoice: "Invoice",
  reminder_friendly: "Payment reminder",
  reminder_firm: "Overdue invoice",
  reminder_final: "Final reminder",
  receipt: "Payment receipt",
  reply: "Invoice",
};

// ---- formatting (code, never the model) ----

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const usd = (units: bigint) => formatUsdc(units); // "USD 1,250.00"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "4 Oct 2026" / "4 October 2026". A fixed table, not Intl: servers with different ICU data print "Sep" or "Sept". */
function day(iso: string, month: "short" | "long" = "short"): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number) as [number, number, number];
  const name = MONTHS[m - 1]!;
  return `${d} ${month === "long" ? name : name.slice(0, 3)} ${y}`;
}

/** USDC base units × BNM rate (4 implied decimals) → "RM 5,268.75", rounded half-up to the sen. */
function ringgit(units: bigint, myrPerUsd: bigint): string {
  const sen = (units * myrPerUsd + 50_000_000n) / 100_000_000n;
  const whole = (sen / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `RM ${whole}.${(sen % 100n).toString().padStart(2, "0")}`;
}

function daysPastDue(dueDate: string, now: string): number {
  const due = Date.UTC(...(dueDate.split("-").map(Number) as [number, number, number]).map((v, i) => (i === 1 ? v - 1 : v)) as [number, number, number]);
  const today = Date.UTC(...(now.slice(0, 10).split("-").map(Number) as [number, number, number]).map((v, i) => (i === 1 ? v - 1 : v)) as [number, number, number]);
  return Math.round((today - due) / 86_400_000);
}

function initials(name: string): string {
  const core = name.replace(/\b(sdn\.?\s*bhd\.?|pty\.?\s*ltd\.?|llc|ltd\.?|inc\.?|co\.?,?\s*ltd\.?|co\.|company|group)\b/gi, "").trim();
  const words = core.split(/\s+/).filter((w) => /[a-z]/i.test(w));
  return (words.slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || name.slice(0, 2).toUpperCase()).slice(0, 2);
}

export function letterSubject(p: LetterInput): string {
  const { number, amountUsdc, dueDate } = p.invoice;
  const who = `invoice ${number} from ${p.letterhead.name}`;
  switch (p.kind) {
    case "invoice":
      return `Invoice ${number} from ${p.letterhead.name} — ${usd(amountUsdc)} due ${day(dueDate)}`;
    case "reminder_friendly":
      return `Reminder: ${who} — ${usd(amountUsdc)} due ${day(dueDate)}`;
    case "reminder_firm":
      return `Overdue: ${who} — ${usd(amountUsdc)} was due ${day(dueDate)}`;
    case "reminder_final":
      return `Final reminder: ${who} — ${usd(amountUsdc)} was due ${day(dueDate)}`;
    case "receipt":
      return `Payment received: ${who} — ${usd(p.paid?.amountUsdc ?? amountUsdc)}`;
    case "reply":
      return `Re: ${who}`;
  }
}

function statusLine(p: LetterInput): string {
  if (p.kind === "receipt" && p.paid) {
    const left = p.invoice.amountUsdc - p.paid.amountUsdc;
    return left > 0n ? `Part paid, ${usd(left)} still due` : "Paid in full";
  }
  if (p.invoice.status === "paid" || p.invoice.status === "settled") return "Paid";
  const late = daysPastDue(p.invoice.dueDate, p.now ?? new Date().toISOString());
  if (late > 0) return `${late} day${late === 1 ? "" : "s"} overdue`;
  if (late === 0) return "Due today";
  return `Due in ${-late} day${late === -1 ? "" : "s"}`;
}

function defaultParagraphs(p: LetterInput): string[] {
  const { number, amountUsdc, dueDate } = p.invoice;
  switch (p.kind) {
    case "invoice":
      return [`Please find below our invoice ${number} for ${usd(amountUsdc)}, due on ${day(dueDate, "long")}.`, "Thank you for your business."];
    case "reminder_friendly":
      return [`This is a courteous reminder that invoice ${number} for ${usd(amountUsdc)} is due on ${day(dueDate, "long")}.`];
    case "reminder_firm":
      return [`Our records show that invoice ${number} for ${usd(amountUsdc)}, due on ${day(dueDate, "long")}, is still unpaid. Please let us know when we can expect payment.`];
    case "reminder_final":
      return [`Invoice ${number} for ${usd(amountUsdc)}, due on ${day(dueDate, "long")}, remains unpaid. This is our last automatic reminder; our team will contact you personally next.`];
    case "receipt":
      return ["Thank you. We have received your payment; the details are below."];
    case "reply":
      return [];
  }
}

// ---- palette: the violet system as email-safe hex (no pure black or white) ----
const C = { canvas: "#f3f2f6", card: "#fdfcfe", well: "#f7f6fa", ink: "#1d1a27", ink2: "#5b5668", ink3: "#736e80", line: "#e3e1e9", accent: "#6d43f2", onAccent: "#fbfaff", tint: "#ece6fe", tintInk: "#4b2fb0" };
const FONT = "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

const DARK_CSS = `
:root { color-scheme: light dark; supported-color-schemes: light dark; }
@media (prefers-color-scheme: dark) {
  .k-bg { background: #15131b !important; }
  .k-card { background: #1f1c27 !important; border-color: #34303f !important; }
  .k-well { background: #1a1822 !important; }
  .k-ink { color: #efedf3 !important; }
  .k-ink2 { color: #bdb8c8 !important; }
  .k-ink3 { color: #a39fae !important; }
  .k-line { border-color: #34303f !important; }
  .k-btn { background: #b49cff !important; }
  .k-btn a { color: #1d1a27 !important; }
  .k-link { color: #c5b4ff !important; }
  .k-mark { background: #2e2745 !important; color: #d6cbff !important; }
}
[data-ogsc] .k-ink { color: #efedf3 !important; }
[data-ogsc] .k-ink2 { color: #bdb8c8 !important; }
@media only screen and (max-width: 620px) {
  .k-pad { padding-left: 20px !important; padding-right: 20px !important; }
  .k-hide-sm { display: none !important; }
  .k-show-sm { display: table-row !important; }
}`;

/** "… on behalf of X." without doubling the full stop of "Sdn. Bhd.". */
const endSentence = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);

export function renderLetter(p: LetterInput): { subject: string; html: string; text: string } {
  const subject = letterSubject(p);
  const lh = p.letterhead;
  const inv = p.invoice;
  const paragraphs = (p.paragraphs.length ? p.paragraphs : defaultParagraphs(p)).map((x) => x.trim()).filter(Boolean);
  const status = statusLine(p);
  const paidInFull = p.kind === "receipt" && p.paid !== undefined && p.paid.amountUsdc >= inv.amountUsdc;
  const payable = !paidInFull && inv.status !== "paid" && inv.status !== "settled";
  const myr = p.rate ? ringgit(inv.amountUsdc, p.rate.myrPerUsd) : null;
  const rateNote = p.rate ? `about ${myr} at the Bank Negara rate of ${day(p.rate.date)}` : null;
  const signTitle = `${p.sender.title}, ${lh.name}`;
  const howToPay = "Open the invoice and press Pay. You can pay in USDC or SOL from any wallet app; the network fee is covered, so the amount you see is the amount that arrives.";
  const preheader = p.kind === "receipt" ? `${status}. Thank you for your payment.` : `${usd(inv.amountUsdc)} ${status === "Due today" ? "due today" : `due ${day(inv.dueDate)}`}. View and pay online.`;

  const rows: Array<[string, string, string?]> = [
    ["Invoice number", inv.number],
    ...(inv.issuedAt ? ([["Issue date", day(inv.issuedAt)]] as Array<[string, string]>) : []),
    ["Due date", day(inv.dueDate)],
    ["Amount", usd(inv.amountUsdc), rateNote ?? undefined],
    ...(p.paid ? ([["Payment received", `${usd(p.paid.amountUsdc)} on ${day(p.paid.at)}`]] as Array<[string, string]>) : []),
    ["Status", status],
  ];

  // ---- plain text ----
  const text = [
    lh.name,
    ...[lh.registrationNo ? `SSM ${lh.registrationNo}` : "", lh.address ?? ""].filter(Boolean),
    "",
    `Dear ${p.recipientName},`,
    "",
    ...paragraphs.flatMap((x) => [x, ""]),
    ...rows.map(([k, v, note]) => `${k === "Invoice number" ? "Invoice" : k}: ${v}${note ? ` (${note})` : ""}`),
    "",
    ...(payable ? [`View and pay the invoice: ${inv.payUrl}`, "", `How to pay: ${howToPay}`, ""] : []),
    "Kind regards,",
    "",
    p.sender.name,
    signTitle,
    ...(lh.contactEmail ? [lh.contactEmail] : []),
    "",
    "--",
    `Sent via Kutip on behalf of ${endSentence(lh.name)}${lh.contactEmail ? ` Reply to this email to reach ${lh.contactEmail}.` : ""}`,
  ].join("\n");

  // ---- HTML ----
  const t = (size: number, color: string, cls: string, extra = "") => `style="margin:0;font-family:${FONT};font-size:${size}px;line-height:1.55;color:${color};${extra}" class="${cls}"`;
  const mark = lh.logoUrl
    ? `<img src="${esc(lh.logoUrl)}" width="48" height="48" alt="${esc(lh.name)}" style="display:block;width:48px;height:48px;border-radius:8px;object-fit:contain;border:0;" />`
    : `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="48" height="48" align="center" valign="middle" class="k-mark" style="width:48px;height:48px;border-radius:8px;background:${C.tint};color:${C.tintInk};font-family:${FONT};font-size:17px;font-weight:700;">${esc(initials(lh.name))}</td></tr></table>`;

  const summary = rows
    .map(
      ([k, v, note], i) => `<tr>
  <td class="k-line k-ink2" style="padding:10px 0;${i ? `border-top:1px solid ${C.line};` : ""}font-family:${FONT};font-size:14px;color:${C.ink2};width:40%;vertical-align:top;">${esc(k)}</td>
  <td class="k-line" align="right" style="padding:10px 0;${i ? `border-top:1px solid ${C.line};` : ""}font-family:${FONT};font-size:14px;text-align:right;vertical-align:top;">
    <span class="k-ink" style="color:${C.ink};font-weight:${k === "Amount" || k === "Status" ? 700 : 500};">${esc(v)}</span>${note ? `<br /><span class="k-ink3" style="color:${C.ink3};font-size:12px;font-weight:400;">${esc(note)}</span>` : ""}
  </td>
</tr>`,
    )
    .join("\n");

  const button = payable
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 12px;"><tr>
  <td class="k-btn" bgcolor="${C.accent}" style="border-radius:999px;background:${C.accent};">
    <a href="${esc(inv.payUrl)}" target="_blank" style="display:inline-block;padding:13px 28px;font-family:${FONT};font-size:15px;font-weight:600;color:${C.onAccent};text-decoration:none;border-radius:999px;">View &amp; pay invoice</a>
  </td></tr></table>
<p ${t(13, C.ink3, "k-ink3")}>Or open this link: <a href="${esc(inv.payUrl)}" class="k-link" style="color:${C.accent};word-break:break-all;">${esc(inv.payUrl)}</a></p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;"><tr><td class="k-well" style="background:${C.well};border-radius:10px;padding:14px 16px;">
  <p ${t(13, C.ink, "k-ink", "font-weight:600;")}>How to pay</p>
  <p ${t(13, C.ink2, "k-ink2", "margin-top:4px;")}>${esc(howToPay)}</p>
</td></tr></table>`
    : "";

  const html = `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>${esc(subject)}</title>
<style>${DARK_CSS}</style>
</head>
<body class="k-bg" style="margin:0;padding:0;background:${C.canvas};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="k-bg" style="background:${C.canvas};">
<tr><td align="center" style="padding:32px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="k-card" style="width:100%;max-width:600px;background:${C.card};border:1px solid ${C.line};border-radius:14px;">
    <tr><td class="k-pad" style="padding:28px 36px 22px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="60" valign="top" style="width:60px;">${mark}</td>
        <td valign="top">
          <p ${t(17, C.ink, "k-ink", "font-weight:700;line-height:1.3;")}>${esc(lh.name)}</p>
          ${lh.registrationNo ? `<p ${t(12, C.ink3, "k-ink3", "margin-top:2px;")}>SSM ${esc(lh.registrationNo)}</p>` : ""}
          ${lh.address ? `<p ${t(12, C.ink3, "k-ink3")}>${esc(lh.address)}</p>` : ""}
        </td>
        <td valign="top" align="right" class="k-hide-sm" style="text-align:right;white-space:nowrap;padding-left:16px;">
          <p ${t(12, C.ink3, "k-ink3")}>${esc(DOC_LABEL[p.kind])}</p>
          <p ${t(15, C.ink, "k-ink", "font-weight:700;")}>${esc(inv.number)}</p>
        </td>
      </tr></table>
    </td></tr>
    <tr class="k-show-sm" style="display:none;mso-hide:all;"><td class="k-pad" style="padding:0 36px 16px;">
      <p ${t(13, C.ink2, "k-ink2")}>${esc(DOC_LABEL[p.kind])} <span class="k-ink" style="color:${C.ink};font-weight:700;">${esc(inv.number)}</span></p>
    </td></tr>
    <tr><td class="k-pad" style="padding:0 36px;"><div class="k-line" style="border-top:1px solid ${C.line};height:1px;line-height:1px;font-size:1px;">&nbsp;</div></td></tr>
    <tr><td class="k-pad" style="padding:26px 36px 8px;">
      <p ${t(15, C.ink, "k-ink")}>Dear ${esc(p.recipientName)},</p>
      ${paragraphs.map((x) => `<p ${t(15, C.ink, "k-ink", "margin-top:14px;")}>${esc(x)}</p>`).join("\n      ")}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
${summary}
      </table>
      ${button}
      <p ${t(15, C.ink, "k-ink", "margin-top:28px;")}>Kind regards,</p>
      <p ${t(15, C.ink, "k-ink", "margin-top:12px;font-weight:600;")}>${esc(p.sender.name)}</p>
      <p ${t(13, C.ink2, "k-ink2")}>${esc(signTitle)}</p>
      ${lh.contactEmail ? `<p ${t(13, C.ink2, "k-ink2")}><a href="mailto:${esc(lh.contactEmail)}" class="k-link" style="color:${C.accent};text-decoration:none;">${esc(lh.contactEmail)}</a></p>` : ""}
    </td></tr>
    <tr><td style="padding:0 0 26px;">&nbsp;</td></tr>
  </table>
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
    <tr><td class="k-pad" style="padding:18px 36px 0;">
      <p ${t(12, C.ink3, "k-ink3")}>Sent via Kutip on behalf of ${esc(endSentence(lh.name))}${lh.contactEmail ? ` Reply to this email to reach ${esc(lh.contactEmail)}.` : ""}</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;

  return { subject, html, text };
}

/** What a sender knows about the exporter (store.getLetterhead). */
export type Letterhead = LetterInput["letterhead"] & { ownerName?: string; rate?: { myrPerUsd: bigint; date: string } };

const GREETING = /^(dear|hi|hello|good (morning|afternoon|day))\b[^\n]*,?\s*$/i;
const SIGN_OFF = /^(kind|best|warm)?\s*(regards|wishes)\b|^(thank you|thanks|sincerely|yours (sincerely|faithfully|truly)|cheers)\s*,\s*$/i;

/** The writer's text as paragraphs, without a greeting or sign-off (the letter adds its own). */
export function letterParagraphs(body: string): string[] {
  const blocks = body.replace(/\r\n/g, "\n").split(/\n\s*\n/).map((b) => b.split("\n").map((l) => l.trim()).filter(Boolean));
  const out: string[] = [];
  for (const [i, lines] of blocks.entries()) {
    if (lines.length === 0) continue;
    if (i === 0 && lines.length === 1 && GREETING.test(lines[0]!)) continue;
    const signAt = lines.findIndex((l) => SIGN_OFF.test(l));
    if (signAt === 0) break; // "Kind regards," and the signature after it
    const kept = signAt > 0 ? lines.slice(0, signAt) : lines;
    out.push(kept.join(" "));
    if (signAt > 0) break;
  }
  return out;
}

/**
 * One buyer email as a formal letter. `body` is the writer's text (Haiku or the owner's edit);
 * `record` is that text without greeting or sign-off, for the message history.
 */
export function letterEmail(
  kind: LetterKind,
  p: { head: Letterhead; contactName: string; invoice: LetterInput["invoice"]; body?: string; paid?: LetterInput["paid"]; now?: string },
): { subject: string; body: string; html: string; record: string } {
  const paragraphs = p.body ? letterParagraphs(p.body) : [];
  const { ownerName, rate, ...letterhead } = p.head;
  const input: LetterInput = {
    kind,
    letterhead,
    recipientName: p.contactName,
    sender: ownerName?.trim() ? { name: ownerName.trim(), title: "Owner" } : { name: "Accounts team", title: "Accounts" },
    invoice: p.invoice,
    ...(rate ? { rate } : {}),
    ...(p.paid ? { paid: p.paid } : {}),
    paragraphs,
    ...(p.now ? { now: p.now } : {}),
  };
  const r = renderLetter(input);
  return { subject: r.subject, body: r.text, html: r.html, record: (paragraphs.length ? paragraphs : defaultParagraphs(input)).join("\n\n") };
}
