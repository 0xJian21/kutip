import { UserError } from "../data/result";

/**
 * Caps Haiku/Jev calls per exporter (command bar, draft reply, PDF reading, logged messages). Anyone can
 * sign up, so without it one account could loop these actions on our API keys. Per serverless instance,
 * like the other in-memory limits: a cap, not an exact count.
 */
export class LlmBudget {
  private readonly calls = new Map<string, number[]>();
  constructor(private readonly opts: { limit: number; windowMs: number }) {}

  spend(exporterId: string, now = Date.now()): void {
    const recent = (this.calls.get(exporterId) ?? []).filter((t) => now - t < this.opts.windowMs);
    if (recent.length >= this.opts.limit) {
      this.calls.set(exporterId, recent);
      throw new UserError("The agent has done a lot for this account in the last hour. Try again in a few minutes.");
    }
    recent.push(now);
    this.calls.set(exporterId, recent);
  }
}

/** Budget key: an owner/admin spends their exporter's budget; each DEMO_FALLBACK visitor gets their own, so the public can't use up the presenter's. */
export const budgetKey = (s: { exporterId: string; role?: string; privyUserId: string }): string => (s.role === "demo" ? `demo:${s.privyUserId}` : s.exporterId);

/** 60 agent calls per exporter per hour: far above a demo or a working day, far below a runaway loop. */
export const llmBudget = new LlmBudget({ limit: 60, windowMs: 3_600_000 });
