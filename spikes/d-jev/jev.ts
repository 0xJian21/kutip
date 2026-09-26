// Jev (TypeSafe AI) classifier via the official TS SDK.
// Docs: https://docs.typesafe.ai/api  ·  SDK: https://docs.typesafe.ai/sdk/javascript
// Wire: POST https://api.typesafe.ai/v1/systemone, `Authorization: Bearer $TYPESAFE_API_KEY`.
import { TypeSafeClient, choice } from '@typesafe-ai/sdk';
import { LABEL_DESCRIPTIONS, type Label, type Result } from './samples';

// https://docs.typesafe.ai/models — $0.042 per 1M input tokens, output free (2026-09).
const USD_PER_INPUT_TOKEN = 0.042 / 1_000_000;

let client: TypeSafeClient | undefined;

export async function classify(email: string): Promise<Result> {
  client ??= new TypeSafeClient({ timeout: 10_000 }); // apiKey from TYPESAFE_API_KEY
  const t0 = performance.now();
  const res = await client.systemOne({
    // Framing the email as a field of a JSON state (not bare text) keeps it "data", not instructions.
    state: { buyer_email_reply: email },
    questions: {
      intent: choice(
        "What is the buyer's intent in this reply to an invoice payment reminder?",
        LABEL_DESCRIPTIONS,
      ),
    },
  });
  const latencyMs = performance.now() - t0;
  const a = res.answers.intent;
  return {
    label: a.choice as Label,
    confidence: a.confidence,
    latencyMs,
    costUsd: res.usage.input_tokens * USD_PER_INPUT_TOKEN,
    raw: { model: res.model, probabilities: a.probabilities, usage: res.usage },
  };
}
