import { describe, expect, it } from "vitest";
import { COMMAND_TOOLS, confirmReminder, planCommand, routeCommand, type CommandIntent, type CommandPort } from "./command";
import type { Mailer } from "./mailer";
import { DEFAULT_RULEBOOK } from "./rulebook";
import { fakeAnthropic, promptText } from "./testing/fake-anthropic";
import { EXPORTER_NAME, HARBOURLINE, HARBOURLINE_INVOICES, HARBOURLINE_MESSAGES, MERIDIAN, MERIDIAN_INVOICES, MERIDIAN_MESSAGES, MERIDIAN_SECRETS } from "./testing/buyers";

const E = "exp_teratai";
const NOW = new Date("2026-09-28T02:00:00Z"); // Mon 28 Sep, 10:00 MYT
const RATE = { myrPerUsd: 42150n, date: "2026-09-26" };

const invoices = [
  { ...HARBOURLINE_INVOICES[0]!, receivedUsdc: 0n }, // INV-2026-0142 overdue 12,480
  { ...MERIDIAN_INVOICES[0]!, receivedUsdc: 0n }, // INV-2026-0140 overdue 27,315
  { ...HARBOURLINE_INVOICES[0]!, id: "inv_0150", number: "INV-2026-0150", amountUsdc: 5_000_000_000n, receivedUsdc: 1_000_000_000n, dueDate: "2026-10-02", status: "partially_paid" as const },
  { ...MERIDIAN_INVOICES[0]!, id: "inv_0151", number: "INV-2026-0151", amountUsdc: 1_000_000_000n, dueDate: "2026-09-10", status: "settled" as const, receivedUsdc: 1_000_000_000n },
];
const buyers = [HARBOURLINE, MERIDIAN];

/** Read-only port. The Proxy records every method name so tests can prove nothing writes. */
function fakePort(over: Partial<CommandPort> = {}) {
  const calls: string[] = [];
  const port: CommandPort = {
    async listInvoices() { return invoices; },
    async listBuyers() { return buyers; },
    async getTreasury() {
      return {
        rate: RATE,
        mainBalanceUsdc: 20_000_000_000n,
        buyerAccounts: [
          { buyer: HARBOURLINE, balanceUsdc: 1_500_000_000n },
          { buyer: MERIDIAN, balanceUsdc: 0n },
        ],
        cashOut: { whitelisted: [{ label: "HATA MYR", address: "HataDep0sit1111111111111111111111111111111" }] },
      };
    },
    async getRulebook() { return DEFAULT_RULEBOOK; },
    async getBuyerContext(_e, buyerId) {
      if (buyerId === HARBOURLINE.id) return { exporterName: EXPORTER_NAME, buyer: HARBOURLINE, invoices: HARBOURLINE_INVOICES, messages: HARBOURLINE_MESSAGES };
      if (buyerId === MERIDIAN.id) return { exporterName: EXPORTER_NAME, buyer: MERIDIAN, invoices: MERIDIAN_INVOICES, messages: MERIDIAN_MESSAGES };
      return null;
    },
    async agenda() { return [{ date: "2026-10-02", kind: "due" as const, label: "INV-2026-0150 due", invoiceNumber: "INV-2026-0150", amountUsdc: 4_000_000_000n }]; },
    ...over,
  };
  const proxied = new Proxy(port, { get: (t, k) => (calls.push(String(k)), t[k as keyof CommandPort]) });
  return { port: proxied, calls };
}

const toolUse = (name: string, input: unknown) => () => ({ raw: { content: [{ type: "tool_use", id: "tu_1", name, input }], stop_reason: "tool_use" } });
const reminderDraft = () => ({ output: { subject: "INV-2026-0142 is overdue", body: "Hi Claire, INV-2026-0142 for USD 12,480.00 is overdue." } });

describe("routeCommand", () => {
  it("sends only the owner's words and the tool list; picks one tool", async () => {
    const { client, requests } = fakeAnthropic(toolUse("draft_reminder", { buyer: "Najd", invoice: "INV-0141" }));
    const intent = await routeCommand({ client }, "Remind Najd about INV-0141");
    expect(intent).toEqual({ tool: "draft_reminder", buyer: "Najd", invoice: "INV-0141", via: "haiku" });
    const body = requests[0];
    expect(body.tools.map((t: { name: string }) => t.name).sort()).toEqual(COMMAND_TOOLS.map((t) => t.name).sort());
    expect(promptText(body)).toContain("Remind Najd about INV-0141");
    // L4: the router never sees buyer data; names are resolved in code afterwards.
    for (const secret of [...MERIDIAN_SECRETS, HARBOURLINE.name, HARBOURLINE.email]) expect(JSON.stringify(body)).not.toContain(secret);
  });

  it("no tool, or a tool with bad input → help, never a guess", async () => {
    const { client } = fakeAnthropic(() => ({ output: "I'm not sure" }));
    expect(await routeCommand({ client }, "sing me a song")).toMatchObject({ tool: "none" });
    const { client: c2 } = fakeAnthropic(toolUse("list_invoices", { view: "everything-ever" }));
    expect(await routeCommand({ client: c2 }, "show me")).toMatchObject({ tool: "none" });
    const { client: c3 } = fakeAnthropic(toolUse("rm_rf", {}));
    expect(await routeCommand({ client: c3 }, "delete")).toMatchObject({ tool: "none" });
  });

  it("Jev routes argument-free intents without calling Haiku", async () => {
    const { client, requests } = fakeAnthropic(toolUse("list_invoices", { view: "overdue" }));
    const jevFetch = (async () => new Response(JSON.stringify({ answers: { intent: { type: "choice", choice: "sweep_preview", confidence: 0.93 } } }))) as unknown as typeof fetch;
    expect(await routeCommand({ client, jev: { apiKey: "k", fetchFn: jevFetch } }, "Sweep now")).toEqual({ tool: "sweep_preview", via: "jev" });
    expect(requests).toHaveLength(0);

    // Anything needing arguments (or Jev unsure / down) goes to Haiku.
    const unsure = (async () => new Response(JSON.stringify({ answers: { intent: { type: "choice", choice: "list_invoices", confidence: 0.99 } } }))) as unknown as typeof fetch;
    expect(await routeCommand({ client, jev: { apiKey: "k", fetchFn: unsure } }, "Who is overdue?")).toMatchObject({ tool: "list_invoices", view: "overdue", via: "haiku" });
    const down = (async () => new Response("nope", { status: 503 })) as unknown as typeof fetch;
    expect(await routeCommand({ client, jev: { apiKey: "k", fetchFn: down } }, "Sweep now")).toMatchObject({ via: "haiku" });
  });
});

describe("planCommand: previews only, numbers from code", () => {
  const plan = (intent: CommandIntent, port = fakePort().port, client = fakeAnthropic(reminderDraft).client) => planCommand({ store: port, client, now: () => NOW }, E, intent);

  it("overdue invoices with the outstanding total", async () => {
    const p = await plan({ tool: "list_invoices", view: "overdue" });
    if (p.kind !== "invoices") throw new Error(p.kind);
    expect(p.lines.map((l) => l.number)).toEqual(["INV-2026-0142", "INV-2026-0140"]);
    expect(p.totalOutstandingUsdc).toBe(39_795_000_000n);
    expect(p.rate).toEqual(RATE);
  });

  it("'due this week' and a buyer filter", async () => {
    const p = await plan({ tool: "list_invoices", view: "due_this_week" });
    expect(p.kind === "invoices" && p.lines.map((l) => [l.number, l.outstandingUsdc])).toEqual([["INV-2026-0150", 4_000_000_000n]]);
    const h = await plan({ tool: "list_invoices", view: "unpaid", buyer: "harbour" });
    expect(h.kind === "invoices" && h.lines.map((l) => l.number)).toEqual(["INV-2026-0142", "INV-2026-0150"]);
  });

  it("invoice status by a loose number", async () => {
    expect(await plan({ tool: "invoice_status", invoice: "0140" })).toMatchObject({ kind: "invoice", line: { number: "INV-2026-0140", buyerName: MERIDIAN.name } });
    expect(await plan({ tool: "invoice_status", invoice: "INV-9999" })).toMatchObject({ kind: "clarify" });
  });

  it("a reminder is drafted with ONE buyer's context and shown for confirmation, never sent", async () => {
    const { port, calls } = fakePort();
    const { client, requests } = fakeAnthropic(reminderDraft);
    const p = await plan({ tool: "draft_reminder", buyer: "Harbourline" }, port, client);
    expect(p).toMatchObject({ kind: "reminder", to: HARBOURLINE.email, line: { number: "INV-2026-0142" }, email: { subject: "INV-2026-0142 is overdue" } });
    for (const secret of MERIDIAN_SECRETS) expect(promptText(requests[0])).not.toContain(secret);
    expect(calls.filter((c) => !["listInvoices", "listBuyers", "getRulebook", "getBuyerContext", "getTreasury", "agenda"].includes(c))).toEqual([]);
  });

  it("a draft that fails the fact check is retried once, then explained instead of thrown", async () => {
    let n = 0;
    const flaky = fakeAnthropic(() => (++n === 1 ? { output: { subject: "x", body: "Pay USD 1.00 now" } } : reminderDraft()));
    expect(await plan({ tool: "draft_reminder", invoice: "0142" }, fakePort().port, flaky.client)).toMatchObject({ kind: "reminder" });
    const bad = fakeAnthropic(() => ({ output: { subject: "x", body: "Pay USD 1.00 now" } }));
    expect(await plan({ tool: "draft_reminder", invoice: "0142" }, fakePort().port, bad.client)).toMatchObject({ kind: "clarify", message: expect.stringMatching(/didn.t pass/) });
    expect(bad.requests).toHaveLength(2);
  });

  it("ambiguous or unknown buyers ask, they don't guess", async () => {
    expect(await plan({ tool: "draft_reminder", buyer: "Acme" })).toMatchObject({ kind: "clarify" });
    const two = await plan({ tool: "draft_reminder", buyer: "i" }); // matches both names
    expect(two).toMatchObject({ kind: "clarify" });
    expect(two.kind === "clarify" && two.options.length).toBe(2);
  });

  it("a reminder for a disputed invoice is refused: the dispute is answered in the inbox", async () => {
    const port = fakePort({ async listInvoices() { return [{ ...invoices[0]!, status: "disputed" as const }]; } }).port;
    expect(await plan({ tool: "draft_reminder", invoice: "0142" }, port)).toMatchObject({ kind: "clarify", message: expect.stringMatching(/disputed/i) });
  });

  it("naming only the buyer skips their disputed invoices", async () => {
    const port = fakePort({
      async listInvoices() {
        return [{ ...invoices[0]!, status: "disputed" as const, dueDate: "2026-09-01" }, invoices[2]!];
      },
      async getBuyerContext() {
        return { exporterName: EXPORTER_NAME, buyer: HARBOURLINE, invoices: [...HARBOURLINE_INVOICES, invoices[2]!], messages: HARBOURLINE_MESSAGES };
      },
    }).port;
    const { client } = fakeAnthropic(() => ({ output: { subject: "INV-2026-0150", body: "Hi Claire, INV-2026-0150 for USD 5,000.00 is due soon." } }));
    expect(await plan({ tool: "draft_reminder", buyer: "harbourline" }, port, client)).toMatchObject({ kind: "reminder", line: { number: "INV-2026-0150" } });
  });

  it("a reminder for a paid invoice is refused in code", async () => {
    expect(await plan({ tool: "draft_reminder", invoice: "INV-2026-0151" })).toMatchObject({ kind: "clarify", message: expect.stringMatching(/paid/i) });
  });

  it("sweep preview: vault balances, rule check, confirmation needed", async () => {
    const p = await plan({ tool: "sweep_preview" });
    expect(p).toMatchObject({ kind: "sweep", totalUsdc: 1_500_000_000n, vaults: [{ buyerName: HARBOURLINE.name, amountUsdc: 1_500_000_000n, mode: "autonomous", ruleId: "T2" }] });
  });

  it("cash-out preview converts RM to USDC at the BNM rate in code and is always an owner-approved proposal", async () => {
    const p = await plan({ tool: "cash_out_preview", amount: "RM 10k" });
    expect(p).toMatchObject({ kind: "cash_out", amountUsdc: 2_372_479_240n, myrSen: 1_000_000n, rate: RATE, allowed: true, ruleId: "T4", destination: "HATA MYR" });
    expect(await plan({ tool: "cash_out_preview", amount: "RM 1m" })).toMatchObject({ kind: "cash_out", allowed: false, reason: expect.stringMatching(/treasury/i) });
    expect(await plan({ tool: "cash_out_preview" })).toMatchObject({ kind: "clarify" });
    expect(await plan({ tool: "cash_out_preview", amount: "loads" })).toMatchObject({ kind: "clarify" });
  });

  it("this week comes from the calendar query", async () => {
    expect(await plan({ tool: "week_agenda" })).toMatchObject({ kind: "agenda", from: "2026-09-28", to: "2026-10-04", events: [{ kind: "due" }] });
  });

  it("no tool → help with examples", async () => {
    expect(await plan({ tool: "none" })).toMatchObject({ kind: "help" });
  });
});

describe("confirmReminder: the only way a command bar reminder goes out", () => {
  it("emails the buyer with Reply-To, records the message and logs the action with the approver", async () => {
    const writes: Array<[string, unknown]> = [];
    const sent: unknown[] = [];
    const mailer: Mailer = { async send(to, email, o) { sent.push([to, email, o]); return "sent"; } };
    const r = await confirmReminder(
      {
        store: {
          ...fakePort().port,
          async recordMessage(m) { writes.push(["recordMessage", m]); },
          async recordAgentAction(a) { writes.push(["recordAgentAction", a]); return { id: "act_1" }; },
          async getContactEmail() { return "owner@teratai.test"; },
        },
        mailer,
        now: () => NOW,
      },
      E,
      { invoiceId: "inv_0142", subject: "INV-2026-0142 is overdue", body: "Edited by owner", approvedBy: "usr_owner" },
    );
    expect(r.delivery).toBe("sent");
    expect(sent).toEqual([[HARBOURLINE.email, { subject: "INV-2026-0142 is overdue", body: "Edited by owner" }, { replyTo: "owner@teratai.test" }]]);
    expect(writes.map((w) => w[0])).toEqual(["recordMessage", "recordAgentAction"]);
    expect(writes[1]![1]).toMatchObject({ kind: "reminder", status: "executed", buyerId: HARBOURLINE.id, invoiceId: "inv_0142", approvedBy: "usr_owner" });
  });

  it("refuses paid or unknown invoices", async () => {
    const deps = {
      store: { ...fakePort().port, async recordMessage() {}, async recordAgentAction() { return { id: "x" }; }, async getContactEmail() { return null; } },
      mailer: { async send() { return "sent" as const; } },
      now: () => NOW,
    };
    await expect(confirmReminder(deps, E, { invoiceId: "inv_0151", subject: "s", body: "b", approvedBy: "u" })).rejects.toThrow(/paid/i);
    await expect(confirmReminder(deps, E, { invoiceId: "inv_nope", subject: "s", body: "b", approvedBy: "u" })).rejects.toThrow(/not found/i);
  });
});
