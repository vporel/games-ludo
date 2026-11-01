"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  expireTurn,
  joinRoomByCode,
  kickPlayer,
  leaveRoom,
  moveToken,
  rematch,
  rollDice,
  startGame,
} from "@/app/actions/room";
import GameView from "@/components/game/GameView";
import { MAX_PLAYERS } from "@/game/constants";
import type { ActionResult, GameRow, RoomSnapshot } from "@/lib/types";
import Lobby from "./Lobby";
import { useRoom } from "./useRoom";

function Message({ title, text }: { title: string; text: string }) {
  return (
    <div className="w-full max-w-md mx-auto px-4 py-10">
      <div className="card p-6 text-center pop-in">
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        <p className="text-muted mt-2">{text}</p>
        <Link href="/" className="btn btn-primary mt-5">
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}

export default function RoomClient({ initial }: { initial: RoomSnapshot }) {
  const router = useRouter();
  const { snap, online, gone, clockOffset, refresh, applyGame, notify } = useRoom(initial);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const wasMember = useRef(initial.me.isMember);
  const [kicked, setKicked] = useState(false);
  const expiring = useRef<number | null>(null);

  useEffect(() => {
    if (wasMember.current && !snap.me.isMember) setKicked(true);
    wasMember.current = snap.me.isMember;
  }, [snap.me.isMember]);

  const gameAction = useCallback(
    async (fn: () => Promise<ActionResult<GameRow>>): Promise<string | null> => {
      const res = await fn();
      if (res.ok && res.data) {
        applyGame(res.data);
        return null;
      }
      if (!res.ok) {
        void refresh();
        return res.error;
      }
      return null;
    },
    [applyGame, refresh],
  );

  const version = snap.game?.version ?? 0;

  const onLeave = useCallback(async () => {
    notify();
    await leaveRoom(snap.id);
    router.push("/");
  }, [notify, router, snap.id]);

  if (gone) return <Message title="Salle introuvable" text={gone} />;
  if (kicked) return <Message title="Tu as quitté la salle" text="L'hôte t'a retiré de cette salle, ou elle a été fermée." />;

  if (!snap.me.isMember) {
    const full = snap.players.length >= MAX_PLAYERS;
    const started = snap.status !== "lobby";
    return (
      <div className="w-full max-w-md mx-auto px-4 py-10">
        <div className="card p-6 text-center pop-in">
          <p className="text-sm font-bold uppercase tracking-widest text-muted">Salle</p>
          <p className="font-display text-4xl font-bold tracking-[0.2em] tabular-nums mt-1">{snap.code}</p>
          <p className="text-muted mt-3">
            {started
              ? "La partie a déjà commencé dans cette salle."
              : full
                ? `La salle est pleine (${MAX_PLAYERS} joueurs maximum).`
                : `${snap.players.length} joueur${snap.players.length > 1 ? "s" : ""} t'attend${snap.players.length > 1 ? "ent" : ""}.`}
          </p>
          {joinError && <p className="mt-3 rounded-lg bg-[var(--red-soft)] px-3 py-2 text-sm font-semibold">{joinError}</p>}
          <div className="mt-5 flex flex-col gap-2">
            {!started && !full && (
              <button
                className="btn btn-primary"
                disabled={joining}
                onClick={async () => {
                  setJoining(true);
                  const res = await joinRoomByCode(snap.code);
                  if (res && !res.ok) setJoinError(res.error);
                  setJoining(false);
                }}
              >
                {joining ? "Connexion…" : "Rejoindre la salle"}
              </button>
            )}
            <Link href="/" className="btn btn-ghost">
              Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (snap.status === "lobby" || !snap.game) {
    return (
      <Lobby
        code={snap.code}
        players={snap.players}
        meId={snap.me.userId}
        hostId={snap.hostId}
        online={online}
        onLeave={onLeave}
        onStart={async () => {
          const err = await gameAction(() => startGame(snap.id));
          if (!err) {
            notify();
            await refresh();
          }
          return err;
        }}
        onKick={async (userId) => {
          const res = await kickPlayer(snap.id, userId);
          notify();
          await refresh();
          return res.ok ? null : res.error;
        }}
      />
    );
  }

  return (
    <GameView
      key={snap.game.startedAt}
      code={snap.code}
      game={snap.game}
      players={snap.players}
      meId={snap.me.userId}
      hostId={snap.hostId}
      online={online}
      clockOffset={clockOffset}
      onRoll={() => gameAction(() => rollDice(snap.id, version))}
      onMove={(pawn) => gameAction(() => moveToken(snap.id, pawn, version))}
      onExpire={() => {
        if (expiring.current === version) return;
        expiring.current = version;
        void expireTurn(snap.id, version).then((res) => {
          expiring.current = null;
          if (res.ok && res.data) applyGame(res.data);
          else void refresh();
        });
      }}
      onLeave={onLeave}
      onRematch={async () => {
        const res = await rematch(snap.id);
        if (!res.ok) return res.error;
        notify();
        await refresh();
        return null;
      }}
    />
  );
}
