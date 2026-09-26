import { randomBytes } from "node:crypto";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const MEMO = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Uniform random string over `alphabet` (rejection sampling, no modulo bias). */
function randomString(alphabet: string, length: number): string {
  const limit = 256 - (256 % alphabet.length);
  let out = "";
  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte < limit && out.length < length) out += alphabet[byte % alphabet.length];
    }
  }
  return out;
}

/** `inv_…` style id. 20 base58 chars ≈ 117 bits, so ids work as unguessable pay-link tokens. */
export function newId(prefix: string): string {
  return `${prefix}_${randomString(B58, 20)}`;
}

/** Opaque on-chain memo code, e.g. `k_3f9a0qzt`. Carries nothing identifying. */
export function newMemoCode(): string {
  return `k_${randomString(MEMO, 8)}`;
}
