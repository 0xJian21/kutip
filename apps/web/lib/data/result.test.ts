import { describe, expect, it } from "vitest";
import { toResult, unwrap } from "./result";

describe("server action results", () => {
  it("wraps a value", async () => {
    expect(await toResult(async () => 7)).toEqual({ ok: true, value: 7 });
  });

  it("keeps our own error messages (production Next.js hides thrown ones)", async () => {
    expect(await toResult(async () => { throw new Error("Enter a due date"); })).toEqual({ ok: false, error: "Enter a due date" });
  });

  it("turns a Postgres unique violation (wrapped by drizzle) into a plain sentence", async () => {
    const e = Object.assign(new Error('Failed query: insert into "invoices" …'), { cause: Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" }) });
    expect(await toResult(async () => { throw e; }, { duplicate: "That invoice number is already used" })).toEqual({ ok: false, error: "That invoice number is already used" });
  });

  it("never leaks SQL from other query failures", async () => {
    const r = await toResult(async () => { throw new Error('Failed query: select "secret" from x'); });
    expect(r).toEqual({ ok: false, error: "Something went wrong. Please try again." });
  });

  it("unwrap returns the value or throws the message client-side", () => {
    expect(unwrap({ ok: true, value: 1 })).toBe(1);
    expect(() => unwrap({ ok: false, error: "nope" })).toThrow("nope");
  });
});
