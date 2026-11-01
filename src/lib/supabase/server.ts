import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/** Supabase client bound to the current user's session cookies. */
export async function createSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are refreshed by the middleware instead.
        }
      },
    },
  });
}

/** Current authenticated user id, or null. */
export async function getUserId(): Promise<string | null> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}
