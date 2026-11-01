"use client";

import { useActionState, useState } from "react";
import { joinRoom, JoinState } from "@/app/actions/room";
import { normalizeRoomCode } from "@/lib/room-code";

export default function JoinForm() {
  const [state, action, pending] = useActionState<JoinState, FormData>(joinRoom, { error: null });
  const [code, setCode] = useState("");

  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="code" className="text-sm font-semibold">
        Code de la salle
      </label>
      <input
        id="code"
        name="code"
        className="input text-center font-display text-3xl tracking-[0.4em] tabular-nums"
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="000000"
        value={code}
        onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
        required
      />
      {state.error && (
        <p role="alert" className="rounded-lg bg-[var(--red-soft)] px-3 py-2 text-sm font-semibold">
          {state.error}
        </p>
      )}
      <button type="submit" className="btn btn-ghost w-full" disabled={pending || code.length !== 6}>
        {pending ? "Connexion…" : "Rejoindre"}
      </button>
    </form>
  );
}
