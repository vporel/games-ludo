"use server";

import { createHmac } from "node:crypto";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";
import { normalizePseudo, pseudoError, pseudoToEmail } from "@/lib/pseudo";

export type AuthState = { error: string | null };

/**
 * Accounts have no user-facing password: knowing a pseudo is enough to sign in as that player.
 * The Supabase password is therefore derived from the pseudo with this constant, which is not a
 * real secret (anyone reading the code can reproduce it, gaining nothing more than the login page
 * already gives). NEVER change it once accounts exist: every existing player would be locked out.
 * Any feature needing real per-player security (a PIN, private data, payments...) must replace
 * this scheme with a server-side secret first.
 */
const PSEUDO_PASSWORD_SALT = "ludo.games.vporel.com/pseudo-auth/v1";

function derivePassword(pseudo: string): string {
  return createHmac("sha256", PSEUDO_PASSWORD_SALT).update(`ludo:${pseudo}`).digest("base64url");
}

function safeNext(next: FormDataEntryValue | null): string {
  const value = typeof next === "string" ? next : "";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

async function signIn(pseudo: string): Promise<string | null> {
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({
    email: pseudoToEmail(pseudo),
    password: derivePassword(pseudo),
  });
  return error ? error.message : null;
}

export async function register(_prev: AuthState, form: FormData): Promise<AuthState> {
  const pseudo = normalizePseudo(String(form.get("pseudo") ?? ""));
  const invalid = pseudoError(pseudo);
  if (invalid) return { error: invalid };

  const admin = supabaseAdmin();
  const { data: existing } = await admin.from("ludo_profiles").select("id").eq("pseudo", pseudo).maybeSingle();
  if (existing) return { error: "Ce pseudo est déjà pris." };

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: pseudoToEmail(pseudo),
    password: derivePassword(pseudo),
    email_confirm: true,
    user_metadata: { pseudo, app: "ludo" },
  });

  let userId = created?.user?.id;
  if (createError) {
    // The auth user may exist without a profile (interrupted sign-up): recover it.
    if (!/already|registered|exists/i.test(createError.message)) {
      return { error: "Impossible de créer le compte. Réessaie." };
    }
    const signInError = await signIn(pseudo);
    if (signInError) return { error: "Ce pseudo est déjà pris." };
    const supabase = await createSupabaseServer();
    userId = (await supabase.auth.getUser()).data.user?.id;
  }
  if (!userId) return { error: "Impossible de créer le compte. Réessaie." };

  const { error: profileError } = await admin.from("ludo_profiles").insert({ id: userId, pseudo });
  if (profileError && profileError.code !== "23505") {
    return { error: "Impossible de créer le profil. Réessaie." };
  }

  const signInError = await signIn(pseudo);
  if (signInError) return { error: "Compte créé, mais la connexion a échoué. Essaie de te connecter." };
  redirect(safeNext(form.get("next")));
}

export async function login(_prev: AuthState, form: FormData): Promise<AuthState> {
  const pseudo = normalizePseudo(String(form.get("pseudo") ?? ""));
  const invalid = pseudoError(pseudo);
  if (invalid) return { error: invalid };

  const { data: profile } = await supabaseAdmin().from("ludo_profiles").select("id").eq("pseudo", pseudo).maybeSingle();
  if (!profile) return { error: "Pseudo inconnu. Crée un compte d'abord." };

  const error = await signIn(pseudo);
  if (error) return { error: "Connexion impossible. Réessaie." };
  redirect(safeNext(form.get("next")));
}

export async function logout(): Promise<void> {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
