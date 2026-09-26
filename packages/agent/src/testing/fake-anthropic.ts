/**
 * A real Anthropic client whose fetch is stubbed. Tests see the exact request body that would go
 * over the wire, and script what the model "returns".
 */
import Anthropic from "@anthropic-ai/sdk";

type Reply = { output: unknown } | { raw: Record<string, unknown> };

export function fakeAnthropic(respond: (body: any) => Reply) {
  const requests: any[] = [];
  const client = new Anthropic({
    apiKey: "test-key",
    maxRetries: 0,
    fetch: async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      requests.push(body);
      const reply = respond(body);
      const message = {
        id: "msg_test",
        type: "message",
        role: "assistant",
        model: body.model,
        content: "output" in reply ? [{ type: "text", text: JSON.stringify(reply.output) }] : [],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 100, output_tokens: 20 },
        ...("raw" in reply ? reply.raw : {}),
      };
      return new Response(JSON.stringify(message), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  return { client, requests };
}

/** Everything a request tells the model, as one string. */
export const promptText = (body: any) => JSON.stringify({ system: body.system, messages: body.messages });
