/**
 * The owner's rulebook (SPEC §4). Same shape as `Rulebook` in apps/web/lib/ui/types.ts.
 * Rule ids used in decisions: C1–C6 collections, T1–T5 treasury, I1 invoice reading.
 */
import { z } from "zod";

/** USDC base units. Accepts a bigint, or a digit string as it comes back from jsonb. */
const baseUnits = z.union([z.bigint(), z.string().regex(/^\d+$/).transform((s) => BigInt(s))]).pipe(z.bigint().nonnegative());
const hour = z.number().int().min(0).max(23);

export const rulebookSchema = z.object({
  collections: z
    .object({
      firstReminderDaysBeforeDue: z.number().int().min(0).max(30),
      maxMessagesPer48h: z.number().int().min(1).max(5),
      quietHoursStart: hour, // buyer local hour; quiet from here…
      quietHoursEnd: hour, // …until here. Sending window is [end, start).
      maxDiscountPctWithoutApproval: z.number().min(0).max(20),
      escalateAfterOverdueReminders: z.number().int().min(1).max(10),
      escalateOnDispute: z.boolean(),
    })
    .refine((c) => c.quietHoursStart !== c.quietHoursEnd, { message: "Quiet hours leave no time to send" }),
  treasury: z.object({
    acceptedTokens: z.array(z.enum(["USDC", "SOL", "USDT"])).min(1),
    sweepDaily: z.boolean(),
    sweepRandomised: z.boolean(),
    agentDailyLimitUsdc: baseUnits, // per buyer vault
    otherMovementsNeedApproval: z.boolean(),
    cashOutAlertMarginBps: baseUnits, // vs 30-day average
  }),
});

export type Rulebook = z.infer<typeof rulebookSchema>;

export function parseRulebook(input: unknown): Rulebook {
  return rulebookSchema.parse(input);
}

export const DEFAULT_RULEBOOK: Rulebook = {
  collections: {
    firstReminderDaysBeforeDue: 3,
    maxMessagesPer48h: 1,
    quietHoursStart: 18,
    quietHoursEnd: 9,
    maxDiscountPctWithoutApproval: 2,
    escalateAfterOverdueReminders: 2,
    escalateOnDispute: true,
  },
  treasury: {
    acceptedTokens: ["USDC", "SOL", "USDT"],
    sweepDaily: true,
    sweepRandomised: true,
    agentDailyLimitUsdc: 5_000_000_000n,
    otherMovementsNeedApproval: true,
    cashOutAlertMarginBps: 50n,
  },
};
