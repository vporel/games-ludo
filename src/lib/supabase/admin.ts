import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

let admin: SupabaseClient | null = null;

/** Service-role client: bypasses RLS. Server only, used after the game rules are checked. */
export function supabaseAdmin(): SupabaseClient {
  if (!admin) {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_URL manquant.");
    admin = createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return admin;
}
