/**
 * Production Next.js replaces the message of any error a server action throws (React #441),
 * so actions with user-facing errors return them as data instead. Only a UserError's message
 * travels to the browser; everything else (Postgres, Privy, Anthropic, RPC) is masked, since
 * those messages name hosts, project refs and internals.
 */
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/** An error whose message is written for the person using the app. */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}

export const GENERIC_ERROR = "Something went wrong. Please try again.";

export async function toResult<T>(fn: () => Promise<T>, messages: { duplicate?: string } = {}): Promise<Result<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (e) {
    console.error(e);
    if (e instanceof UserError) return { ok: false, error: e.message };
    const cause = e instanceof Error ? (e.cause as { code?: string } | undefined) : undefined;
    if (cause?.code === "23505") return { ok: false, error: messages.duplicate ?? "That already exists." };
    return { ok: false, error: GENERIC_ERROR };
  }
}

export function unwrap<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(r.error);
  return r.value;
}
