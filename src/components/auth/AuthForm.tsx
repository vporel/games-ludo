"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AuthState, login, register } from "@/app/actions/auth";

export default function AuthForm({ mode, next }: { mode: "login" | "register"; next: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "login" ? login : register, {
    error: null,
  });
  const isLogin = mode === "login";
  const suffix = next !== "/" ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <form action={action} className="card w-full max-w-sm p-6 sm:p-8 flex flex-col gap-5 pop-in">
      <div>
        <h1 className="font-display text-3xl font-bold">{isLogin ? "Content de te revoir" : "Choisis ton pseudo"}</h1>
        <p className="text-muted mt-1">
          {isLogin ? "Entre ton pseudo pour te connecter." : "Pas d'email, pas de mot de passe : juste un pseudo."}
        </p>
      </div>
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold">Pseudo</span>
        <input
          name="pseudo"
          className="input"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          minLength={3}
          maxLength={20}
          pattern="[A-Za-z0-9_]{3,20}"
          title="3 à 20 caractères : lettres, chiffres et _"
          placeholder="ex. capitaine_ludo"
          required
          autoFocus
        />
        <span className="text-xs text-muted">3 à 20 caractères : lettres, chiffres et _</span>
      </label>
      {state.error && (
        <p role="alert" className="rounded-lg bg-[var(--red-soft)] text-[var(--text)] px-3 py-2 text-sm font-semibold">
          {state.error}
        </p>
      )}
      <button type="submit" className="btn btn-primary w-full text-lg" disabled={pending}>
        {pending ? "Un instant…" : isLogin ? "Se connecter" : "Créer mon compte"}
      </button>
      <p className="text-center text-sm text-muted">
        {isLogin ? "Pas encore de pseudo ? " : "Déjà un pseudo ? "}
        <Link href={`${isLogin ? "/register" : "/login"}${suffix}`} className="font-bold text-primary underline-offset-4 hover:underline">
          {isLogin ? "Crée ton compte" : "Connecte-toi"}
        </Link>
      </p>
    </form>
  );
}
