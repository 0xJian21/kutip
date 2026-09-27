import { expect, test } from "vitest";
import { createRpc } from "./rpc";

function stub(result: unknown) {
  const calls: Array<{ method: string; params: unknown[] }> = [];
  const fetchFn = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    calls.push({ method: body.method, params: body.params });
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }));
  }) as typeof fetch;
  return { rpc: createRpc("https://rpc.example/sol?api_key=k", fetchFn), calls };
}

test("getTransaction asks for raw JSON (never jsonParsed) at confirmed, v0 allowed", async () => {
  const { rpc, calls } = stub(null);
  await rpc.getTransaction("sig1");
  expect(calls[0]).toEqual({ method: "getTransaction", params: ["sig1", { encoding: "json", commitment: "confirmed", maxSupportedTransactionVersion: 0 }] });
});

test("getSignaturesForAddress looks at confirmed history", async () => {
  const { rpc, calls } = stub([]);
  await rpc.getSignaturesForAddress("Ref1");
  expect(calls[0]).toEqual({ method: "getSignaturesForAddress", params: ["Ref1", { commitment: "confirmed", limit: 20 }] });
});

test("getSignatureStatuses searches history and unwraps value", async () => {
  const { rpc, calls } = stub({ context: { slot: 1 }, value: [{ slot: 9, confirmationStatus: "finalized", err: null }, null] });
  expect(await rpc.getSignatureStatuses(["a", "b"])).toEqual([{ slot: 9, confirmationStatus: "finalized", err: null }, null]);
  expect(calls[0]!.params).toEqual([["a", "b"], { searchTransactionHistory: true }]);
});

test("getAccounts decodes base64 data and lamports as bigint", async () => {
  const { rpc } = stub({ context: { slot: 1 }, value: [{ lamports: 2039280, data: [Buffer.from([1, 2, 3]).toString("base64"), "base64"] }, null] });
  expect(await rpc.getAccounts(["x", "y"])).toEqual([{ pubkey: "x", lamports: 2039280n, data: new Uint8Array([1, 2, 3]) }]);
});

test("RPC errors throw with the method name", async () => {
  const fetchFn = (async () => new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32602, message: "bad" } }))) as unknown as typeof fetch;
  await expect(createRpc("https://x", fetchFn).getTransaction("s")).rejects.toThrow("getTransaction: bad");
});
