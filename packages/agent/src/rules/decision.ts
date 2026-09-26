/** What every rules-engine function returns, so each agent action can be logged with its rule. */
export type RuleId = "C1" | "C2" | "C3" | "C4" | "C5" | "C6" | "T1" | "T2" | "T3" | "T4" | "T5" | "I1";

export type Decision = {
  allowed: boolean;
  ruleId: RuleId;
  /** One plain-English sentence for the agent log. */
  reason: string;
};

export type InvoiceStatus = "draft" | "sent" | "seen" | "paid" | "settled" | "partially_paid" | "overdue" | "disputed";
