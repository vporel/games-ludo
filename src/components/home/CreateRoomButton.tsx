"use client";

import { useState, useTransition } from "react";
import { createRoom } from "@/app/actions/room";

export default function CreateRoomButton() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        className="btn btn-primary w-full text-lg py-4"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await createRoom();
            if (res && !res.ok) setError(res.error);
          })
        }
      >
        {pending ? "Création…" : "Créer une salle"}
      </button>
      {error && (
        <p role="alert" className="rounded-lg bg-[var(--red-soft)] px-3 py-2 text-sm font-semibold">
          {error}
        </p>
      )}
    </div>
  );
}
