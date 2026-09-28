"use server";

/**
 * Agent command bar (IMPROVEMENTS A1). runCommand only ever returns a preview; the one write here is
 * sendCommandReminder, which runs when the owner presses Send on a reminder preview. Money moves only
 * through the treasury flows, which ask for the passkey.
 */
import { confirmReminder, planCommand, routeCommand } from "@kutip/agent";
import { anthropic, commandPort, jevConfig, mailer, reminderPort } from "@/app/api/agent/_lib/deps";
import { MOCK, sessionOrThrow } from "@/lib/server/auth";
import { toResult } from "@/lib/data/result";

async function owner() {
  const s = await sessionOrThrow();
  if (MOCK) throw new Error("The agent needs the real database (NEXT_PUBLIC_KUTIP_MOCK is on)");
  return s;
}

export async function runCommand(text: string) {
  return toResult(async () => {
    const { exporterId } = await owner();
    const trimmed = text.trim();
    if (!trimmed) throw new Error("Ask the agent something first");
    const client = anthropic();
    const intent = await routeCommand({ client, jev: jevConfig() }, trimmed);
    const preview = await planCommand({ store: commandPort(), client, now: () => new Date() }, exporterId, intent);
    return { ...preview, via: intent.via };
  });
}

export async function sendCommandReminder(input: { invoiceId: string; subject: string; body: string }) {
  return toResult(async () => {
    const s = await owner();
    const r = await confirmReminder({ store: await reminderPort(s.exporterId), mailer: mailer(), now: () => new Date() }, s.exporterId, { ...input, approvedBy: s.privyUserId });
    return { delivery: r.delivery };
  });
}
