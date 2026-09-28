import { describe, expect, it } from "vitest";
import { budgetKey, LlmBudget } from "./llm-budget";

describe("LlmBudget", () => {
  it("allows up to the limit per exporter per window, then refuses with a message for the owner", () => {
    const b = new LlmBudget({ limit: 3, windowMs: 60_000 });
    for (let i = 0; i < 3; i++) expect(() => b.spend("exp_a", 1_000)).not.toThrow();
    expect(() => b.spend("exp_a", 1_000)).toThrow(/agent/i);
    expect(() => b.spend("exp_b", 1_000)).not.toThrow(); // another exporter has its own budget
    expect(() => b.spend("exp_a", 62_000)).not.toThrow(); // the window moved on
  });
});

describe("budgetKey", () => {
  it("owners share their exporter's budget; each demo visitor has their own", () => {
    expect(budgetKey({ exporterId: "exp_a", role: "owner", privyUserId: "did:1" })).toBe("exp_a");
    expect(budgetKey({ exporterId: "exp_a", role: "demo", privyUserId: "did:2" })).toBe("demo:did:2");
  });
});
