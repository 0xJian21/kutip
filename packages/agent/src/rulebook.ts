/**
 * The owner's rulebook (SPEC §4). Same shape as `Rulebook` in apps/web/lib/ui/types.ts.
 * Rule ids used in decisions: C1–C6 collections, T1–T5 treasury, I1 invoice reading.
 */
import { z } from "zod";

/** USDC base units. Accepts a bigint, or a digit string as it comes back from jsonb. */
const baseUnits = z.union([z.bigint(), z.string().regex(/^\d+$/).transform((s) => BigInt(s))]).pipe(z.bigint().nonnegative());
const hour = z.number().int().min(0).max(23);

/**
 * Replies section (IMPROVEMENTS E3). Set once during onboarding, changed under
 * Settings → Agent permissions. Reminders and receipts are rule-based text; buyer
 * replies are answers to inbound messages. Discounts, disputes, promised dates
 * beyond 7 days and anything that moves money are never automatic, whatever the mode.
 */
export const REMINDER_MODES = ["automatic", "draft"] as const;
export const BUYER_REPLY_MODES = ["draft", "routine", "off"] as const;
export type ReminderMode = (typeof REMINDER_MODES)[number];
export type BuyerReplyMode = (typeof BUYER_REPLY_MODES)[number];

/** Same labels as the classifier's ReplyLabel; kept local so the rulebook stays dependency-free. */
export type ReplyIntent = "will_pay_on_date" | "dispute" | "discount_request" | "claims_paid" | "question" | "other";
/** Answers the agent may send on its own in "routine" mode: resend the invoice, payment instructions, "we received your payment". */
export const ROUTINE_REPLY_INTENTS: readonly ReplyIntent[] = ["question", "claims_paid"];
/** Never automatic (C3 discounts, C4 disputes): the owner always sees the draft first. */
export const NEVER_AUTOMATIC_INTENTS: readonly ReplyIntent[] = ["discount_request", "dispute"];
/** A promised date further out than this is not a routine acknowledgement (matches MAX_PROMISE_DAYS in rules/replies). */
export const ROUTINE_PROMISE_MAX_DAYS = 7;

export const DEFAULT_REPLIES = { remindersAndReceipts: "automatic", buyerReplies: "draft" } as const satisfies { remindersAndReceipts: ReminderMode; buyerReplies: BuyerReplyMode };

const repliesSchema = z.object({
  remindersAndReceipts: z.enum(REMINDER_MODES),
  buyerReplies: z.enum(BUYER_REPLY_MODES),
});

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
  // Rulebooks stored before Session 8b have no replies section; they get the defaults.
  replies: repliesSchema.default(DEFAULT_REPLIES),
});

export type Rulebook = z.infer<typeof rulebookSchema>;

export function parseRulebook(input: unknown): Rulebook {
  return rulebookSchema.parse(input);
}

export type ReplyAutonomy = "automatic" | "draft" | "off";

/**
 * May the agent send a reply to this kind of buyer message on its own?
 * "off" = the agent does not draft at all; "draft" = the owner approves; "automatic" = routine answers only.
 */
export function replyAutonomy(rulebook: Rulebook, intent: ReplyIntent, facts: { promiseDays?: number } = {}): ReplyAutonomy {
  const mode = rulebook.replies.buyerReplies;
  if (mode === "off") return "off";
  if (mode === "draft") return "draft";
  if (NEVER_AUTOMATIC_INTENTS.includes(intent)) return "draft";
  if (ROUTINE_REPLY_INTENTS.includes(intent)) return "automatic";
  if (intent === "will_pay_on_date" && facts.promiseDays !== undefined && facts.promiseDays <= ROUTINE_PROMISE_MAX_DAYS) return "automatic";
  return "draft";
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
  replies: DEFAULT_REPLIES,
};
