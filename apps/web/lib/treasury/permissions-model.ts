/**
 * Agent permissions (IMPROVEMENTS R4) as the owner sees them: a small, plain view over
 * the rulebook. Pure, so onboarding, Settings and the tests share it. The on-chain and
 * DB halves live in ./permissions.ts (server-only).
 */
import { parseRulebook, type Rulebook } from "@kutip/agent";

export const PERMISSIONS_PURPOSE = "Approve agent permissions";

export type AgentPermissions = {
  dailyCapUsdc: bigint;
  destination: "treasury";
  buyerReplies: Rulebook["replies"]["buyerReplies"];
  remindersAndReceipts: Rulebook["replies"]["remindersAndReceipts"];
  maxDiscountPct: number;
};

export function permissionsOf(rulebook: Rulebook): AgentPermissions {
  return {
    dailyCapUsdc: rulebook.treasury.agentDailyLimitUsdc,
    destination: "treasury",
    buyerReplies: rulebook.replies.buyerReplies,
    remindersAndReceipts: rulebook.replies.remindersAndReceipts,
    maxDiscountPct: rulebook.collections.maxDiscountPctWithoutApproval,
  };
}

/** The rulebook with these permissions applied; everything else untouched. Validated like any rulebook save. */
export function applyPermissions(rulebook: Rulebook, p: AgentPermissions): Rulebook {
  return parseRulebook({
    ...rulebook,
    collections: { ...rulebook.collections, maxDiscountPctWithoutApproval: p.maxDiscountPct },
    treasury: { ...rulebook.treasury, agentDailyLimitUsdc: p.dailyCapUsdc },
    replies: { remindersAndReceipts: p.remindersAndReceipts, buyerReplies: p.buyerReplies },
  });
}

/** Plain-English lines for the approval screen and the statement the owner signs. */
export function describePermissions(p: AgentPermissions): string[] {
  const cap = `${(p.dailyCapUsdc / 1_000_000n).toLocaleString("en-MY")}`;
  return [
    `Sweep buyer accounts into my treasury, up to USD ${cap} per buyer account per day. Nothing else moves without my Touch ID.`,
    p.buyerReplies === "off"
      ? "Do not answer buyer messages; only show them to me."
      : p.buyerReplies === "routine"
        ? "Answer routine buyer questions on its own (resend the invoice, how to pay, payment received). Discounts, disputes and anything about money wait for me."
        : "Draft replies to buyer messages for me to approve before anything is sent.",
    p.remindersAndReceipts === "automatic" ? "Send payment reminders and receipts on the rulebook schedule." : "Draft reminders and receipts for me to approve.",
    `Never offer more than ${p.maxDiscountPct}% discount without asking me.`,
  ];
}
