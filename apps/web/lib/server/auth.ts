import "server-only";
import { createHash } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { exporterForSignIn } from "./access";
import { SESSION_TTL_MS, signSession, verifySession, type Session } from "./session-token";
import { store } from "./store";

/**
 * Owner auth (SPEC F1, DECISIONS D2). The browser signs in with a Privy passkey,
 * then POSTs its Privy access token to /api/session. We verify it here against
 * Privy's JWKS, map the Privy user to a Kutip user (linked id, else its embedded
 * Solana wallet = the Squads owner), and set our own signed httpOnly cookie.
 * A verified Privy user with no Kutip user is refused; DEMO_FALLBACK=1 lets them into DEMO_EXPORTER_ID instead.
 */

export const MOCK = process.env.NEXT_PUBLIC_KUTIP_MOCK === "1";
export const DEMO_EXPORTER_ID = process.env.DEMO_EXPORTER_ID ?? "exp_teratai";
const COOKIE = "kutip_session";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

const cookieKey = () => createHash("sha256").update(`kutip-session:${env("PRIVY_APP_SECRET")}`).digest("hex");

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

export async function getSession(): Promise<Session | null> {
  if (MOCK) return { exporterId: DEMO_EXPORTER_ID, privyUserId: "mock" };
  return verifySession((await cookies()).get(COOKIE)?.value, cookieKey());
}

/** Pages: the session, or off to the sign-in step. */
export async function requireSession(next = "/dashboard"): Promise<Session> {
  const s = await getSession();
  if (!s) redirect(`/onboarding?next=${encodeURIComponent(next)}`);
  return s;
}

/** Server actions / routes: the session, or throw. */
export async function sessionOrThrow(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new Error("Your session has ended. Sign in again with your passkey.");
  return s;
}

async function privySolanaWallets(privyUserId: string): Promise<string[]> {
  const appId = env("NEXT_PUBLIC_PRIVY_APP_ID");
  const res = await fetch(`https://auth.privy.io/api/v1/users/${encodeURIComponent(privyUserId)}`, {
    headers: { authorization: `Basic ${Buffer.from(`${appId}:${env("PRIVY_APP_SECRET")}`).toString("base64")}`, "privy-app-id": appId },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`Privy user lookup: HTTP ${res.status}`);
  const user = (await res.json()) as { linked_accounts?: Array<{ type: string; chain_type?: string; address?: string }> };
  return (user.linked_accounts ?? []).filter((a) => a.type === "wallet" && a.chain_type === "solana" && a.address).map((a) => a.address!);
}

export async function signIn(accessToken: string): Promise<Session> {
  const appId = env("NEXT_PUBLIC_PRIVY_APP_ID");
  jwks ??= createRemoteJWKSet(new URL(`https://auth.privy.io/api/v1/apps/${appId}/jwks.json`));
  const { payload } = await jwtVerify(accessToken, jwks, { issuer: "privy.io", audience: appId });
  const privyUserId = payload.sub;
  if (!privyUserId) throw new Error("Privy token has no subject");

  const wallets = await privySolanaWallets(privyUserId);
  const user = await store().findUser({ privyUserId, wallets });
  if (user) await store().linkPrivyUser(user.userId, privyUserId);
  else console.warn(`[auth] ${privyUserId} has no Kutip user${process.env.DEMO_FALLBACK === "1" ? `; DEMO_FALLBACK → ${DEMO_EXPORTER_ID}` : "; refused"}`);
  const exporterId = exporterForSignIn(user, { demoFallback: process.env.DEMO_FALLBACK === "1" ? DEMO_EXPORTER_ID : undefined });
  const session: Session = { exporterId, privyUserId, ...(wallets[0] ? { wallet: wallets[0] } : {}) };

  (await cookies()).set(COOKIE, signSession(session, cookieKey()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return session;
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
