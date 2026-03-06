import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

// Fallback placeholders so the build doesn't crash when Supabase isn't configured
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder";

/** Client-side Supabase client (anon key, respects RLS) — singleton for "use client" */
export function createBrowserSupabase() {
  if (browserClient) return browserClient;

  browserClient = createBrowserClient(SB_URL, SB_ANON);
  return browserClient;
}

/** Server-side Supabase client (service role, bypasses RLS) */
export function getSupabaseAdmin(): SupabaseClient {
  return createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } });
}

/**
 * Broadcast a message to all Supabase Realtime subscribers on a channel.
 * Uses the HTTP REST endpoint (no WebSocket needed, works in serverless).
 *
 * The supabase-js client prepends "realtime:" to channel names internally,
 * so we must match that prefix here for the message to reach browser clients.
 */
export async function broadcastToChannel(
  topic: string,
  event: string,
  payload: Record<string, unknown>,
) {
  const url = `${SB_URL}/realtime/v1/api/broadcast`;
  const key = SB_SERVICE;

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "apikey": key,
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [{ topic, event, payload }],
      }),
    });
  } catch {
    // Fire and forget — broadcast failure should never block the API response
  }
}
