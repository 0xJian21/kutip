import { describe, expect, it } from "vitest";
import { toResult, unwrap, UserError } from "./result";

describe("toResult", () => {
  it("returns the value", async () => {
    expect(await toResult(async () => 42)).toEqual({ ok: true, value: 42 });
  });
  it("passes a UserError's message through as data", async () => {
    expect(await toResult(async () => { throw new UserError("Enter a due date"); })).toEqual({ ok: false, error: "Enter a due date" });
  });
  it("maps a duplicate-key error to the caller's message", async () => {
    const err = new Error("Failed query: insert…", { cause: { code: "23505" } });
    expect(await toResult(async () => { throw err; }, { duplicate: "That number is taken" })).toEqual({ ok: false, error: "That number is taken" });
  });
  it("masks every other error, including non-Errors and messages that leak internals", async () => {
    const generic = { ok: false, error: "Something went wrong. Please try again." };
    expect(await toResult(async () => { throw new Error("Failed query: select * from exporters"); })).toEqual(generic);
    expect(await toResult(async () => { throw new Error("Privy user lookup: HTTP 401"); })).toEqual(generic);
    expect(await toResult(async () => { throw new Error("connect ECONNREFUSED db.abcdefgh.supabase.co:6543"); })).toEqual(generic);
    expect(await toResult(async () => { throw "boom"; })).toEqual(generic);
    expect(await toResult(async () => { throw undefined; })).toEqual(generic);
  });
});

describe("unwrap", () => {
  it("throws the error message of a failed result", () => {
    expect(() => unwrap({ ok: false, error: "nope" })).toThrow("nope");
    expect(unwrap({ ok: true, value: "v" })).toBe("v");
  });
});
