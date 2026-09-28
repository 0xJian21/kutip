/**
 * Outbound email via Resend when RESEND_API_KEY is set; otherwise the message is only recorded. Never throws.
 * Only addresses on the allowlist (EMAIL_ALLOWLIST, comma-separated; "*" = anyone) and their +aliases
 * are mailed. No allowlist = nothing is sent: the demo database holds fictional buyer addresses.
 */
import type { Email } from "./writer";

export type Mailer = { send(to: string, email: Email, opts?: { replyTo?: string }): Promise<"sent" | "recorded" | "skipped" | "failed"> };

/** a+tag@x.com matches a@x.com. Case-insensitive. */
function allowed(to: string, allowlist: string[]): boolean {
  if (allowlist.includes("*")) return true;
  const m = /^([^@+\s]+)(?:\+[^@\s]*)?@([^@\s]+)$/.exec(to.trim().toLowerCase());
  return m !== null && allowlist.some((a) => a.trim().toLowerCase() === `${m[1]}@${m[2]}`);
}

export function createMailer(opts: { apiKey?: string; from: string; log: (msg: string) => void; fetchFn?: typeof fetch; allowlist?: string[] }): Mailer {
  const fetchFn = opts.fetchFn ?? fetch;
  const allowlist = opts.allowlist ?? [];
  return {
    async send(to, email, o = {}) {
      if (!opts.apiKey) return "recorded";
      if (!allowed(to, allowlist)) {
        opts.log(`email to ${to} skipped: not on EMAIL_ALLOWLIST`);
        return "skipped";
      }
      try {
        const res = await fetchFn("https://api.resend.com/emails", {
          method: "POST",
          headers: { authorization: `Bearer ${opts.apiKey}`, "content-type": "application/json" },
          // Reply-To = the exporter's own address, so a buyer who hits Reply reaches them (IMPROVEMENTS E2.2).
          body: JSON.stringify({ from: opts.from, to: [to], subject: email.subject, text: email.body, ...(o.replyTo?.trim() ? { reply_to: o.replyTo.trim() } : {}) }),
          signal: AbortSignal.timeout(10_000),
        });
        if (res.ok) return "sent";
        opts.log(`email to buyer not sent: Resend HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
      } catch (e) {
        opts.log(`email to buyer not sent: ${(e as Error).message}`);
      }
      return "failed";
    },
  };
}
