import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "./session-token";

const KEY = "test-secret";
const now = new Date("2026-09-30T02:00:00Z");

describe("session token", () => {
  it("round-trips the exporter and Privy user", () => {
    const token = signSession({ exporterId: "exp_teratai", privyUserId: "did:privy:abc", wallet: "23FK" }, KEY, now);
    expect(verifySession(token, KEY, now)).toMatchObject({ exporterId: "exp_teratai", privyUserId: "did:privy:abc", wallet: "23FK" });
  });

  it("rejects a token signed with another key", () => {
    const token = signSession({ exporterId: "exp_teratai", privyUserId: "did:privy:abc" }, "other", now);
    expect(verifySession(token, KEY, now)).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const token = signSession({ exporterId: "exp_teratai", privyUserId: "did:privy:abc" }, KEY, now);
    const [body, mac] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body!, "base64url").toString()), exporterId: "exp_other" })).toString("base64url");
    expect(verifySession(`${forged}.${mac}`, KEY, now)).toBeNull();
  });

  it("expires after 12 hours", () => {
    const token = signSession({ exporterId: "exp_teratai", privyUserId: "did:privy:abc" }, KEY, now);
    expect(verifySession(token, KEY, new Date(now.getTime() + 11 * 3_600_000))).not.toBeNull();
    expect(verifySession(token, KEY, new Date(now.getTime() + 13 * 3_600_000))).toBeNull();
  });

  it("returns null for garbage", () => {
    expect(verifySession(undefined, KEY, now)).toBeNull();
    expect(verifySession("", KEY, now)).toBeNull();
    expect(verifySession("abc", KEY, now)).toBeNull();
    expect(verifySession("a.b.c", KEY, now)).toBeNull();
  });
});
