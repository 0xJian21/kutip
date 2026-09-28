"use server";

/**
 * Agent command bar (IMPROVEMENTS A1). runCommand only ever returns a preview; the one write here is
 * sendCommandReminder, which runs when the owner presses Send on a reminder preview. Money moves only
 * through the treasury flows, which ask for the passkey.
 */
import { confirmReminder, InputError, planCommand, routeCommand } from "@kutip/agent";
import { anthropic, commandPort, jevConfig, mailer, reminderPort } from "@/app/api/agent/_lib/deps";
import { MOCK, sessionOrThrow } from "@/lib/server/auth";
import { toResult, UserError } from "@/lib/data/result";

/** Messages written for the owner (InputError from @kutip/agent, UserError here) reach the browser; the rest is masked. */
function run<T>(fn: () => Promise<T>) {
  return toResult(() => fn().catch((e: unknown) => {
    throw e instanceof InputError ? new UserError(e.message) : e;
  }));
}

async function owner() {
  const s = await sessionOrThrow();
  if (MOCK) throw new UserError("The agent needs the real database (NEXT_PUBLIC_KUTIP_MOCK is on)");
  return s;
}

export async function runCommand(text: string) {
  return run(async () => {
    const { exporterId } = await owner();
    const trimmed = text.trim();
    if (!trimmed) throw new UserError("Ask the agent something first");
    const client = anthropic();
    const intent = await routeCommand({ client, jev: jevConfig() }, trimmed);
    const preview = await planCommand({ store: commandPort(), client, now: () => new Date() }, exporterId, intent);
    return { ...preview, via: intent.via };
  });
}

export async function sendCommandReminder(input: { invoiceId: string; subject: string; body: string }) {
  return run(async () => {
    const s = await owner();
    const r = await confirmReminder({ store: await reminderPort(s.exporterId), mailer: mailer(), now: () => new Date() }, s.exporterId, { ...input, approvedBy: s.privyUserId });
    return { delivery: r.delivery };
  });
}
