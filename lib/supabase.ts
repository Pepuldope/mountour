import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

/**
 * Returns a Supabase client, or `null` if the env vars aren't configured.
 * Cached across calls within one server process.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (client !== undefined) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    client = null;
    return client;
  }

  client = createClient(url, anonKey);
  return client;
}
