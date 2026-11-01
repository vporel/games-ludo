"use client";

import { useState } from "react";
import Logo from "@/components/Logo";
import GameView from "@/components/game/GameView";
import Lobby from "@/components/room/Lobby";
import { TURN_DURATION_MS } from "@/game/constants";
import { GameError, GameState, applyRoll, autoPlay, createGame, currentPlayer, movePawn } from "@/game/engine";
import type { GameRow, RoomPlayer } from "@/lib/types";

const PSEUDOS = ["alice", "bob", "chloe", "dimitri"];
const roll = () => 1 + Math.floor(Math.random() * 6);

function makePlayers(n: number): RoomPlayer[] {
  return PSEUDOS.slice(0, n).map((pseudo, i) => ({ userId: `u${i}`, pseudo, joinedAt: new Date().toISOString(), leftAt: null }));
}

function row(state: GameState, version: number, startedAt: string): GameRow {
  return {
    state,
    version,
    startedAt,
    turnDeadline: state.phase === "finished" ? null : new Date(Date.now() + TURN_DURATION_MS).toISOString(),
  };
}

function midGame(n: number): GameState {
  const s = createGame(makePlayers(n).map((p) => p.userId));
  const presets: Record<string, number[]> = {
    red: [-1, 3, 21, 53],
    green: [0, 10, -1, 56],
    yellow: [5, 14, 40, -1],
    blue: [-1, -1, 30, 2],
  };
  for (const p of s.players) s.pawns[p.color] = presets[p.color];
  return s;
}

export default function DevPlayground() {
  const [view, setView] = useState<"lobby" | "game">("game");
  const [count, setCount] = useState(4);
  const [game, setGame] = useState<GameRow>(() => row(midGame(4), 0, "g0"));
  const [lobbyCount, setLobbyCount] = useState(1);
  const players = makePlayers(count);

  function reset(n: number, mid: boolean) {
    setCount(n);
    setGame(row(mid ? midGame(n) : createGame(makePlayers(n).map((p) => p.userId)), 0, `g${Date.now()}`));
  }

  function apply(fn: (s: GameState) => GameState): string | null {
    try {
      const next = fn(game.state);
      if (next !== game.state) setGame(row(next, game.version + 1, game.startedAt));
      return null;
    } catch (e) {
      return e instanceof GameError ? e.message : String(e);
    }
  }

  const me = currentPlayer(game.state).userId; // hot seat: you always play the current color

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="w-full max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-4">
        <Logo />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-[var(--yellow-soft)] px-3 py-1 font-bold">Bac à sable (dev)</span>
          <button className={`btn !py-1.5 !px-3 ${view === "lobby" ? "btn-primary" : "btn-ghost"}`} onClick={() => setView("lobby")}>
            Salle
          </button>
          <button className={`btn !py-1.5 !px-3 ${view === "game" ? "btn-primary" : "btn-ghost"}`} onClick={() => setView("game")}>
            Partie
          </button>
          {view === "game" &&
            [2, 3, 4].map((n) => (
              <button key={n} className="btn btn-ghost !py-1.5 !px-3" onClick={() => reset(n, false)}>
                {n}J
              </button>
            ))}
          {view === "game" && (
            <button className="btn btn-ghost !py-1.5 !px-3" onClick={() => reset(count, true)}>
              Milieu de partie
            </button>
          )}
          {view === "lobby" && (
            <button className="btn btn-ghost !py-1.5 !px-3" onClick={() => setLobbyCount((c) => (c % 4) + 1)}>
              Joueurs : {lobbyCount}
            </button>
          )}
        </div>
      </header>
      <main className="flex-1">
        {view === "lobby" ? (
          <Lobby
            code="042917"
            players={makePlayers(lobbyCount)}
            meId="u0"
            hostId="u0"
            online={new Set(["u0", "u1"])}
            onStart={async () => {
              reset(Math.max(2, lobbyCount), false);
              setView("game");
              return null;
            }}
            onKick={async () => {
              setLobbyCount((c) => Math.max(1, c - 1));
              return null;
            }}
            onLeave={async () => setLobbyCount(1)}
          />
        ) : (
          <GameView
            key={game.startedAt}
            code="042917"
            game={game}
            players={players}
            meId={me}
            hostId="u0"
            online={new Set(players.map((p) => p.userId))}
            clockOffset={0}
            onRoll={async () => apply((s) => applyRoll(s, roll(), currentPlayer(s).userId))}
            onMove={async (pawn) => apply((s) => movePawn(s, pawn, currentPlayer(s).userId))}
            onExpire={() => apply((s) => autoPlay(s, roll))}
            onLeave={async () => reset(count, false)}
            onRematch={async () => {
              reset(count, false);
              return null;
            }}
          />
        )}
      </main>
    </div>
  );
}
