import { expect, test } from "vitest";
import { createMailer } from "./mailer";

const email = { subject: "Invoice INV-2026-0001", body: "Hi" };

test("without RESEND_API_KEY the message is only recorded; nothing is sent", async () => {
  let called = false;
  const m = createMailer({ from: "Kutip <a@b.test>", log: () => {}, fetchFn: (async () => ((called = true), new Response())) as unknown as typeof fetch });
  expect(await m.send("buyer@x.test", email)).toBe("recorded");
  expect(called).toBe(false);
});

test("with a key it posts to Resend", async () => {
  const seen: Array<{ url: string; body: unknown; auth: string | null }> = [];
  const fetchFn = (async (url: string, init: RequestInit) => {
    seen.push({ url, body: JSON.parse(String(init.body)), auth: new Headers(init.headers).get("authorization") });
    return new Response(JSON.stringify({ id: "e1" }));
  }) as unknown as typeof fetch;
  const m = createMailer({ apiKey: "re_test", from: "Kutip <a@b.test>", log: () => {}, fetchFn, allowlist: ["*"] });
  expect(await m.send("buyer@x.test", email)).toBe("sent");
  expect(seen).toEqual([{ url: "https://api.resend.com/emails", auth: "Bearer re_test", body: { from: "Kutip <a@b.test>", to: ["buyer@x.test"], subject: email.subject, text: "Hi" } }]);
});

test("a Resend error or network failure is logged, never thrown", async () => {
  const logs: string[] = [];
  const m422 = createMailer({ apiKey: "k", from: "f", log: (l) => logs.push(l), allowlist: ["*"], fetchFn: (async () => new Response("bad from", { status: 422 })) as unknown as typeof fetch });
  expect(await m422.send("x@y.test", email)).toBe("failed");
  const down = createMailer({ apiKey: "k", from: "f", log: (l) => logs.push(l), allowlist: ["*"], fetchFn: (async () => { throw new Error("ECONNRESET"); }) as unknown as typeof fetch });
  expect(await down.send("x@y.test", email)).toBe("failed");
  expect(logs).toEqual(["email to buyer not sent: Resend HTTP 422 bad from", "email to buyer not sent: ECONNRESET"]);
});

test("EMAIL_ALLOWLIST: only listed inboxes and their +aliases get mail; everything else is logged and skipped", async () => {
  const sent: string[] = [];
  const logs: string[] = [];
  const fetchFn = (async (_url: string, init: RequestInit) => (sent.push(JSON.parse(String(init.body)).to[0]), new Response("{}"))) as unknown as typeof fetch;
  const m = createMailer({ apiKey: "k", from: "f", log: (l) => logs.push(l), fetchFn, allowlist: ["jianwei2102@gmail.com"] });
  expect(await m.send("jianwei2102@gmail.com", email)).toBe("sent");
  expect(await m.send("JianWei2102+harbourline@Gmail.com", email)).toBe("sent");
  expect(await m.send("accounts@harbourline-interiors.example", email)).toBe("skipped");
  expect(await m.send("jianwei2102@gmail.com.evil.test", email)).toBe("skipped");
  expect(await m.send("xjianwei2102@gmail.com", email)).toBe("skipped");
  expect(sent).toEqual(["jianwei2102@gmail.com", "JianWei2102+harbourline@Gmail.com"]);
  expect(logs).toEqual([
    "email to accounts@harbourline-interiors.example skipped: not on EMAIL_ALLOWLIST",
    "email to jianwei2102@gmail.com.evil.test skipped: not on EMAIL_ALLOWLIST",
    "email to xjianwei2102@gmail.com skipped: not on EMAIL_ALLOWLIST",
  ]);
});

test("with a key but no allowlist nothing is sent (fail closed); '*' allows everyone", async () => {
  const fetchFn = (async () => new Response("{}")) as unknown as typeof fetch;
  expect(await createMailer({ apiKey: "k", from: "f", log: () => {}, fetchFn }).send("a@b.test", email)).toBe("skipped");
  expect(await createMailer({ apiKey: "k", from: "f", log: () => {}, fetchFn, allowlist: ["*"] }).send("a@b.test", email)).toBe("sent");
});
