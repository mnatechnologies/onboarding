/**
 * Supabase admin client — server-only.
 *
 * WARNING: the service-role key bypasses Row-Level Security entirely.
 * This module must NEVER be imported by client-side code or exposed to the
 * browser. Keep it in server components, Route Handlers, and server actions
 * only.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      "supabaseAdmin: SUPABASE_URL environment variable is not set."
    );
  }
  if (!key) {
    throw new Error(
      "supabaseAdmin: SUPABASE_SERVICE_ROLE_KEY environment variable is not set."
    );
  }

  _client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return _client;
}
