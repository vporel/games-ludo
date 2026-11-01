"use client";

import { useState } from "react";
import { Color, COLOR_LABELS, MAX_PLAYERS, MIN_PLAYERS, colorsForPlayerCount } from "@/game/constants";
import { BASE_PATH } from "@/lib/base-path";
import type { RoomPlayer } from "@/lib/types";

const CSS_COLOR: Record<Color, string> = {
  red: "var(--red)",
  green: "var(--green)",
  yellow: "var(--yellow)",
  blue: "var(--blue)",
};

export type LobbyProps = {
  code: string;
  players: RoomPlayer[];
  meId: string;
  hostId: string;
  online: Set<string>;
  onStart: () => Promise<string | null>;
  onKick: (userId: string) => Promise<string | null>;
  onLeave: () => Promise<void>;
};

export default function Lobby({ code, players, meId, hostId, online, onStart, onKick, onLeave }: LobbyProps) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isHost = meId === hostId;
  const canStart = players.length >= MIN_PLAYERS;
  const colors = colorsForPlayerCount(Math.max(players.length, MIN_PLAYERS));
  const host = players.find((p) => p.userId === hostId);

  async function copy(kind: "code" | "link") {
    const link = `${window.location.origin}${BASE_PATH}/room/${code}`;
    const text = kind === "code" ? code : link;
    try {
      if (kind === "link" && navigator.share) {
        await navigator.share({ title: "Ludo", text: `Rejoins ma partie de Ludo ! Code : ${code}`, url: link });
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      // Share sheet dismissed or clipboard unavailable: nothing to do.
    }
  }

  async function act(fn: () => Promise<string | null>) {
    setPending(true);
    setError(null);
    const err = await fn();
    if (err) setError(err);
    setPending(false);
  }

  return (
    <div className="w-full max-w-xl mx-auto px-4 pb-12 flex flex-col gap-5">
      <section className="card p-6 text-center pop-in">
        <p className="text-sm font-bold uppercase tracking-widest text-muted">Code de la salle</p>
        <button
          type="button"
          onClick={() => void copy("code")}
          className="mt-3 inline-flex gap-1.5 sm:gap-2"
          aria-label={`Copier le code ${code}`}
          title="Copier le code"
        >
          {code.split("").map((d, i) => (
            <span
              key={i}
              className="w-11 h-14 sm:w-14 sm:h-[4.5rem] rounded-lg bg-field grid place-items-center font-display text-3xl sm:text-4xl font-bold tabular-nums"
            >
              {d}
            </span>
          ))}
        </button>
        <div className="mt-4 flex justify-center gap-2">
          <button className="btn btn-ghost !py-2 text-sm" onClick={() => void copy("code")}>
            {copied === "code" ? "Copié ✓" : "Copier le code"}
          </button>
          <button className="btn btn-ghost !py-2 text-sm" onClick={() => void copy("link")}>
            {copied === "link" ? "Lien copié ✓" : "Partager le lien"}
          </button>
        </div>
        <p className="text-muted text-sm mt-3">Envoie ce code à tes amis : ils le saisissent sur l&apos;accueil.</p>
      </section>

      <section className="card p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="font-display text-xl font-bold">Joueurs</h2>
          <span className="text-sm font-bold text-muted tabular-nums">
            {players.length}/{MAX_PLAYERS}
          </span>
        </div>
        <ul className="flex flex-col gap-2">
          {Array.from({ length: MAX_PLAYERS }, (_, i) => {
            const p = players[i];
            if (!p) {
              return (
                <li key={`empty${i}`} className="flex items-center gap-3 rounded-lg bg-field px-3 py-2.5 text-muted">
                  <span className="w-9 h-9 rounded-full bg-surface grid place-items-center">…</span>
                  <span className="text-sm font-semibold">En attente d&apos;un joueur</span>
                </li>
              );
            }
            const color = colors[i] as Color | undefined;
            const isOnline = online.has(p.userId) || p.userId === meId;
            return (
              <li key={p.userId} className="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-2.5 pop-in">
                <span
                  className="relative w-9 h-9 rounded-full grid place-items-center text-white font-bold uppercase shrink-0"
                  style={{ background: color ? CSS_COLOR[color] : "var(--muted)" }}
                  title={color ? COLOR_LABELS[color] : undefined}
                >
                  {p.pseudo[0]}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[var(--surface-2)] ${
                      isOnline ? "bg-green" : "bg-[var(--border)]"
                    }`}
                  />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">
                    {p.pseudo}
                    {p.userId === meId && <span className="text-muted font-semibold"> (toi)</span>}
                  </p>
                  <p className="text-xs text-muted">
                    {p.userId === hostId ? "👑 Hôte" : isOnline ? "En ligne" : "Hors ligne"}
                    {color && players.length >= MIN_PLAYERS ? ` · ${COLOR_LABELS[color]}` : ""}
                  </p>
                </div>
                {isHost && p.userId !== meId && (
                  <button
                    className="text-xs font-bold text-muted hover:text-red px-2 py-1 rounded-lg"
                    disabled={pending}
                    onClick={() => void act(() => onKick(p.userId))}
                  >
                    Exclure
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {error && (
        <p role="alert" className="rounded-lg bg-[var(--red-soft)] px-3 py-2 text-sm font-semibold text-center">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {isHost ? (
          <>
            <button className="btn btn-primary w-full text-xl py-4" disabled={!canStart || pending} onClick={() => void act(onStart)}>
              {pending ? "Lancement…" : "Play"}
            </button>
            {!canStart && <p className="text-center text-sm text-muted">Il faut au moins un autre joueur pour lancer la partie.</p>}
          </>
        ) : (
          <div className="card px-4 py-4 text-center">
            <p className="font-semibold">En attente que {host?.pseudo ?? "l'hôte"} lance la partie…</p>
          </div>
        )}
        <button className="btn btn-ghost w-full" disabled={pending} onClick={() => void onLeave()}>
          Quitter la salle
        </button>
      </div>
    </div>
  );
}
