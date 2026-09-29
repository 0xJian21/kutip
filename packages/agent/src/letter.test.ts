import { describe, expect, test } from "vitest";
import { letterEmail, letterParagraphs, letterSubject, renderLetter, type LetterInput } from "./letter";

const base: LetterInput = {
  kind: "invoice",
  letterhead: { name: "Teratai Woodworks Sdn. Bhd.", registrationNo: "202001034567 (1391234-K)", address: "Lot 2188, Jalan Bakri, 84000 Muar, Johor, Malaysia", contactEmail: "accounts@teratai.example" },
  recipientName: "Claire Whitmore",
  sender: { name: "Farid Zulkifli", title: "Owner" },
  invoice: { number: "INV-2026-0162", issuedAt: "2026-09-20", dueDate: "2026-10-04", amountUsdc: 1_250_000_000n, payUrl: "https://kutip.test/pay/inv_abc" },
  rate: { myrPerUsd: 42150n, date: "2026-09-26" },
  paragraphs: [],
};

describe("letterSubject", () => {
  test("every kind names the invoice, the seller and the amount; dates come from code", () => {
    expect(letterSubject(base)).toBe("Invoice INV-2026-0162 from Teratai Woodworks Sdn. Bhd. — USD 1,250.00 due 4 Oct 2026");
    expect(letterSubject({ ...base, kind: "reminder_friendly" })).toBe("Reminder: invoice INV-2026-0162 from Teratai Woodworks Sdn. Bhd. — USD 1,250.00 due 4 Oct 2026");
    expect(letterSubject({ ...base, kind: "reminder_firm" })).toBe("Overdue: invoice INV-2026-0162 from Teratai Woodworks Sdn. Bhd. — USD 1,250.00 was due 4 Oct 2026");
    expect(letterSubject({ ...base, kind: "reminder_final" })).toBe("Final reminder: invoice INV-2026-0162 from Teratai Woodworks Sdn. Bhd. — USD 1,250.00 was due 4 Oct 2026");
    expect(letterSubject({ ...base, kind: "receipt", paid: { amountUsdc: 1_250_000_000n, at: "2026-10-02T03:00:00.000Z" } })).toBe("Payment received: invoice INV-2026-0162 from Teratai Woodworks Sdn. Bhd. — USD 1,250.00");
    expect(letterSubject({ ...base, kind: "reply" })).toBe("Re: invoice INV-2026-0162 from Teratai Woodworks Sdn. Bhd.");
  });
});

describe("renderLetter", () => {
  test("the invoice letter: letterhead, formal greeting, summary with USD and MYR, one pay button with a plain URL, sign-off, footer", () => {
    const { subject, html, text } = renderLetter(base);
    expect(subject).toBe(letterSubject(base));
    for (const s of ["Teratai Woodworks Sdn. Bhd.", "SSM 202001034567 (1391234-K)", "Lot 2188, Jalan Bakri", "Dear Claire Whitmore,", "INV-2026-0162", "20 Sep 2026", "4 Oct 2026", "USD 1,250.00", "RM 5,268.75", "View &amp; pay invoice", "https://kutip.test/pay/inv_abc", "Farid Zulkifli", "Owner, Teratai Woodworks Sdn. Bhd.", "Sent via Kutip"]) {
      expect(html).toContain(s);
    }
    expect(html.match(/href="https:\/\/kutip\.test\/pay\/inv_abc"/g)!.length).toBe(2); // the button and the plain fallback link
    expect(html).toContain('width="600"');
    expect(html).toContain("prefers-color-scheme: dark");
    for (const s of ["Dear Claire Whitmore,", "Invoice: INV-2026-0162", "Amount: USD 1,250.00 (about RM 5,268.75 at the Bank Negara rate of 26 Sep 2026)", "View and pay the invoice: https://kutip.test/pay/inv_abc", "Farid Zulkifli", "Sent via Kutip"]) {
      expect(text).toContain(s);
    }
  });

  test("reminders and replies carry the writer's paragraphs, escaped; the numbers still come from code", () => {
    const { html, text } = renderLetter({ ...base, kind: "reminder_firm", now: "2026-10-09T02:00:00.000Z", paragraphs: ["We have not yet received payment <b>for</b> this invoice.", "Could you let us know when to expect it?"] });
    expect(html).toContain("We have not yet received payment &lt;b&gt;for&lt;/b&gt; this invoice.");
    expect(html).toContain("5 days overdue");
    expect(text).toContain("Status: 5 days overdue");
    expect(text).toContain("Could you let us know when to expect it?");
  });

  test("the receipt shows what was paid and what is left; no pay button when paid in full", () => {
    const full = renderLetter({ ...base, kind: "receipt", paid: { amountUsdc: 1_250_000_000n, at: "2026-10-02T03:00:00.000Z" }, paragraphs: ["Thank you for your payment."] });
    expect(full.html).toContain("Paid in full");
    expect(full.html).not.toContain("View &amp; pay invoice");
    const part = renderLetter({ ...base, kind: "receipt", paid: { amountUsdc: 250_000_000n, at: "2026-10-02T03:00:00.000Z" }, paragraphs: [] });
    expect(part.html).toContain("USD 1,000.00 still due");
    expect(part.html).toContain("View &amp; pay invoice");
  });

  test("a logo when there is one, initials when not; everything from the letterhead is escaped", () => {
    expect(renderLetter({ ...base, letterhead: { ...base.letterhead, logoUrl: "https://x.test/logo.png" } }).html).toContain('src="https://x.test/logo.png"');
    const init = renderLetter(base).html;
    expect(init).toContain(">TW<");
    expect(renderLetter({ ...base, letterhead: { ...base.letterhead, name: 'Evil "Co" <script>' } }).html).not.toContain("<script>");
  });

  test("no crypto jargon beyond the one How to pay line", () => {
    const { text } = renderLetter(base);
    const lines = text.split("\n").filter((l) => /\b(USDC|SOL|wallet|network fee)\b/.test(l));
    expect(lines).toHaveLength(1);
  });
});

test("the footer never doubles the full stop after Sdn. Bhd.", () => {
  const { html, text } = renderLetter(base);
  expect(text).toContain("on behalf of Teratai Woodworks Sdn. Bhd. Reply");
  expect(html).toContain("on behalf of Teratai Woodworks Sdn. Bhd. Reply");
});

describe("letterParagraphs", () => {
  test("splits on blank lines and drops a greeting, sign-off and signature the writer added anyway", () => {
    const body = "Hi Claire,\n\nInvoice INV-2026-0162 was due on 4 October 2026.\nCould you let us know when to expect payment?\n\nKind regards,\nTeratai Woodworks Sdn. Bhd.";
    expect(letterParagraphs(body)).toEqual(["Invoice INV-2026-0162 was due on 4 October 2026. Could you let us know when to expect payment?"]);
    expect(letterParagraphs("Dear Ms Whitmore,\n\nThank you.\n\nBest regards,\nFarid")).toEqual(["Thank you."]);
    expect(letterParagraphs("Thanks for your message.\n\nWe will reply personally.")).toEqual(["Thanks for your message.", "We will reply personally."]);
  });
});

describe("letterEmail", () => {
  const head = { name: "Teratai Woodworks Sdn. Bhd.", registrationNo: "202001034567 (1391234-K)", address: "Muar", contactEmail: "accounts@teratai.example", ownerName: "Farid Zulkifli", rate: { myrPerUsd: 42150n, date: "2026-09-26" } };
  const invoice = { number: "INV-2026-0162", dueDate: "2026-10-04", amountUsdc: 1_250_000_000n, payUrl: "https://kutip.test/pay/inv_abc", status: "overdue" };

  test("subject, html and text from code; the record keeps just the message", () => {
    const e = letterEmail("reminder_firm", { head, contactName: "Claire Whitmore", invoice, body: "Hi Claire,\n\nIt is overdue.\n\nRegards,\nTeratai", now: "2026-10-09T00:00:00Z" });
    expect(e.subject).toBe("Overdue: invoice INV-2026-0162 from Teratai Woodworks Sdn. Bhd. — USD 1,250.00 was due 4 Oct 2026");
    expect(e.record).toBe("It is overdue.");
    expect(e.body).toContain("Dear Claire Whitmore,");
    expect(e.body).toContain("Farid Zulkifli\nOwner, Teratai Woodworks Sdn. Bhd.");
    expect(e.html).toContain("5 days overdue");
    expect(e.html).not.toContain("Issue date");
  });

  test("without an owner name the letter is signed by the accounts team", () => {
    const e = letterEmail("reply", { head: { ...head, ownerName: "" }, contactName: "Claire Whitmore", invoice, body: "Thanks." });
    expect(e.body).toContain("Accounts team\nAccounts, Teratai Woodworks Sdn. Bhd.");
  });
});
