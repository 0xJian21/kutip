/**
 * Compile-time pin: the DB's return shapes must stay identical to the UI's
 * (apps/web/lib/ui/types.ts). `pnpm typecheck` fails if either side drifts.
 */
import { expect, test } from "vitest";
import type * as UI from "../../../apps/web/lib/ui/types";
import type * as DB from "./types";

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

const pinned: Array<true> = [
  true satisfies Same<DB.Exporter, UI.Exporter>,
  true satisfies Same<DB.Buyer, UI.Buyer>,
  true satisfies Same<DB.Invoice, UI.Invoice>,
  true satisfies Same<DB.Payment, UI.Payment>,
  true satisfies Same<DB.AgentAction, UI.AgentAction>,
  true satisfies Same<DB.Message, UI.Message>,
  true satisfies Same<DB.Sweep, UI.Sweep>,
  true satisfies Same<DB.Rulebook, UI.Rulebook>,
  true satisfies Same<DB.DashboardSummary, UI.DashboardSummary>,
  true satisfies Same<DB.TreasurySummary, UI.TreasurySummary>,
  true satisfies Same<DB.PayInvoice, UI.PayInvoice>,
  true satisfies Same<DB.InvoiceDetail, UI.InvoiceDetail>,
  true satisfies Same<DB.InvoiceFilter, UI.InvoiceFilter>,
];

test("DB return types match the UI's data types", () => {
  expect(pinned.every(Boolean)).toBe(true);
});
