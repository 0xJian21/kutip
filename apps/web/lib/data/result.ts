/**
 * Production Next.js replaces the message of any error a server action throws (React #441),
 * so actions with user-facing errors return them as data instead.
 */
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export async function toResult<T>(fn: () => Promise<T>, messages: { duplicate?: string } = {}): Promise<Result<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (e) {
    const err = e as Error & { cause?: { code?: string } };
    console.error(err);
    if (err.cause?.code === "23505") return { ok: false, error: messages.duplicate ?? "That already exists." };
    if (err.message.startsWith("Failed query")) return { ok: false, error: "Something went wrong. Please try again." };
    return { ok: false, error: err.message };
  }
}

export function unwrap<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(r.error);
  return r.value;
}
