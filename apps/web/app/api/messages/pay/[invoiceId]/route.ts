/**
 * Buyer message box on the pay page (IMPROVEMENTS E2.1). Public: the unguessable invoice id in the pay link
 * is the credential, exactly like /pay/[id]. GET returns only this invoice's pay-page conversation
 * (sent messages, no drafts, no emails, nothing about other invoices). POST stores the buyer's question,
 * then — after the response — the agent classifies it and drafts or sends a reply per the E3 permission.
 */
import { handleInbound } from "@kutip/agent";
import { PAY_MESSAGE_MAX_CHARS } from "@kutip/db";
import { after, type NextRequest } from "next/server";
import { MOCK } from "@/lib/server/auth";
import { inbox, inboxDeps } from "../../../agent/_lib/deps";

type Ctx = { params: Promise<{ invoiceId: string }> };

const NO_STORE = { "cache-control": "no-store" };
const json = (status: number, body: unknown) => Response.json(body, { status, headers: NO_STORE });

/** Best-effort per-IP limit on top of the per-invoice limit in the database (serverless: per instance). */
const hits = new Map<string, number[]>();
function tooMany(ip: string, now: number): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5_000) hits.clear();
  return recent.length > 10;
}

const ERRORS = {
  not_found: [404, "This invoice link isn't valid."],
  empty: [400, "Write a message first."],
  too_long: [400, `Keep it under ${PAY_MESSAGE_MAX_CHARS} characters.`],
  rate_limited: [429, "You've sent several messages already. The seller will reply here; please try again later."],
} as const;

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { invoiceId } = await params;
  if (MOCK) return json(200, { messages: [] });
  const thread = await inbox().getPayThread(invoiceId);
  if (!thread) return json(404, { message: ERRORS.not_found[1] });
  return json(200, { messages: thread });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { invoiceId } = await params;
  if (MOCK) return json(503, { message: "Messages need the real database." });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (tooMany(ip, Date.now())) return json(429, { message: ERRORS.rate_limited[1] });

  let body: unknown;
  try {
    body = ((await req.json()) as { body?: unknown }).body;
  } catch {
    return json(400, { message: "Send JSON: {\"body\": \"your message\"}" });
  }
  if (typeof body !== "string") return json(400, { message: ERRORS.empty[1] });

  const r = await inbox().postPayMessage(invoiceId, body);
  if (!r.ok) {
    const [status, message] = ERRORS[r.error];
    return json(status, { message });
  }
  after(async () => {
    try {
      await handleInbound(inboxDeps(), { exporterId: r.exporterId, invoiceId: r.invoiceId, messageId: r.messageId });
    } catch (e) {
      console.error(`[messages] agent could not handle ${r.messageId}: ${(e as Error).message}`);
    }
  });
  return json(201, { ok: true });
}
