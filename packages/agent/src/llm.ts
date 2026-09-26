/** One Haiku call with structured output. Every prompt in this package goes through here. */
import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

export const HAIKU = "claude-haiku-4-5";

export async function askHaiku<S extends z.ZodType>(
  client: Anthropic,
  req: { system: string; content: Anthropic.ContentBlockParam[]; schema: S; maxTokens: number },
): Promise<z.infer<S>> {
  const res = await client.messages.parse({
    model: HAIKU,
    max_tokens: req.maxTokens,
    system: req.system,
    messages: [{ role: "user", content: req.content }],
    output_config: { format: zodOutputFormat(req.schema) },
  });
  if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") throw new Error(`Haiku stopped early: ${res.stop_reason}`);
  if (res.parsed_output == null) throw new Error("Haiku returned no structured output");
  return res.parsed_output;
}

/** Put untrusted text inside a tag it cannot close. */
export function fence(tag: string, text: string): string {
  return `<${tag}>\n${text.replaceAll(`</${tag}`, `<\\/${tag}`)}\n</${tag}>`;
}
