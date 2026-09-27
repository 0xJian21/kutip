"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useRef } from "react";

/**
 * Supabase Realtime Broadcast (DECISIONS "after the spikes" #5): public topics,
 * anon key, no table reads. `invoice:<id>` carries `invoice` / `payment` events,
 * `owner:<exporterId>` carries content-free `changed` events that mean "refetch".
 * The topics are public, so events are hints: anything shown to a buyer comes from the server.
 */
let client: SupabaseClient | undefined;
function supabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return (client ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }));
}

export type BroadcastHandler = (event: string, payload: Record<string, unknown>) => void;

/** Anyone with the public anon key can send to these topics: never let a malformed payload throw. */
export function guard(handler: BroadcastHandler): BroadcastHandler {
  return (event, payload) => {
    try {
      handler(event, payload);
    } catch (e) {
      console.warn(`[realtime] ignored a malformed ${event} event: ${(e as Error).message}`);
    }
  };
}

export function subscribeBroadcast(topic: string, onEvent: BroadcastHandler): () => void {
  const sb = supabase();
  if (!sb) return () => {};
  const channel = sb
    .channel(topic)
    .on("broadcast", { event: "*" }, (m) => guard(onEvent)(m.event, (m.payload ?? {}) as Record<string, unknown>))
    .subscribe((status, err) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") console.warn(`[realtime] ${topic}: ${status}${err ? ` ${err.message}` : ""}`);
    });
  return () => void sb.removeChannel(channel);
}

/** Subscribe while mounted; the latest handler is always used without resubscribing. */
export function useBroadcast(topic: string | null, onEvent: BroadcastHandler): void {
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  });
  useEffect(() => (topic ? subscribeBroadcast(topic, (e, p) => handler.current(e, p)) : undefined), [topic]);
}

/** Collapse bursts of `changed` events (a payment touches invoices + payments + agent_actions) into one refetch. */
export function debounce(fn: () => void, ms = 300): () => void {
  let t: ReturnType<typeof setTimeout> | undefined;
  return () => {
    clearTimeout(t);
    t = setTimeout(fn, ms);
  };
}
