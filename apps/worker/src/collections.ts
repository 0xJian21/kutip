/**
 * Collections (SPEC F8) on a timer: overdue marking, reminders per the rulebook (nextReminder decides,
 * Haiku writes), and what happens once an invoice is paid (C6: reminders cancelled, receipt sent).
 * Every LLM call gets one buyer's context (SPEC §5 L4).
 */
import type Anthropic from "@anthropic-ai/sdk";
import { buildBuyerContext, nextReminder, writeReceipt, writeReminder, type Email } from "@kutip/agent";
import type { BuyerContext, Store } from "@kutip/db";
import type { Mailer } from "./email";
import type { PaidInvoice } from "./payments";

/** Today's date (YYYY-MM-DD) on the buyer's wall clock. */
function localDate(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function createCollections(deps: {
  store: Store;
  anthropic?: Anthropic;
  mailer: Mailer;
  log: (msg: string) => void;
  /** Log what would happen; write nothing, call no LLM (safe against a shared demo database). */
  dryRun?: boolean;
}) {
  const { store, anthropic, mailer, log, dryRun } = deps;
  let warnedNoKey = false;

  async function sendAndRecord(ctx: BuyerContext, invoiceId: string, email: Email, at: Date): Promise<string> {
    await store.recordMessage({ invoiceId, direction: "out", from: ctx.exporterName, subject: email.subject, body: email.body, at });
    return mailer.send(ctx.buyer.email, email);
  }

  return {
    async markOverdue(now: Date): Promise<void> {
      for (const exporterId of await store.listExporterIds()) {
        for (const inv of await store.listOpenInvoices(exporterId)) {
          if (inv.status !== "sent" || localDate(now, inv.timezone) <= inv.dueDate) continue;
          if (dryRun) {
            log(`[dry] Overdue ${inv.invoiceId} (due ${inv.dueDate})`);
            continue;
          }
          await store.setInvoiceStatus(exporterId, inv.invoiceId, "overdue", now);
          log(`Overdue ${inv.invoiceId} (due ${inv.dueDate})`);
        }
      }
    },

    async runReminders(now: Date): Promise<void> {
      if (!anthropic && !dryRun) {
        if (!warnedNoKey) log("reminders skipped: ANTHROPIC_API_KEY is not set");
        warnedNoKey = true;
        return;
      }
      for (const exporterId of await store.listExporterIds()) {
        const rulebook = await store.getRulebook(exporterId);
        const open = await store.listOpenInvoices(exporterId);
        for (const buyerId of new Set(open.map((i) => i.buyerId))) {
          const ctx = await store.getBuyerContext(exporterId, buyerId);
          if (!ctx) continue;
          const sent = ctx.messages.filter((m) => m.direction === "out").map((m) => ({ invoiceId: m.invoiceId, at: m.createdAt }));
          for (const inv of open.filter((i) => i.buyerId === buyerId)) {
            const number = ctx.invoices.find((i) => i.id === inv.invoiceId)?.number ?? inv.invoiceId;
            const plan = nextReminder({ ...inv, sent, now, rulebook });
            if (plan.escalate) {
              if (ctx.actions.some((x) => x.invoiceId === inv.invoiceId && x.kind === "escalate")) continue;
              if (dryRun) {
                log(`[dry] Escalate ${inv.invoiceId} (${plan.ruleId}: ${plan.reason})`);
                continue;
              }
              await store.recordAgentAction({
                exporterId, buyerId, invoiceId: inv.invoiceId, kind: "escalate", status: "escalated", confidence: 1, ruleId: plan.ruleId, at: now,
                inputSummary: `${number} is ${inv.status}, due ${inv.dueDate}`,
                decision: `Stopped reminders for ${number} and handed it to you`,
                reason: plan.reason,
              });
              log(`Escalated ${inv.invoiceId} (${plan.ruleId}: ${plan.reason})`);
              continue;
            }
            if (!plan.allowed || !plan.sendAt || plan.sendAt > now || !plan.tone) continue;
            if (dryRun || !anthropic) {
              log(`[dry] Reminder ${inv.invoiceId} ${plan.tone} (${plan.ruleId})`);
              sent.push({ invoiceId: inv.invoiceId, at: now.toISOString() });
              continue;
            }
            let email: Email;
            try {
              email = await writeReminder(anthropic, buildBuyerContext(ctx), { invoiceId: inv.invoiceId, tone: plan.tone, now });
            } catch (e) {
              log(`reminder failed for ${inv.invoiceId}: ${(e as Error).message}`);
              continue;
            }
            const delivery = await sendAndRecord(ctx, inv.invoiceId, email, now);
            sent.push({ invoiceId: inv.invoiceId, at: now.toISOString() });
            await store.recordAgentAction({
              exporterId, buyerId, invoiceId: inv.invoiceId, kind: "reminder", status: "executed", confidence: 1, ruleId: plan.ruleId, at: now,
              inputSummary: `${number} is ${inv.status}, due ${inv.dueDate}`,
              decision: `Sent a ${plan.tone} reminder for ${number}`,
              reason: plan.reason,
            });
            log(`Reminder ${inv.invoiceId} ${plan.tone} (${plan.ruleId}), email ${delivery}`);
          }
        }
      }
    },

    /** Invoice just became paid: cancel its reminders (C6) and send the buyer a receipt. */
    async onPaid(paid: PaidInvoice): Promise<void> {
      const now = new Date();
      const ctx = await store.getBuyerContext(paid.exporterId, paid.buyerId);
      const inv = ctx?.invoices.find((i) => i.id === paid.invoiceId);
      if (!ctx || !inv) return;
      await store.recordAgentAction({
        exporterId: paid.exporterId, buyerId: paid.buyerId, invoiceId: paid.invoiceId, kind: "cancel_reminders", status: "executed", confidence: 1, ruleId: "C6", at: now,
        inputSummary: `${inv.number} is ${inv.status}`,
        decision: `Cancelled the reminder schedule for ${inv.number}`,
        reason: "Payment received, so reminders are cancelled",
      });
      if (!anthropic) return;
      try {
        const email = await writeReceipt(anthropic, buildBuyerContext(ctx), { invoiceId: inv.id, paidUsdc: inv.receivedUsdc, paidAt: inv.paidAt ? new Date(inv.paidAt) : now });
        log(`Receipt ${inv.id}, email ${await sendAndRecord(ctx, inv.id, email, now)}`);
      } catch (e) {
        log(`receipt failed for ${inv.id}: ${(e as Error).message}`);
      }
    },
  };
}

export type Collections = ReturnType<typeof createCollections>;
