import { NextResponse, type NextRequest } from "next/server";
import { BASE_PATH } from "@/lib/base-path";
import { createSupabaseServer } from "@/lib/supabase/server";

/** Signs out and goes to the login page (used when a session has no Ludo profile). */
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL(`${BASE_PATH}/login`, request.url));
}
