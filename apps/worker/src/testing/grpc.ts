import type { SubscribeUpdateTransaction } from "@triton-one/yellowstone-grpc";
import { readFileSync } from "node:fs";

/**
 * A SubscribeUpdateTransaction recorded from the live stream (RECORD_GRPC_DIR). The napi client yields
 * Buffers, which JSON.stringify writes as {type:"Buffer",data:[…]}; plain Uint8Arrays as {$b64}.
 */
export function reviveGrpc(name: string): SubscribeUpdateTransaction {
  const text = readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), "utf8");
  return JSON.parse(text, (_k, v) => {
    if (v && typeof v === "object" && v.type === "Buffer" && Array.isArray(v.data)) return new Uint8Array(v.data);
    if (v && typeof v === "object" && "$b64" in v) return new Uint8Array(Buffer.from(v.$b64, "base64"));
    return v;
  });
}
