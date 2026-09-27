/** Outbound email via Resend when RESEND_API_KEY is set; otherwise the message is only recorded. Never throws. */
import type { Email } from "@kutip/agent";

export type Mailer = { send(to: string, email: Email): Promise<"sent" | "recorded" | "failed"> };

export function createMailer(opts: { apiKey?: string; from: string; log: (msg: string) => void; fetchFn?: typeof fetch }): Mailer {
  const fetchFn = opts.fetchFn ?? fetch;
  return {
    async send(to, email) {
      if (!opts.apiKey) return "recorded";
      try {
        const res = await fetchFn("https://api.resend.com/emails", {
          method: "POST",
          headers: { authorization: `Bearer ${opts.apiKey}`, "content-type": "application/json" },
          body: JSON.stringify({ from: opts.from, to: [to], subject: email.subject, text: email.body }),
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
