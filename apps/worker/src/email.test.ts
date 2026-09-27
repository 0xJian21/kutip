import { expect, test } from "vitest";
import { createMailer } from "./email";

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
  const m = createMailer({ apiKey: "re_test", from: "Kutip <a@b.test>", log: () => {}, fetchFn });
  expect(await m.send("buyer@x.test", email)).toBe("sent");
  expect(seen).toEqual([{ url: "https://api.resend.com/emails", auth: "Bearer re_test", body: { from: "Kutip <a@b.test>", to: ["buyer@x.test"], subject: email.subject, text: "Hi" } }]);
});

test("a Resend error or network failure is logged, never thrown", async () => {
  const logs: string[] = [];
  const m422 = createMailer({ apiKey: "k", from: "f", log: (l) => logs.push(l), fetchFn: (async () => new Response("bad from", { status: 422 })) as unknown as typeof fetch });
  expect(await m422.send("x@y.test", email)).toBe("failed");
  const down = createMailer({ apiKey: "k", from: "f", log: (l) => logs.push(l), fetchFn: (async () => { throw new Error("ECONNRESET"); }) as unknown as typeof fetch });
  expect(await down.send("x@y.test", email)).toBe("failed");
  expect(logs).toEqual(["email to buyer not sent: Resend HTTP 422 bad from", "email to buyer not sent: ECONNRESET"]);
});
